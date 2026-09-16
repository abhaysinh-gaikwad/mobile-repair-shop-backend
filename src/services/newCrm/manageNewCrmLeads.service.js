import { Op } from 'sequelize';

import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { nextSequenceValue } from '@src/helpers/repair.helpers';
import { getPaginationResponse, getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { ADMIN_ROLE, SEQUENCES } from '@src/utils/constants/public.constants';

/**
 * "New CRM" — a separate lead-tracking module for telecallers. Genuinely
 * independent of the existing CRM Lead board: its own table, its own serial
 * number series, no shared reads or writes with `leads`/`lead_assignments`.
 */

const LEAD_INCLUDES = [{ model: db.AdminUser, as: 'telecaller', attributes: ['id', 'name'] }];

async function nextSerialNo(transaction) {
  const value = await nextSequenceValue(SEQUENCES.NEW_CRM_LEAD_SERIAL, transaction);
  return `NCL-${String(value).padStart(6, '0')}`;
}

export class CreateNewCrmLeadService extends BaseHandler {
  async run() {
    const {
      telecallerId,
      leadDate,
      customerName,
      location,
      mobileNumber,
      modelNumber,
      problem,
      telecallerRate,
      adminId,
    } = this.args;
    const transaction = this.dbTransaction;

    const telecaller = await db.AdminUser.findByPk(telecallerId, { transaction });
    if (!telecaller || telecaller.role !== ADMIN_ROLE.TELECALLER) throw new AppError(Errors.TELECALLER_NOT_FOUND);

    const serialNo = await nextSerialNo(transaction);

    const lead = await db.NewCrmLead.create(
      {
        serialNo,
        telecallerId,
        // Defaults to today when not supplied, exactly as the form does.
        leadDate: leadDate ? leadDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
        customerName: String(customerName).trim(),
        location: location?.trim() || null,
        mobileNumber: String(mobileNumber).trim(),
        modelNumber: modelNumber?.trim() || null,
        problem: problem?.trim() || null,
        telecallerRate: telecallerRate ?? null,
        createdBy: adminId ?? null,
      },
      { transaction },
    );

    const created = await db.NewCrmLead.findByPk(lead.id, { include: LEAD_INCLUDES, transaction });

    return { ...getSuccessResponse('Lead created successfully.'), lead: created };
  }
}

export class GetNewCrmLeadsService extends BaseHandler {
  async run() {
    const { page = 1, limit = 50, telecallerId, status, search } = this.args;

    const where = {};
    if (telecallerId) where.telecallerId = telecallerId;
    if (status) where.status = status;
    if (search) {
      const term = `%${String(search).trim()}%`;
      where[Op.or] = [
        { serialNo: { [Op.iLike]: term } },
        { customerName: { [Op.iLike]: term } },
        { mobileNumber: { [Op.iLike]: term } },
        { modelNumber: { [Op.iLike]: term } },
      ];
    }

    const { rows, count } = await db.NewCrmLead.findAndCountAll({
      where,
      include: LEAD_INCLUDES,
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });

    return {
      ...getSuccessResponse('Leads fetched successfully.'),
      leads: rows,
      pagination: getPaginationResponse({ totalCount: count, page, limit, count: rows.length }),
    };
  }
}

/** Full edit — everything except serialNo, which never changes once issued. */
export class UpdateNewCrmLeadService extends BaseHandler {
  async run() {
    const { id, ...updates } = this.args;
    const transaction = this.dbTransaction;

    const lead = await db.NewCrmLead.findByPk(id, { transaction });
    if (!lead) throw new AppError(Errors.NEW_CRM_LEAD_NOT_FOUND);

    if (updates.telecallerId) {
      const telecaller = await db.AdminUser.findByPk(updates.telecallerId, { transaction });
      if (!telecaller || telecaller.role !== ADMIN_ROLE.TELECALLER) throw new AppError(Errors.TELECALLER_NOT_FOUND);
    }

    const patch = {};
    for (const key of [
      'telecallerId',
      'customerName',
      'location',
      'mobileNumber',
      'modelNumber',
      'problem',
      'telecallerRate',
      'status',
    ]) {
      if (updates[key] !== undefined) patch[key] = updates[key];
    }
    if (updates.leadDate !== undefined) patch.leadDate = updates.leadDate.slice(0, 10);
    if (updates.followUpDate !== undefined) patch.followUpDate = updates.followUpDate ? updates.followUpDate.slice(0, 10) : null;

    await lead.update(patch, { transaction });

    const updated = await db.NewCrmLead.findByPk(id, { include: LEAD_INCLUDES, transaction });
    return { ...getSuccessResponse('Lead updated successfully.'), lead: updated };
  }
}

/** Status-only change from the table's Status column — updates in place, never a new row. */
export class UpdateNewCrmLeadStatusService extends BaseHandler {
  async run() {
    const { id, status } = this.args;
    const transaction = this.dbTransaction;

    const lead = await db.NewCrmLead.findByPk(id, { transaction });
    if (!lead) throw new AppError(Errors.NEW_CRM_LEAD_NOT_FOUND);

    await lead.update({ status }, { transaction });
    return { ...getSuccessResponse('Status updated successfully.'), lead };
  }
}

/** Follow-up-date-only change from the table's Follow-up Date column. */
export class UpdateNewCrmLeadFollowUpService extends BaseHandler {
  async run() {
    const { id, followUpDate } = this.args;
    const transaction = this.dbTransaction;

    const lead = await db.NewCrmLead.findByPk(id, { transaction });
    if (!lead) throw new AppError(Errors.NEW_CRM_LEAD_NOT_FOUND);

    await lead.update({ followUpDate: followUpDate ? followUpDate.slice(0, 10) : null }, { transaction });
    return { ...getSuccessResponse('Follow-up date updated successfully.'), lead };
  }
}
