import { Op } from 'sequelize';

import db from '@src/db/models';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { resolveDateRange } from '@src/libs/dayjs';
import { BaseHandler } from '@src/libs/logicBase';
import {
  CLOSED_REPAIR_STATUSES,
  EXPENSE_CATEGORY,
  PAYMENT_METHOD,
  REPAIR_STATUS,
} from '@src/utils/constants/public.constants';
import { round2, subtractAmounts } from '@src/utils/money.utils';

/**
 * Reports: grouped counts and sums over a date range.
 *
 * Each report takes only the filters that actually matter to it — there is no
 * single universal filter object, because "payment method" is meaningless on
 * an engineer report and "repair status" is meaningless on a cash report.
 *
 * All date boundaries come from `resolveDateRange`, which computes them in the
 * shop's timezone (Asia/Kolkata), so "This Month" is the shop's calendar month.
 */

/** Build a where-clause date filter from a preset or explicit from/to. */
const dateWhere = (args, field = 'receivedAt') => {
  const { start, end } = resolveDateRange(args);
  if (!start && !end) return {};
  if (start && end) return { [field]: { [Op.between]: [start, end] } };
  if (start) return { [field]: { [Op.gte]: start } };
  return { [field]: { [Op.lte]: end } };
};

/** Paid-to-date per job, in one grouped query rather than N+1 sums. */
const paidByJobMap = async (jobIds) => {
  if (!jobIds.length) return new Map();
  const rows = await db.RepairLedger.findAll({
    attributes: ['repairJobId', [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'paid']],
    where: { repairJobId: { [Op.in]: jobIds } },
    group: ['repair_job_id'],
    raw: true,
  });
  return new Map(rows.map((row) => [Number(row.repairJobId), round2(row.paid)]));
};

/**
 * Repair report — Date + Status + Engineer.
 * Answers: how many repaired, delivered, pending, in repair.
 */
export class GetRepairSummaryReportService extends BaseHandler {
  async run() {
    const { status, engineerId } = this.args;

    const where = { ...dateWhere(this.args) };
    if (status) where.status = status;
    if (engineerId) where.engineerId = engineerId;

    const rows = await db.RepairJob.findAll({
      attributes: [
        'status',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count'],
        [db.sequelize.fn('SUM', db.sequelize.col('total_amount')), 'totalValue'],
      ],
      where,
      group: ['status'],
      raw: true,
    });

    const countFor = (value) => Number(rows.find((row) => row.status === value)?.count ?? 0);

    const byStatus = Object.values(REPAIR_STATUS).reduce((acc, value) => {
      const found = rows.find((row) => row.status === value);
      acc[value] = { count: Number(found?.count ?? 0), totalValue: round2(found?.totalValue ?? 0) };
      return acc;
    }, {});

    const totalRepairs = rows.reduce((sum, row) => sum + Number(row.count), 0);

    // Money actually collected against the jobs in this window.
    const jobs = await db.RepairJob.findAll({ attributes: ['id', 'totalAmount'], where, raw: true });
    const paid = await paidByJobMap(jobs.map((job) => job.id));
    const totalCollected = round2(jobs.reduce((sum, job) => sum + (paid.get(job.id) ?? 0), 0));
    const totalValue = round2(jobs.reduce((sum, job) => sum + round2(job.totalAmount), 0));

    return {
      ...getSuccessResponse('Repair summary fetched successfully.'),
      byStatus,
      summary: {
        totalRepairs,
        delivered: countFor(REPAIR_STATUS.DELIVERED),
        jobDone: countFor(REPAIR_STATUS.JOB_DONE),
        inRepair:
          countFor(REPAIR_STATUS.QUOTATION_GIVEN) +
          countFor(REPAIR_STATUS.CUSTOMER_APPROVAL) +
          countFor(REPAIR_STATUS.OUTDOOR_OUT) +
          countFor(REPAIR_STATUS.OUTDOOR_IN) +
          countFor(REPAIR_STATUS.IN_REPAIR),
        pending: countFor(REPAIR_STATUS.PENDING),
        totalValue,
        totalCollected,
        totalOutstanding: subtractAmounts(totalValue, totalCollected),
      },
    };
  }
}

/**
 * Delivery report — Date + Engineer + Status.
 * A row-level list of jobs with what each one earned and still owes.
 */
export class GetDeliveryReportService extends BaseHandler {
  async run() {
    const { engineerId, status = REPAIR_STATUS.DELIVERED } = this.args;

    // Delivered jobs are filtered on the delivery date, not intake date —
    // "delivered in August" must not include a phone taken in during July and
    // still on the bench.
    const dateField = status === REPAIR_STATUS.DELIVERED ? 'deliveredAt' : 'receivedAt';

    const where = { ...dateWhere(this.args, dateField) };
    if (status) where.status = status;
    if (engineerId) where.engineerId = engineerId;

    const jobs = await db.RepairJob.findAll({
      where,
      include: [
        { model: db.Customer, as: 'customer', attributes: ['id', 'name', 'mobile'] },
        { model: db.Engineer, as: 'engineer', attributes: ['id', 'name'] },
      ],
      order: [[dateField, 'DESC']],
    });

    const paid = await paidByJobMap(jobs.map((job) => job.id));

    const rows = jobs.map((job) => {
      const plain = job.toJSON();
      const totalAmount = round2(plain.totalAmount);
      const totalPaid = paid.get(plain.id) ?? 0;
      return {
        id: plain.id,
        receiptNumber: plain.receiptNumber,
        customer: plain.customer,
        engineer: plain.engineer,
        brand: plain.brand,
        modelNumber: plain.modelNumber,
        status: plain.status,
        receivedAt: plain.receivedAt,
        deliveredAt: plain.deliveredAt,
        totalAmount,
        totalPaid,
        balance: subtractAmounts(totalAmount, totalPaid),
      };
    });

    return {
      ...getSuccessResponse('Delivery report fetched successfully.'),
      repairJobs: rows,
      summary: {
        count: rows.length,
        totalValue: round2(rows.reduce((sum, row) => sum + row.totalAmount, 0)),
        totalCollected: round2(rows.reduce((sum, row) => sum + row.totalPaid, 0)),
        totalOutstanding: round2(rows.reduce((sum, row) => sum + Math.max(row.balance, 0), 0)),
      },
    };
  }
}

/** Engineer report — Date + Engineer + Status. */
export class GetEngineerReportService extends BaseHandler {
  async run() {
    const { engineerId, status } = this.args;

    const where = { ...dateWhere(this.args) };
    if (engineerId) where.engineerId = engineerId;
    if (status) where.status = status;

    const engineers = await db.Engineer.findAll({ order: [['name', 'ASC']] });

    const jobs = await db.RepairJob.findAll({
      attributes: ['id', 'engineerId', 'status', 'totalAmount'],
      where,
      raw: true,
    });
    const paid = await paidByJobMap(jobs.map((job) => job.id));

    const buildRow = (id, name, isActive) => {
      const mine = jobs.filter((job) => (id === null ? job.engineerId === null : Number(job.engineerId) === id));
      const countOf = (...statuses) => mine.filter((job) => statuses.includes(job.status)).length;

      return {
        engineerId: id,
        name,
        isActive,
        totalRepairs: mine.length,
        delivered: countOf(REPAIR_STATUS.DELIVERED),
        jobDone: countOf(REPAIR_STATUS.JOB_DONE),
        inRepair: countOf(
          REPAIR_STATUS.QUOTATION_GIVEN,
          REPAIR_STATUS.CUSTOMER_APPROVAL,
          REPAIR_STATUS.OUTDOOR_OUT,
          REPAIR_STATUS.OUTDOOR_IN,
          REPAIR_STATUS.IN_REPAIR,
        ),
        pending: countOf(REPAIR_STATUS.PENDING),
        totalValue: round2(mine.reduce((sum, job) => sum + round2(job.totalAmount), 0)),
        totalCollected: round2(mine.reduce((sum, job) => sum + (paid.get(job.id) ?? 0), 0)),
      };
    };

    const report = engineers
      .filter((engineer) => !engineerId || engineer.id === Number(engineerId))
      .map((engineer) => buildRow(engineer.id, engineer.name, engineer.isActive));

    // Unassigned jobs still need to be visible somewhere.
    if (!engineerId && jobs.some((job) => job.engineerId === null)) {
      report.push(buildRow(null, 'Unassigned', true));
    }

    return { ...getSuccessResponse('Engineer report fetched successfully.'), engineers: report };
  }
}

/** Lead source report — Date + Lead Source + Lead Person. */
export class GetLeadSourceReportService extends BaseHandler {
  async run() {
    const { leadSource, leadHandlerId } = this.args;

    const where = { ...dateWhere(this.args) };
    if (leadSource) where.leadSource = leadSource;
    if (leadHandlerId) where.leadHandlerId = leadHandlerId;

    const jobs = await db.RepairJob.findAll({
      attributes: ['id', 'leadSource', 'status', 'totalAmount', 'customerId'],
      where,
      raw: true,
    });

    const bySource = new Map();
    for (const job of jobs) {
      const key = job.leadSource ?? 'Not recorded';
      if (!bySource.has(key)) bySource.set(key, { leadSource: key, jobs: [], customers: new Set() });
      const bucket = bySource.get(key);
      bucket.jobs.push(job);
      bucket.customers.add(job.customerId);
    }

    const leadSources = [...bySource.values()]
      .map((bucket) => ({
        leadSource: bucket.leadSource,
        customers: bucket.customers.size,
        repairJobs: bucket.jobs.length,
        delivered: bucket.jobs.filter((job) => job.status === REPAIR_STATUS.DELIVERED).length,
        completed: bucket.jobs.filter((job) => CLOSED_REPAIR_STATUSES.includes(job.status)).length,
        totalValue: round2(bucket.jobs.reduce((sum, job) => sum + round2(job.totalAmount), 0)),
      }))
      .sort((a, b) => b.repairJobs - a.repairJobs);

    return {
      ...getSuccessResponse('Lead source report fetched successfully.'),
      leadSources,
      totalRepairs: jobs.length,
    };
  }
}

/**
 * Sales / lead person report — Date + Lead Person + Lead Source.
 *
 * Deliberately separate from the engineer report: a lead person BRINGS the
 * customer, an engineer REPAIRS the phone. Mixing them would make both
 * numbers meaningless.
 */
export class GetLeadHandlerReportService extends BaseHandler {
  async run() {
    const { leadHandlerId, leadSource } = this.args;

    const where = { ...dateWhere(this.args) };
    if (leadHandlerId) where.leadHandlerId = leadHandlerId;
    if (leadSource) where.leadSource = leadSource;

    const handlers = await db.LeadHandler.findAll({ order: [['name', 'ASC']] });

    const jobs = await db.RepairJob.findAll({
      attributes: ['id', 'leadHandlerId', 'status', 'totalAmount', 'customerId'],
      where,
      raw: true,
    });
    const paid = await paidByJobMap(jobs.map((job) => job.id));

    const buildRow = (id, name, isActive) => {
      const mine = jobs.filter((job) => (id === null ? job.leadHandlerId === null : Number(job.leadHandlerId) === id));
      return {
        leadHandlerId: id,
        name,
        isActive,
        customers: new Set(mine.map((job) => job.customerId)).size,
        repairJobs: mine.length,
        completed: mine.filter((job) => CLOSED_REPAIR_STATUSES.includes(job.status)).length,
        delivered: mine.filter((job) => job.status === REPAIR_STATUS.DELIVERED).length,
        totalValue: round2(mine.reduce((sum, job) => sum + round2(job.totalAmount), 0)),
        totalCollected: round2(mine.reduce((sum, job) => sum + (paid.get(job.id) ?? 0), 0)),
      };
    };

    const report = handlers
      .filter((handler) => !leadHandlerId || handler.id === Number(leadHandlerId))
      .map((handler) => buildRow(handler.id, handler.name, handler.isActive));

    if (!leadHandlerId && jobs.some((job) => job.leadHandlerId === null)) {
      report.push(buildRow(null, 'Direct / No lead person', true));
    }

    return { ...getSuccessResponse('Lead person report fetched successfully.'), leadHandlers: report };
  }
}

/** Collection report — Date + Payment Method. Grouped by day. */
export class GetCollectionReportService extends BaseHandler {
  async run() {
    const { paymentMethod } = this.args;

    const where = { ...dateWhere(this.args, 'paidAt') };
    if (paymentMethod) where.paymentMethod = paymentMethod;

    const rows = await db.RepairLedger.findAll({
      attributes: [
        [db.sequelize.fn('DATE', db.sequelize.col('paid_at')), 'day'],
        'paymentMethod',
        [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'total'],
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'entries'],
      ],
      where,
      group: [db.sequelize.fn('DATE', db.sequelize.col('paid_at')), 'payment_method'],
      order: [[db.sequelize.fn('DATE', db.sequelize.col('paid_at')), 'DESC']],
      raw: true,
    });

    // Pivot into one row per day with a column per method.
    const byDay = new Map();
    const methodTotals = Object.values(PAYMENT_METHOD).reduce((acc, method) => ({ ...acc, [method]: 0 }), {});

    for (const row of rows) {
      const day = String(row.day);
      if (!byDay.has(day)) byDay.set(day, { day, methods: {}, total: 0, entries: 0 });
      const bucket = byDay.get(day);
      const amount = round2(row.total);
      bucket.methods[row.paymentMethod] = amount;
      bucket.total = round2(bucket.total + amount);
      bucket.entries += Number(row.entries);
      methodTotals[row.paymentMethod] = round2((methodTotals[row.paymentMethod] ?? 0) + amount);
    }

    const days = [...byDay.values()];

    return {
      ...getSuccessResponse('Collection report fetched successfully.'),
      days,
      byMethod: methodTotals,
      grandTotal: round2(days.reduce((sum, day) => sum + day.total, 0)),
      entryCount: days.reduce((sum, day) => sum + day.entries, 0),
    };
  }
}

/**
 * Expense report — Date + Category (Material / Loss / Other / All Expense).
 *
 * "All Expense" is simply the absence of a category filter — it is not a
 * stored value, so it needs no special-casing here.
 *
 * CREDIT-method expenses are money owed to a supplier, not money that has
 * left the drawer, so they are reported separately (`totalCredit`) rather
 * than folded into `totalSpent`.
 */
export class GetExpenseReportService extends BaseHandler {
  async run() {
    const { category } = this.args;

    const where = { ...dateWhere(this.args, 'spentAt') };
    if (category) where.category = category;

    const expenses = await db.ShopExpense.findAll({
      where,
      include: [
        { model: db.Supplier, as: 'supplier', attributes: ['id', 'name'] },
        { model: db.RepairJob, as: 'repairJob', attributes: ['id', 'receiptNumber'] },
      ],
      order: [['spentAt', 'DESC']],
    });

    const byCategory = Object.values(EXPENSE_CATEGORY).reduce((acc, value) => ({ ...acc, [value]: 0 }), {});
    let totalSpent = 0; // CASH + ONLINE only — real money out
    let totalCredit = 0; // CREDIT — owed to a supplier, not yet paid

    for (const expense of expenses) {
      const amount = round2(expense.amount);
      byCategory[expense.category] = round2((byCategory[expense.category] ?? 0) + amount);
      if (expense.paymentMethod === 'CREDIT') totalCredit = round2(totalCredit + amount);
      else totalSpent = round2(totalSpent + amount);
    }

    return {
      ...getSuccessResponse('Expense report fetched successfully.'),
      expenses: expenses.map((expense) => {
        const plain = expense.toJSON();
        return { ...plain, amount: round2(plain.amount) };
      }),
      summary: {
        count: expenses.length,
        totalSpent,
        totalCredit,
        totalAll: round2(totalSpent + totalCredit),
        byCategory,
      },
    };
  }
}
