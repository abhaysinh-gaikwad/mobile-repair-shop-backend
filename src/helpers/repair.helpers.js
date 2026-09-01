import db from '@src/db/models';
import { multiplyAmount, round2, subtractAmounts, toAmount } from '@src/utils/money.utils';
import { SEQUENCES, SETTING_KEYS } from '@src/utils/constants/public.constants';

/**
 * Read a shop setting, falling back to `fallback` when unset.
 */
export async function getSetting(key, fallback = null, transaction = undefined) {
  const setting = await db.ShopSetting.findOne({ where: { key }, transaction });
  // An EMPTY string counts as unset, not as a valid value. Without this a
  // blanked-out `receipt_prefix` would silently produce receipts like "00023"
  // instead of "R-00023".
  const value = setting?.value;
  return value === undefined || value === null || String(value).trim() === '' ? fallback : value;
}

/**
 * Pull the next value from a Postgres SEQUENCE.
 *
 * `nextval` is atomic and never returns a value twice, even under concurrent
 * inserts — this is why receipt/entry numbers use a sequence rather than
 * COUNT(*)+1 or catch-unique-violation-and-retry.
 *
 * Note it does NOT roll back with the surrounding transaction: a failed
 * create burns a number and leaves a gap. That is the intended trade-off —
 * a gap is harmless, a duplicated receipt number on a customer document is not.
 */
export async function nextSequenceValue(sequenceName, transaction) {
  const [rows] = await db.sequelize.query(`SELECT nextval('public.${sequenceName}') AS value`, { transaction });
  return Number(rows[0].value);
}

/**
 * Next receipt number, e.g. "R-00001" — or just "00001" if the shop has
 * deliberately cleared `receipt_prefix` in Settings.
 *
 * Reads the setting row directly rather than through `getSetting()`: that
 * helper treats an empty string as "unset" (falls back to the default) for
 * every OTHER setting, which is the right guard everywhere else but wrong
 * here — a shop clearing the prefix field is a deliberate choice to drop
 * it, not an accident to protect against. Only a genuinely missing row
 * (never configured at all) falls back to "R-".
 */
export async function generateReceiptNumber(transaction) {
  const setting = await db.ShopSetting.findOne({ where: { key: SETTING_KEYS.RECEIPT_PREFIX }, transaction });
  // Trimmed: a stray space typed into the setting would otherwise be baked
  // into every receipt number and into the ledger snapshots that copy it.
  const prefix = String(setting?.value ?? 'R-').trim();
  const value = await nextSequenceValue(SEQUENCES.RECEIPT_NUMBER, transaction);
  return `${prefix}${String(value).padStart(5, '0')}`;
}

/** Next cash-memo entry number, e.g. "L-000001". */
export async function generateLedgerEntryNo(transaction) {
  const value = await nextSequenceValue(SEQUENCES.LEDGER_ENTRY_NUMBER, transaction);
  return `L-${String(value).padStart(6, '0')}`;
}

/**
 * Recompute and persist a job's total (parts + labour).
 *
 * Always run this inside the same transaction as whatever changed the parts
 * or the labour charge, so the stored total can never drift from its inputs.
 */
export async function recalculateRepairTotal(repairJobId, transaction) {
  const repairJob = await db.RepairJob.findByPk(repairJobId, { transaction });
  if (!repairJob) return null;

  const parts = await db.RepairPart.findAll({ where: { repairJobId }, transaction });
  const partsTotal = parts.reduce((sum, part) => round2(sum + toAmount(part.totalPrice)), 0);
  const totalAmount = round2(partsTotal + toAmount(repairJob.labourCharge));

  await repairJob.update({ totalAmount }, { transaction });
  return totalAmount;
}

/**
 * Money summary for a job.
 *
 * `totalPaid` is a plain SUM over the ledger: because reversals are stored as
 * negative rows, they net out automatically and no filtering is required.
 */
export async function getRepairMoneySummary(repairJobId, transaction) {
  const repairJob = await db.RepairJob.findByPk(repairJobId, { transaction });
  if (!repairJob) return null;

  const paidRaw = await db.RepairLedger.sum('amount', { where: { repairJobId }, transaction });

  // Cash vs online, so the shop can see "Total ₹2,000 — Cash ₹1,000, Online
  // ₹1,000" when a customer splits payment across methods. Every non-CASH
  // method (including retired ones like PHONEPE/UPI) counts as "online" here.
  const cashRaw = await db.RepairLedger.sum('amount', {
    where: { repairJobId, paymentMethod: 'CASH' },
    transaction,
  });

  // Three different numbers, deliberately kept apart:
  //   estimatedCost — the quotation given at the counter
  //   partsTotal    — parts + labour actually recorded
  //   finalAmount   — what the customer is actually charged
  //
  // When the shop has set a final amount it WINS, because that is the figure
  // agreed with the customer. Until then the parts total stands in, so
  // existing jobs (and every historical balance) behave exactly as before.
  const partsTotal = round2(repairJob.totalAmount);
  const hasFinal = repairJob.finalAmount !== null && repairJob.finalAmount !== undefined;
  const finalAmount = hasFinal ? round2(repairJob.finalAmount) : null;
  const totalAmount = hasFinal ? finalAmount : partsTotal;
  const totalPaid = round2(paidRaw || 0);
  const paidByCash = round2(cashRaw || 0);
  const paidByOnline = subtractAmounts(totalPaid, paidByCash);

  return {
    totalAmount,
    partsTotal,
    finalAmount,
    estimatedCost: repairJob.estimatedCost === null ? null : round2(repairJob.estimatedCost),
    totalPaid,
    paidByCash,
    paidByOnline,
    balance: subtractAmounts(totalAmount, totalPaid),
  };
}

/** Line total for a part row. */
export const calculatePartTotal = (unitPrice, quantity) => multiplyAmount(unitPrice, quantity);

/** Record a status transition. Call inside the same transaction as the change. */
export async function recordStatusChange({ repairJobId, fromStatus, toStatus, note, changedBy }, transaction) {
  return db.RepairStatusHistory.create(
    { repairJobId, fromStatus, toStatus, note: note ?? null, changedBy: changedBy ?? null },
    { transaction },
  );
}
