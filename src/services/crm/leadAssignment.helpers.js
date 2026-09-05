import { Op } from 'sequelize';

import db from '@src/db/models';
import {
  ADMIN_ROLE,
  CLOSED_LEAD_STATUSES,
  STAFF_AVAILABILITY,
} from '@src/utils/constants/public.constants';

/** How an assignment was decided — stored on every lead_assignments row. */
export const ASSIGNMENT_REASON = Object.freeze({
  ROUND_ROBIN: 'ROUND_ROBIN',
  STICKY: 'STICKY',
  MANUAL: 'MANUAL',
});

/** The single row the Round Robin cursor lives in. */
const ROUND_ROBIN_STATE_ID = 1;

/**
 * Reduces any way a mobile number might be written to the last 10 digits.
 *
 * +91 98765 43210, 09876543210, 91-9876543210 and 9876543210 are one person.
 * Without this, the same customer messaging from the same phone would look
 * like a new lead each time and be handed to a different telecaller — the
 * exact thing sticky ownership exists to prevent.
 *
 * Returns null when there aren't 10 digits to work with, which correctly
 * disables duplicate matching rather than matching everyone with no number
 * to each other.
 */
export const normalizeMobile = (mobile) => {
  const digits = String(mobile ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
};

/**
 * Telecallers eligible for the rotation, in a STABLE order (id ASC).
 *
 * Stable ordering is what makes "strict round robin" meaningful: the cursor
 * stores a user id, and the next assignment is the next id in this list. If
 * the order changed between calls (e.g. by name, and someone got renamed) the
 * rotation would jump around.
 *
 * Eligible = TELECALLER + can log in + not on leave/unavailable.
 */
export const getEligibleTelecallers = async (transaction) =>
  db.AdminUser.findAll({
    where: {
      role: ADMIN_ROLE.TELECALLER,
      isActive: true,
      availability: STAFF_AVAILABILITY.AVAILABLE,
    },
    order: [['id', 'ASC']],
    transaction,
  });

/**
 * Picks the next telecaller and advances the stored cursor.
 *
 * MUST be called inside a transaction. It takes a row-level lock on the
 * single round_robin_state row (`SELECT ... FOR UPDATE`), so two leads
 * arriving at the same instant are serialized by Postgres itself: the second
 * one blocks until the first has committed its new cursor, and therefore
 * reads the updated value rather than the stale one. Without the lock both
 * would read the same `lastAssignedAdminUserId` and land on the same person —
 * precisely the race this has to be safe against.
 *
 * Returns null when there are no eligible telecallers at all; the caller
 * leaves the lead unassigned rather than inventing an owner.
 */
export const pickNextTelecaller = async (transaction) => {
  const eligible = await getEligibleTelecallers(transaction);
  if (!eligible.length) return null;

  const [state] = await db.RoundRobinState.findAll({
    where: { id: ROUND_ROBIN_STATE_ID },
    lock: transaction.LOCK.UPDATE,
    transaction,
  });

  const lastId = state?.lastAssignedAdminUserId ?? null;
  const lastIndex = eligible.findIndex((user) => user.id === lastId);

  // findIndex returning -1 covers both "nothing assigned yet" and "the last
  // person assigned is no longer eligible" (deactivated, or on leave). Both
  // correctly restart the rotation at the first eligible telecaller, so a
  // departing employee can never stall the rotation.
  const next = eligible[(lastIndex + 1) % eligible.length];

  if (state) {
    await state.update({ lastAssignedAdminUserId: next.id }, { transaction });
  } else {
    await db.RoundRobinState.create(
      { id: ROUND_ROBIN_STATE_ID, lastAssignedAdminUserId: next.id },
      { transaction },
    );
  }

  return next;
};

/**
 * Sticky ownership: if this mobile number has been seen before, the same
 * telecaller keeps it.
 *
 * Looks at the most recent lead from that number regardless of status. An
 * OPEN one is returned so the caller can fold the new enquiry into it instead
 * of creating a duplicate; a CLOSED one still hands back its owner, so a
 * customer who comes back months later reaches the person who already knows
 * them — and, importantly, without consuming a Round Robin turn.
 */
export const findExistingLeadForMobile = async (mobileNormalized, transaction) => {
  if (!mobileNormalized) return { openLead: null, lastLead: null };

  const leads = await db.Lead.findAll({
    where: { mobileNormalized },
    order: [['createdAt', 'DESC']],
    limit: 20,
    transaction,
  });

  return {
    openLead: leads.find((lead) => !CLOSED_LEAD_STATUSES.includes(lead.status)) ?? null,
    lastLead: leads[0] ?? null,
  };
};

/** Records one assignment. Append-only — never updates a previous row. */
export const recordAssignment = async (
  { leadId, fromAdminUserId, toAdminUserId, reason, changedBy, note },
  transaction,
) =>
  db.LeadAssignment.create(
    { leadId, fromAdminUserId: fromAdminUserId ?? null, toAdminUserId: toAdminUserId ?? null, reason, changedBy: changedBy ?? null, note: note ?? null },
    { transaction },
  );

/** True when the given user id is still eligible to receive leads. */
export const isEligibleTelecaller = async (adminUserId, transaction) => {
  if (!adminUserId) return false;
  const user = await db.AdminUser.findByPk(adminUserId, { transaction });
  return Boolean(
    user &&
      user.role === ADMIN_ROLE.TELECALLER &&
      user.isActive &&
      user.availability === STAFF_AVAILABILITY.AVAILABLE,
  );
};

export { Op, ROUND_ROBIN_STATE_ID };
