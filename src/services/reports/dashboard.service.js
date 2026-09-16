import { Op } from 'sequelize';

import db from '@src/db/models';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { resolveDateRange } from '@src/libs/dayjs';
import { BaseHandler } from '@src/libs/logicBase';
import { CLOSED_REPAIR_STATUSES, REPAIR_STATUS } from '@src/utils/constants/public.constants';
import { round2, subtractAmounts } from '@src/utils/money.utils';
import { applyDateRangeFilter } from '@src/utils/query.utils';

/**
 * Everything the dashboard needs, in ONE request — the shop opens this screen
 * dozens of times a day and it should never feel slow.
 *
 * Defaults to TODAY (unchanged from before the date filter existed), and
 * everything on the page is anchored to ONE range so the whole screen reads
 * as one consistent answer to "how did this period look" rather than a mix
 * of filtered and unfiltered numbers:
 *
 *   - repair counts, the pipeline breakdown, Recent Repairs, and Pending
 *     Payments are all scoped by `receivedAt` — repairs INTAKEN in the
 *     selected period, and what's owed on them.
 *   - Collection is scoped by `paidAt` — money that actually moved in the
 *     period, which can differ from when the job itself was taken in.
 *
 * Filtering happens entirely in the WHERE clauses below, not by fetching
 * everything and slicing it in JS or on the frontend.
 */
export default class GetDashboardSummaryService extends BaseHandler {
  async run() {
    const { start, end } = resolveDateRange({ preset: this.args.preset ?? 'TODAY', ...this.args });

    const jobWhere = {};
    applyDateRangeFilter(jobWhere, 'receivedAt', start, end);

    const collectionWhere = { isConfirmed: true };
    applyDateRangeFilter(collectionWhere, 'paidAt', start, end);

    const [statusRows, periodCollection, totalRepairs, recentJobs] = await Promise.all([
      db.RepairJob.findAll({
        attributes: ['status', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
        where: jobWhere,
        group: ['status'],
        raw: true,
      }),
      db.RepairLedger.sum('amount', { where: collectionWhere }),
      db.RepairJob.count({ where: jobWhere }),
      db.RepairJob.findAll({
        where: jobWhere,
        include: [
          { model: db.Customer, as: 'customer', attributes: ['id', 'name', 'mobile'] },
          { model: db.Engineer, as: 'engineer', attributes: ['id', 'name'] },
        ],
        order: [['receivedAt', 'DESC']],
        // A wide range (e.g. This Month) can hold far more than the old
        // fixed 10 — kept generous but still capped, so the dashboard never
        // turns into a full repairs list with its own pagination.
        limit: 50,
      }),
    ]);

    const countFor = (status) => Number(statusRows.find((row) => row.status === status)?.count ?? 0);

    // Outstanding money — scoped to the SAME job set as everything else on
    // the page (repairs received in the selected period), not every open
    // job regardless of when it came in.
    const openJobs = await db.RepairJob.findAll({
      attributes: ['id', 'totalAmount'],
      where: { ...jobWhere, status: { [Op.notIn]: CLOSED_REPAIR_STATUSES } },
      raw: true,
    });
    const openIds = openJobs.map((job) => job.id);
    const paidRows = openIds.length
      ? await db.RepairLedger.findAll({
          attributes: ['repairJobId', [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'paid']],
          where: { repairJobId: { [Op.in]: openIds }, isConfirmed: true },
          group: ['repair_job_id'],
          raw: true,
        })
      : [];
    const paidByJob = new Map(paidRows.map((row) => [Number(row.repairJobId), round2(row.paid)]));

    const pendingAmount = round2(
      openJobs.reduce((sum, job) => {
        const balance = subtractAmounts(job.totalAmount, paidByJob.get(job.id) ?? 0);
        return sum + Math.max(balance, 0);
      }, 0),
    );

    // Recent jobs need their own paid figures.
    const recentIds = recentJobs.map((job) => job.id);
    const recentPaidRows = recentIds.length
      ? await db.RepairLedger.findAll({
          attributes: ['repairJobId', [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'paid']],
          where: { repairJobId: { [Op.in]: recentIds }, isConfirmed: true },
          group: ['repair_job_id'],
          raw: true,
        })
      : [];
    const recentPaidByJob = new Map(recentPaidRows.map((row) => [Number(row.repairJobId), round2(row.paid)]));

    // "Still on the pipeline" — everything between intake and job-done.
    const inRepairCount =
      countFor(REPAIR_STATUS.QUOTATION_GIVEN) +
      countFor(REPAIR_STATUS.CUSTOMER_APPROVAL) +
      countFor(REPAIR_STATUS.OUTDOOR_OUT) +
      countFor(REPAIR_STATUS.OUTDOOR_IN) +
      countFor(REPAIR_STATUS.IN_REPAIR);

    return {
      ...getSuccessResponse('Dashboard summary fetched successfully.'),
      summary: {
        totalRepairs,
        pending: countFor(REPAIR_STATUS.PENDING),
        inRepair: inRepairCount,
        jobDone: countFor(REPAIR_STATUS.JOB_DONE),
        delivered: countFor(REPAIR_STATUS.DELIVERED),
        // Sent out to another shop/technician, and how many of those have
        // come back — tracked separately since "in repair" alone hides
        // whether a phone is actually on-site or not.
        outdoorOut: countFor(REPAIR_STATUS.OUTDOOR_OUT),
        outdoorIn: countFor(REPAIR_STATUS.OUTDOOR_IN),
        // Field name kept as `todayCollection` for backward compatibility —
        // it now means "collected in the selected period", which is TODAY
        // by default, exactly as it always meant before this filter existed.
        todayCollection: round2(periodCollection || 0),
        pendingPayments: pendingAmount,
      },
      statusBreakdown: Object.values(REPAIR_STATUS).reduce((acc, status) => {
        acc[status] = countFor(status);
        return acc;
      }, {}),
      recentRepairs: recentJobs.map((job) => {
        const plain = job.toJSON();
        const totalAmount = round2(plain.totalAmount);
        const totalPaid = recentPaidByJob.get(plain.id) ?? 0;
        return {
          id: plain.id,
          receiptNumber: plain.receiptNumber,
          customer: plain.customer,
          engineer: plain.engineer,
          brand: plain.brand,
          modelNumber: plain.modelNumber,
          customerComplaint: plain.customerComplaint,
          status: plain.status,
          receivedAt: plain.receivedAt,
          // The quote given at the counter — clickable through to the
          // itemised quotation on the repair's own page, not shown as a
          // bare total here.
          estimatedCost: plain.estimatedCost === null ? null : round2(plain.estimatedCost),
          totalAmount,
          totalPaid,
          balance: subtractAmounts(totalAmount, totalPaid),
        };
      }),
    };
  }
}
