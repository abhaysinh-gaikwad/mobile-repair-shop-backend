import { Op } from 'sequelize';

import db from '@src/db/models';
import { getPaginationResponse, getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { CLOSED_REPAIR_STATUSES } from '@src/utils/constants/public.constants';
import { round2, subtractAmounts } from '@src/utils/money.utils';
import { applyDateRangeFilter } from '@src/utils/query.utils';

/**
 * Repair list for the All Repairs screen and the global search box.
 *
 * One `search` term matches receipt number, customer name/mobile, IMEI or
 * model — the shop should never have to pick which field they are searching.
 */
export default class GetRepairsService extends BaseHandler {
  async run() {
    const {
      page = 1,
      limit = 20,
      status,
      engineerId,
      leadSource,
      leadHandlerId,
      customerId,
      search,
      dateFrom,
      dateTo,
      paymentStatus,
      active,
    } = this.args;

    const where = {};
    if (status) where.status = status;
    if (engineerId) where.engineerId = engineerId;
    if (leadSource) where.leadSource = leadSource;
    if (leadHandlerId) where.leadHandlerId = leadHandlerId;
    if (customerId) where.customerId = customerId;

    // `active=true` means "still on the workbench" — everything not delivered
    // or cancelled.
    if (active === true || active === 'true') {
      where.status = { [Op.notIn]: CLOSED_REPAIR_STATUSES };
    }

    applyDateRangeFilter(where, 'receivedAt', dateFrom, dateTo);

    if (search) {
      const term = `%${String(search).trim()}%`;
      // `$customer.x$` reaches into the joined table, so one search term can
      // match either the job or its customer in a single OR.
      where[Op.or] = [
        { receiptNumber: { [Op.iLike]: term } },
        { imei: { [Op.iLike]: term } },
        { modelNumber: { [Op.iLike]: term } },
        { brand: { [Op.iLike]: term } },
        { '$customer.name$': { [Op.iLike]: term } },
        { '$customer.mobile$': { [Op.iLike]: term } },
      ];
    }

    const { rows, count } = await db.RepairJob.findAndCountAll({
      where,
      include: [
        { model: db.Customer, as: 'customer' },
        { model: db.Engineer, as: 'engineer', attributes: ['id', 'name'] },
      ],
      order: [['receivedAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
      subQuery: false,
    });

    // Paid-to-date for the listed jobs, in one grouped query rather than
    // N+1 sums.
    const jobIds = rows.map((row) => row.id);
    const paidRows = jobIds.length
      ? await db.RepairLedger.findAll({
          attributes: ['repairJobId', [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'paid']],
          where: { repairJobId: { [Op.in]: jobIds }, isConfirmed: true },
          group: ['repair_job_id'],
          raw: true,
        })
      : [];

    const paidByJob = new Map(paidRows.map((row) => [Number(row.repairJobId), round2(row.paid)]));

    // Every quote given for these jobs, numeric or text-only — one grouped
    // query, not N+1, and not the estimatedCost total: a text-only row
    // ("screen replacement, price TBD") is a real quotation with no figure,
    // and must still be listed, not silently dropped for lacking an amount.
    const estimateRows = jobIds.length
      ? await db.RepairEstimate.findAll({
          where: { repairJobId: { [Op.in]: jobIds } },
          order: [['createdAt', 'ASC']],
          raw: true,
        })
      : [];
    const estimatesByJob = new Map();
    for (const row of estimateRows) {
      const list = estimatesByJob.get(row.repairJobId) ?? [];
      list.push({ id: row.id, amount: round2(row.amount), note: row.note, createdAt: row.createdAt });
      estimatesByJob.set(row.repairJobId, list);
    }

    let repairJobs = rows.map((row) => {
      const plain = row.toJSON();
      const totalAmount = round2(plain.totalAmount);
      const totalPaid = paidByJob.get(plain.id) ?? 0;

      return {
        id: plain.id,
        receiptNumber: plain.receiptNumber,
        status: plain.status,
        brand: plain.brand,
        modelNumber: plain.modelNumber,
        imei: plain.imei,
        customer: plain.customer
          ? {
              id: plain.customer.id,
              // Per-job snapshot wins — one shared mobile number can belong
              // to several people (see repairJob.model.js).
              name: plain.customerName ?? plain.customer.name,
              mobile: plain.customer.mobile,
            }
          : null,
        engineer: plain.engineer ? { id: plain.engineer.id, name: plain.engineer.name } : null,
        leadSource: plain.leadSource,
        customerComplaint: plain.customerComplaint,
        receivedAt: plain.receivedAt,
        deliveredAt: plain.deliveredAt,
        // The quote given at the counter — the SUM of this job's itemised
        // estimate rows. Null (not 0) when nothing was quoted yet, same
        // meaning as everywhere else this column is read.
        estimatedCost: plain.estimatedCost === null ? null : round2(plain.estimatedCost),
        // Every individual quote for this job, numeric or text — see the
        // note above. Never combined into one total here; each stays its
        // own row, same as the repair's own Estimated Costs section.
        estimates: estimatesByJob.get(plain.id) ?? [],
        totalAmount,
        totalPaid,
        balance: subtractAmounts(totalAmount, totalPaid),
      };
    });

    // Balance is derived, so this filter is applied after the aggregate.
    if (paymentStatus === 'pending') repairJobs = repairJobs.filter((job) => job.balance > 0);
    if (paymentStatus === 'paid') repairJobs = repairJobs.filter((job) => job.balance <= 0);

    return {
      ...getSuccessResponse('Repair jobs fetched successfully.'),
      repairJobs,
      pagination: getPaginationResponse({ totalCount: count, page, limit, count: repairJobs.length }),
    };
  }
}
