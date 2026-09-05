import { Op } from 'sequelize';

import db from '@src/db/models';
import { getPaginationResponse, getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { resolveDateRange, shopDayRange } from '@src/libs/dayjs';
import { CLOSED_REPAIR_STATUSES, PAYMENT_METHOD } from '@src/utils/constants/public.constants';
import { round2, subtractAmounts } from '@src/utils/money.utils';
import { applyDateRangeFilter } from '@src/utils/query.utils';

/**
 * Global Cash Memo — the shop's notebook, across every repair job.
 *
 * This module is a pure QUERY SURFACE over `repair_ledger`. It never writes,
 * and there is no second set of books: payments belong to repair jobs, while
 * the cash memo is the global view of them.
 *
 * Every total here is a plain SUM(amount). Reversals are stored as negative
 * rows, so they net out automatically — no filtering, no special cases.
 */

export class GetCashMemoService extends BaseHandler {
  async run() {
    const { page = 1, limit = 50, paymentMethod, entryType, source, search } = this.args;

    const where = {};
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (entryType) where.entryType = entryType;
    if (source) where.source = source;

    // Presets ("This Month") resolve in the shop's timezone; explicit
    // from/to still work for a custom range.
    const { start, end } = resolveDateRange(this.args);
    if (start || end) applyDateRangeFilter(where, 'paidAt', start, end);

    if (search) {
      const term = `%${String(search).trim()}%`;
      // Receipt number and customer name are snapshotted onto the row, so
      // searching the cash memo needs no joins.
      // `description` and `reference` are how a MANUAL entry is identified —
      // it has no receipt number to search on, so without these the entries
      // this search is most likely to be used for would be unfindable.
      // iLike against a NULL column simply doesn't match, so repair-linked
      // rows are unaffected.
      where[Op.or] = [
        { receiptNumber: { [Op.iLike]: term } },
        { customerName: { [Op.iLike]: term } },
        { customerMobile: { [Op.iLike]: term } },
        { entryNo: { [Op.iLike]: term } },
        { description: { [Op.iLike]: term } },
        { reference: { [Op.iLike]: term } },
      ];
    }

    const { rows, count } = await db.RepairLedger.findAndCountAll({
      where,
      include: [{ model: db.AdminUser, as: 'receiver', attributes: ['id', 'name'] }],
      order: [['paidAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    // Which of these entries have been reversed, so the UI can strike them out.
    const ids = rows.map((row) => Number(row.id));
    const reversals = ids.length
      ? await db.RepairLedger.findAll({
          attributes: ['reversesEntryId'],
          where: { reversesEntryId: { [Op.in]: ids } },
          raw: true,
        })
      : [];
    const reversedIds = new Set(reversals.map((row) => Number(row.reversesEntryId)));

    // Sum across the WHOLE filtered set, not just this page.
    const filteredTotal = await db.RepairLedger.sum('amount', { where });

    return {
      ...getSuccessResponse('Cash memo fetched successfully.'),
      entries: rows.map((row) => {
        const plain = row.toJSON();
        return {
          ...plain,
          amount: round2(plain.amount),
          jobBalanceAfter: round2(plain.jobBalanceAfter),
          isReversed: reversedIds.has(Number(plain.id)),
        };
      }),
      filteredTotal: round2(filteredTotal || 0),
      pagination: getPaginationResponse({ totalCount: count, page, limit, count: rows.length }),
    };
  }
}

/** Per-method collection totals for a single day (or an explicit range). */
export class GetDailyCollectionService extends BaseHandler {
  async run() {
    const { date, preset, dateFrom, dateTo, paymentMethod } = this.args;

    let where = {};
    if (preset || dateFrom || dateTo) {
      const { start, end } = resolveDateRange({ preset, dateFrom, dateTo });
      if (start || end) applyDateRangeFilter(where, 'paidAt', start, end);
    } else {
      // Default: a single day. "Today" must mean today in the shop's
      // timezone, not UTC.
      const { start, end } = shopDayRange(date);
      where = { paidAt: { [Op.between]: [start, end] } };
    }

    if (paymentMethod) where.paymentMethod = paymentMethod;

    const grouped = await db.RepairLedger.findAll({
      attributes: [
        'paymentMethod',
        [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'total'],
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'entries'],
      ],
      where,
      group: ['payment_method'],
      raw: true,
    });

    // Always report every method, including the ones with no takings today —
    // a missing row would read as "not counted" rather than "zero".
    const byMethod = Object.values(PAYMENT_METHOD).reduce((acc, method) => {
      const found = grouped.find((row) => row.paymentMethod === method);
      acc[method] = { total: round2(found?.total ?? 0), entries: Number(found?.entries ?? 0) };
      return acc;
    }, {});

    const total = round2(grouped.reduce((sum, row) => sum + Number(row.total), 0));
    const entryCount = grouped.reduce((sum, row) => sum + Number(row.entries), 0);

    return {
      ...getSuccessResponse('Daily collection fetched successfully.'),
      byMethod,
      total,
      entryCount,
    };
  }
}

/** Every job still owing money. */
export class GetPendingPaymentsService extends BaseHandler {
  async run() {
    const { includeClosed = false } = this.args;

    const where = {};
    if (!includeClosed) where.status = { [Op.notIn]: CLOSED_REPAIR_STATUSES };

    const repairJobs = await db.RepairJob.findAll({
      where,
      include: [
        { model: db.Customer, as: 'customer', attributes: ['id', 'name', 'mobile'] },
        { model: db.Engineer, as: 'engineer', attributes: ['id', 'name'] },
      ],
      order: [['receivedAt', 'ASC']],
    });

    const jobIds = repairJobs.map((job) => job.id);
    const paidRows = jobIds.length
      ? await db.RepairLedger.findAll({
          attributes: ['repairJobId', [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'paid']],
          where: { repairJobId: { [Op.in]: jobIds } },
          group: ['repair_job_id'],
          raw: true,
        })
      : [];
    const paidByJob = new Map(paidRows.map((row) => [Number(row.repairJobId), round2(row.paid)]));

    const now = Date.now();
    const pending = repairJobs
      .map((job) => {
        const plain = job.toJSON();
        const totalAmount = round2(plain.totalAmount);
        const totalPaid = paidByJob.get(plain.id) ?? 0;
        return {
          id: plain.id,
          receiptNumber: plain.receiptNumber,
          customer: plain.customer,
          engineer: plain.engineer,
          brand: plain.brand,
          modelNumber: plain.modelNumber,
          status: plain.status,
          receivedAt: plain.receivedAt,
          ageDays: Math.floor((now - new Date(plain.receivedAt).getTime()) / 86400000),
          totalAmount,
          totalPaid,
          balance: subtractAmounts(totalAmount, totalPaid),
        };
      })
      .filter((job) => job.balance > 0)
      .sort((a, b) => b.balance - a.balance);

    return {
      ...getSuccessResponse('Pending payments fetched successfully.'),
      repairJobs: pending,
      totalOutstanding: round2(pending.reduce((sum, job) => sum + job.balance, 0)),
      count: pending.length,
    };
  }
}
