import { Op } from 'sequelize';

import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import {
  ADMIN_ROLE,
  CLOSED_LEAD_STATUSES,
  LEAD_SOURCE,
  LEAD_STATUS,
  LEAD_STATUS_GROUPS,
  PERMISSION_ACTION,
  PERMISSION_MODULE,
  permission,
} from '@src/utils/constants/public.constants';
import { hasPermission } from '@src/helpers/permission.helpers';
import {
  ASSIGNMENT_REASON,
  findExistingLeadForMobile,
  isEligibleTelecaller,
  normalizeMobile,
  pickNextTelecaller,
  recordAssignment,
} from '@src/services/crm/leadAssignment.helpers';

/**
 * The CRM pipeline: creating leads (from a person or, later, from a Meta
 * webhook), listing them, working them, and moving them between telecallers.
 *
 * Every incoming enquiry — whatever its source — comes through
 * CreateLeadService, so Round Robin, duplicate detection and the assignment
 * audit trail are enforced in exactly one place.
 */

const LEAD_INCLUDES = [
  { model: db.AdminUser, as: 'assignee', attributes: ['id', 'name', 'email', 'mobile'] },
  { model: db.AdminUser, as: 'creator', attributes: ['id', 'name'] },
];

/**
 * A telecaller sees only their OWN leads; anyone who can manage the CRM more
 * broadly (Super Admin, Marketing) sees everything.
 *
 * Expressed as a permission check rather than `role === TELECALLER` so that a
 * Super Admin who grants one senior telecaller CRM:DELETE — the "can manage
 * the whole board" permission — gets the wider view without a code change.
 */
const scopeToOwnLeads = (adminUser) =>
  adminUser.role === ADMIN_ROLE.TELECALLER &&
  !hasPermission(adminUser, permission(PERMISSION_MODULE.CRM, PERMISSION_ACTION.DELETE));

export class CreateLeadService extends BaseHandler {
  async run() {
    const { adminId, source, customerName, mobile, enquiry, brand, modelNumber, problem, notes } = this.args;
    const transaction = this.dbTransaction;

    const mobileNormalized = normalizeMobile(mobile);
    const { openLead, lastLead } = await findExistingLeadForMobile(mobileNormalized, transaction);

    // ---- Repeat enquiry, lead still open: fold it in, do NOT rotate. ----
    //
    // Creating a second lead here would both clutter the board and, far
    // worse, spend a Round Robin turn — handing a customer who already has a
    // telecaller to somebody else. The existing lead is bumped instead, so
    // the telecaller sees "they messaged again" on the card they already own.
    if (openLead) {
      await openLead.update(
        {
          contactCount: openLead.contactCount + 1,
          lastContactAt: new Date(),
          // Never overwrite details already captured with blanks from a
          // sparser repeat message — only fill gaps.
          customerName: openLead.customerName || customerName || null,
          brand: openLead.brand || brand || null,
          modelNumber: openLead.modelNumber || modelNumber || null,
          problem: openLead.problem || problem || null,
          enquiry: [openLead.enquiry, enquiry].filter(Boolean).join('\n---\n') || null,
        },
        { transaction },
      );

      return {
        ...getSuccessResponse('This customer already has an open lead — the enquiry was added to it.'),
        lead: openLead,
        deduplicated: true,
      };
    }

    // ---- Decide the owner ----
    let assignedTo = null;
    let reason = ASSIGNMENT_REASON.ROUND_ROBIN;

    // Sticky: a returning customer whose previous lead is closed goes back to
    // the telecaller who already dealt with them — and does NOT consume a
    // rotation turn, so the fair split across NEW customers is preserved.
    if (lastLead?.assignedTo && (await isEligibleTelecaller(lastLead.assignedTo, transaction))) {
      assignedTo = lastLead.assignedTo;
      reason = ASSIGNMENT_REASON.STICKY;
    } else {
      const next = await pickNextTelecaller(transaction);
      assignedTo = next?.id ?? null;
    }

    const lead = await db.Lead.create(
      {
        customerName: customerName ?? null,
        mobile: mobile ?? null,
        mobileNormalized,
        source: source ?? LEAD_SOURCE.MANUAL,
        enquiry: enquiry ?? null,
        brand: brand ?? null,
        modelNumber: modelNumber ?? null,
        problem: problem ?? null,
        notes: notes ?? null,
        status: LEAD_STATUS.NEW,
        assignedTo,
        lastContactAt: new Date(),
        contactCount: 1,
        createdBy: adminId ?? null,
      },
      { transaction },
    );

    if (assignedTo) {
      await recordAssignment(
        { leadId: lead.id, fromAdminUserId: null, toAdminUserId: assignedTo, reason, changedBy: adminId },
        transaction,
      );
    }

    return {
      ...getSuccessResponse(
        assignedTo
          ? 'Lead created and assigned.'
          : 'Lead created, but no telecaller was available — assign it by hand.',
      ),
      lead,
      assignmentReason: assignedTo ? reason : null,
    };
  }
}

export class GetLeadsService extends BaseHandler {
  async run() {
    const { adminUser, status, statusGroup, source, assignedTo, unassigned, search, page = 1, limit = 50 } =
      this.args;

    const where = {};
    if (status) where.status = status;
    // A specific status always wins over the coarse group filter.
    else if (statusGroup) where.status = { [Op.in]: LEAD_STATUS_GROUPS[statusGroup] ?? [] };
    if (source) where.source = source;

    // A telecaller's own filter can only ever narrow their own leads — it can
    // never be used to look at a colleague's board.
    if (scopeToOwnLeads(adminUser)) where.assignedTo = adminUser.id;
    else if (unassigned) where.assignedTo = null;
    else if (assignedTo) where.assignedTo = Number(assignedTo);

    if (search) {
      const like = { [Op.iLike]: `%${String(search).trim()}%` };
      // Location and problem included: with thousands of rows, "who did we
      // quote in Kolhapur" and "who had a display fault" are the searches
      // that actually get typed.
      where[Op.or] = [
        { customerName: like },
        { mobile: like },
        { brand: like },
        { modelNumber: like },
        { location: like },
        { problem: like },
      ];
    }

    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

    const { rows, count } = await db.Lead.findAndCountAll({
      where,
      include: LEAD_INCLUDES,
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset,
    });

    // Counts per group for the summary tiles, over the SAME filters but
    // ignoring the status filter itself — otherwise clicking "Won" would show
    // "Won: n, Open: 0", which reads as though the other leads had vanished.
    const countWhere = { ...where };
    delete countWhere.status;
    const grouped = await db.Lead.findAll({
      attributes: ['status', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'n']],
      where: countWhere,
      group: ['status'],
      raw: true,
    });
    const groupCounts = Object.fromEntries(
      Object.entries(LEAD_STATUS_GROUPS).map(([group, statuses]) => [
        group,
        grouped.filter((row) => statuses.includes(row.status)).reduce((sum, row) => sum + Number(row.n), 0),
      ]),
    );

    return {
      ...getSuccessResponse('Leads fetched successfully.'),
      leads: rows,
      total: count,
      page: Number(page),
      limit: Number(limit),
      groupCounts,
    };
  }
}

export class GetLeadService extends BaseHandler {
  async run() {
    const { id, adminUser } = this.args;

    const lead = await db.Lead.findByPk(id, {
      include: [
        ...LEAD_INCLUDES,
        {
          model: db.LeadAssignment,
          as: 'assignments',
          include: [
            { model: db.AdminUser, as: 'fromUser', attributes: ['id', 'name'] },
            { model: db.AdminUser, as: 'toUser', attributes: ['id', 'name'] },
            { model: db.AdminUser, as: 'changer', attributes: ['id', 'name'] },
          ],
        },
      ],
      order: [[{ model: db.LeadAssignment, as: 'assignments' }, 'id', 'ASC']],
    });

    if (!lead) throw new AppError(Errors.LEAD_NOT_FOUND);
    if (scopeToOwnLeads(adminUser) && lead.assignedTo !== adminUser.id) throw new AppError(Errors.FORBIDDEN);

    return { ...getSuccessResponse('Lead fetched successfully.'), lead };
  }
}

export class UpdateLeadService extends BaseHandler {
  async run() {
    const { id, adminUser, ...updates } = this.args;
    const transaction = this.dbTransaction;

    const lead = await db.Lead.findByPk(id, { transaction });
    if (!lead) throw new AppError(Errors.LEAD_NOT_FOUND);
    if (scopeToOwnLeads(adminUser) && lead.assignedTo !== adminUser.id) throw new AppError(Errors.FORBIDDEN);

    // assignedTo is deliberately NOT settable here — reassignment goes
    // through ReassignLeadService so it always leaves an audit row.
    delete updates.assignedTo;

    if (updates.mobile !== undefined) updates.mobileNormalized = normalizeMobile(updates.mobile);

    // Any human touch counts as contact, so "when did we last speak to them"
    // stays truthful without a separate button.
    if (updates.status && updates.status !== lead.status) updates.lastContactAt = new Date();

    await lead.update(updates, { transaction });

    return { ...getSuccessResponse('Lead updated successfully.'), lead };
  }
}

/**
 * Manual reassignment by a Super Admin (or anyone with CRM:DELETE).
 *
 * Deliberately does NOT touch the Round Robin cursor: moving one lead by hand
 * is a correction, not a turn in the rotation, and advancing the cursor here
 * would quietly skip somebody's next automatic lead.
 */
export class ReassignLeadService extends BaseHandler {
  async run() {
    const { id, toAdminUserId, note, adminId } = this.args;
    const transaction = this.dbTransaction;

    const lead = await db.Lead.findByPk(id, { transaction });
    if (!lead) throw new AppError(Errors.LEAD_NOT_FOUND);

    if (!(await isEligibleTelecaller(toAdminUserId, transaction))) throw new AppError(Errors.NOT_A_TELECALLER);

    const fromAdminUserId = lead.assignedTo;
    await lead.update({ assignedTo: toAdminUserId }, { transaction });

    await recordAssignment(
      {
        leadId: lead.id,
        fromAdminUserId,
        toAdminUserId,
        reason: ASSIGNMENT_REASON.MANUAL,
        changedBy: adminId,
        note,
      },
      transaction,
    );

    return { ...getSuccessResponse('Lead reassigned successfully.'), lead };
  }
}

/** The distribution dashboard: who holds what, and how fairly it is split. */
export class GetLeadDistributionService extends BaseHandler {
  async run() {
    const telecallers = await db.AdminUser.findAll({
      where: { role: ADMIN_ROLE.TELECALLER },
      order: [['id', 'ASC']],
    });

    const counts = await db.Lead.findAll({
      attributes: ['assignedTo', 'status', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
      group: ['assignedTo', 'status'],
      raw: true,
    });

    const state = await db.RoundRobinState.findByPk(1);

    const byUser = telecallers.map((user) => {
      const rows = counts.filter((row) => row.assignedTo === user.id);
      const total = rows.reduce((sum, row) => sum + Number(row.count), 0);
      const open = rows
        .filter((row) => !CLOSED_LEAD_STATUSES.includes(row.status))
        .reduce((sum, row) => sum + Number(row.count), 0);
      const converted = rows
        .filter((row) => row.status === LEAD_STATUS.CONVERTED)
        .reduce((sum, row) => sum + Number(row.count), 0);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        availability: user.availability,
        // Whether this person is currently in the rotation at all — the
        // dashboard's most important column, since a skipped telecaller
        // looks identical to an unlucky one otherwise.
        eligible: user.isActive && user.availability === 'AVAILABLE',
        totalLeads: total,
        openLeads: open,
        convertedLeads: converted,
      };
    });

    const unassigned = counts
      .filter((row) => row.assignedTo === null)
      .reduce((sum, row) => sum + Number(row.count), 0);

    return {
      ...getSuccessResponse('Lead distribution fetched successfully.'),
      distribution: byUser,
      unassignedLeads: unassigned,
      lastAssignedTo: state?.lastAssignedAdminUserId ?? null,
      // "Who gets the next automatic lead" — read-only, computed the same way
      // pickNextTelecaller() would, so the dashboard can show it truthfully.
      nextInRotation: (() => {
        const eligible = byUser.filter((user) => user.eligible);
        if (!eligible.length) return null;
        const lastIndex = eligible.findIndex((user) => user.id === state?.lastAssignedAdminUserId);
        return eligible[(lastIndex + 1) % eligible.length].id;
      })(),
    };
  }
}
