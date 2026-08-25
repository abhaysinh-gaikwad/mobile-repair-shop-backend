import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getRepairMoneySummary } from '@src/helpers/repair.helpers';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { round2 } from '@src/utils/money.utils';

/**
 * The full aggregate behind the Repair Details page — everything about one
 * job in a single request.
 */
export default class GetRepairService extends BaseHandler {
  async run() {
    const { id, receiptNumber } = this.args;

    const where = id ? { id } : { receiptNumber };

    const repairJob = await db.RepairJob.findOne({
      where,
      include: [
        { model: db.Customer, as: 'customer' },
        { model: db.Engineer, as: 'engineer' },
        { model: db.LeadHandler, as: 'leadHandler' },
        { model: db.RepairPart, as: 'parts' },
        {
          model: db.RepairLedger,
          as: 'ledgerEntries',
          include: [{ model: db.AdminUser, as: 'receiver', attributes: ['id', 'name'] }],
        },
        { model: db.RepairCallLog, as: 'callLogs' },
        { model: db.RepairEstimate, as: 'estimates' },
        { model: db.RepairStatusHistory, as: 'statusHistory' },
        // Repeat-repair lineage, shown as a link back to the earlier job.
        {
          model: db.RepairJob,
          as: 'previousRepair',
          attributes: ['id', 'receiptNumber', 'customerComplaint', 'status', 'receivedAt'],
        },
      ],
      order: [
        [{ model: db.RepairPart, as: 'parts' }, 'id', 'ASC'],
        [{ model: db.RepairLedger, as: 'ledgerEntries' }, 'paidAt', 'ASC'],
        [{ model: db.RepairCallLog, as: 'callLogs' }, 'calledAt', 'DESC'],
        [{ model: db.RepairEstimate, as: 'estimates' }, 'createdAt', 'DESC'],
        [{ model: db.RepairStatusHistory, as: 'statusHistory' }, 'createdAt', 'ASC'],
      ],
    });

    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    const money = await getRepairMoneySummary(repairJob.id);

    // Which entries have already been reversed — the UI strikes these through
    // and hides their Reverse action.
    const reversedIds = new Set(
      repairJob.ledgerEntries.filter((entry) => entry.reversesEntryId).map((entry) => Number(entry.reversesEntryId)),
    );

    const plain = repairJob.toJSON();

    // Later repairs raised because THIS phone came back again.
    const repeatRepairs = await db.RepairJob.findAll({
      where: { previousRepairJobId: repairJob.id },
      attributes: ['id', 'receiptNumber', 'customerComplaint', 'status', 'receivedAt'],
      order: [['receivedAt', 'ASC']],
    });

    // Whether a credential exists — checked against the actual column, but
    // fetched as a boolean in SQL so the ciphertext never enters the process.
    const [[unlockRow]] = await db.sequelize.query(
      'SELECT device_unlock_secret IS NOT NULL AS has_unlock FROM public.repair_jobs WHERE id = :id',
      { replacements: { id: repairJob.id } },
    );

    // Belt and braces: the default scope already excludes it.
    delete plain.deviceUnlockSecret;

    return {
      ...getSuccessResponse('Repair job fetched successfully.'),
      repairJob: {
        ...plain,
        hasDeviceUnlock: Boolean(unlockRow?.has_unlock),
        repeatRepairs,
        estimatedCost: plain.estimatedCost === null ? null : round2(plain.estimatedCost),
        labourCharge: round2(plain.labourCharge),
        parts: plain.parts.map((part) => ({
          ...part,
          unitPrice: round2(part.unitPrice),
          totalPrice: round2(part.totalPrice),
        })),
        estimates: plain.estimates.map((estimate) => ({ ...estimate, amount: round2(estimate.amount) })),
        ledgerEntries: plain.ledgerEntries.map((entry) => ({
          ...entry,
          amount: round2(entry.amount),
          jobTotalAfter: round2(entry.jobTotalAfter),
          jobPaidAfter: round2(entry.jobPaidAfter),
          jobBalanceAfter: round2(entry.jobBalanceAfter),
          isReversed: reversedIds.has(Number(entry.id)),
        })),
        ...money,
      },
    };
  }
}
