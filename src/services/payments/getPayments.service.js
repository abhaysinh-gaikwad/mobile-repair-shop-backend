import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getRepairMoneySummary } from '@src/helpers/repair.helpers';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { round2 } from '@src/utils/money.utils';

/** The ledger for one repair job, oldest first, with reversal state resolved. */
export default class GetPaymentsService extends BaseHandler {
  async run() {
    const { repairJobId } = this.args;

    const repairJob = await db.RepairJob.findByPk(repairJobId);
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    const entries = await db.RepairLedger.findAll({
      where: { repairJobId },
      include: [{ model: db.AdminUser, as: 'receiver', attributes: ['id', 'name'] }],
      order: [['paidAt', 'ASC']],
    });

    // Entries that have since been reversed — the UI strikes these through
    // and hides their Reverse action.
    const reversedIds = new Set(entries.filter((e) => e.reversesEntryId).map((e) => Number(e.reversesEntryId)));

    const money = await getRepairMoneySummary(repairJobId);

    return {
      ...getSuccessResponse('Payments fetched successfully.'),
      entries: entries.map((entry) => {
        const plain = entry.toJSON();
        return {
          ...plain,
          amount: round2(plain.amount),
          jobTotalAfter: round2(plain.jobTotalAfter),
          jobPaidAfter: round2(plain.jobPaidAfter),
          jobBalanceAfter: round2(plain.jobBalanceAfter),
          isReversed: reversedIds.has(Number(plain.id)),
        };
      }),
      ...money,
    };
  }
}
