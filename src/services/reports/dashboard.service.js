import { Op } from 'sequelize';

import db from '@src/db/models';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { shopDayRange } from '@src/libs/dayjs';
import { BaseHandler } from '@src/libs/logicBase';
import { CLOSED_REPAIR_STATUSES, REPAIR_STATUS } from '@src/utils/constants/public.constants';
import { round2, subtractAmounts } from '@src/utils/money.utils';

/**
 * Everything the dashboard needs, in ONE request — the shop opens this screen
 * dozens of times a day and it should never feel slow.
 */
export default class GetDashboardSummaryService extends BaseHandler {
  async run() {
    const { start, end } = shopDayRange();

    const [statusRows, todayCollection, totalRepairs, recentJobs] = await Promise.all([
      db.RepairJob.findAll({
        attributes: ['status', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
        group: ['status'],
        raw: true,
      }),
      db.RepairLedger.sum('amount', { where: { paidAt: { [Op.between]: [start, end] } } }),
      db.RepairJob.count(),
      db.RepairJob.findAll({
        include: [
          { model: db.Customer, as: 'customer', attributes: ['id', 'name', 'mobile'] },
          { model: db.Engineer, as: 'engineer', attributes: ['id', 'name'] },
        ],
        order: [['receivedAt', 'DESC']],
        limit: 10,
      }),
    ]);

    const countFor = (status) => Number(statusRows.find((row) => row.status === status)?.count ?? 0);

    // Outstanding money across every open job.
    const openJobs = await db.RepairJob.findAll({
      attributes: ['id', 'totalAmount'],
      where: { status: { [Op.notIn]: CLOSED_REPAIR_STATUSES } },
      raw: true,
    });
    const openIds = openJobs.map((job) => job.id);
    const paidRows = openIds.length
      ? await db.RepairLedger.findAll({
          attributes: ['repairJobId', [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'paid']],
          where: { repairJobId: { [Op.in]: openIds } },
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
          where: { repairJobId: { [Op.in]: recentIds } },
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
        todayCollection: round2(todayCollection || 0),
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
          status: plain.status,
          receivedAt: plain.receivedAt,
          totalAmount,
          totalPaid,
          balance: subtractAmounts(totalAmount, totalPaid),
        };
      }),
    };
  }
}
