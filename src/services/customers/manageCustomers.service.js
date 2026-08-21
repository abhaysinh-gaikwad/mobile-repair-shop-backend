import { Op } from 'sequelize';

import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getPaginationResponse, getSuccessResponse } from '@src/helpers/response.helpers';
import { shopDayRange } from '@src/libs/dayjs';
import { BaseHandler } from '@src/libs/logicBase';
import { round2, subtractAmounts } from '@src/utils/money.utils';

export class GetCustomersService extends BaseHandler {
  async run() {
    const { page = 1, limit = 20, search, date } = this.args;

    const where = {};
    if (search) {
      const term = `%${String(search).trim()}%`;
      where[Op.or] = [{ name: { [Op.iLike]: term } }, { mobile: { [Op.iLike]: term } }];
    }

    // The Customers screen defaults to "today" so the owner sees who just
    // walked in; an explicit empty/omitted `date` shows every customer.
    if (date) {
      const { start, end } = shopDayRange(date);
      where.createdAt = { [Op.between]: [start, end] };
    }

    const { rows, count } = await db.Customer.findAndCountAll({
      where,
      include: [{ model: db.LeadHandler, as: 'leadHandler', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    // Repair counts for the listed customers, in one grouped query.
    const customerIds = rows.map((row) => row.id);
    const jobCounts = customerIds.length
      ? await db.RepairJob.findAll({
          attributes: ['customerId', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'jobCount']],
          where: { customerId: { [Op.in]: customerIds } },
          group: ['customer_id'],
          raw: true,
        })
      : [];
    const countByCustomer = new Map(jobCounts.map((row) => [Number(row.customerId), Number(row.jobCount)]));

    return {
      ...getSuccessResponse('Customers fetched successfully.'),
      customers: rows.map((row) => ({ ...row.toJSON(), repairCount: countByCustomer.get(row.id) ?? 0 })),
      pagination: getPaginationResponse({ totalCount: count, page, limit, count: rows.length }),
    };
  }
}

/** Customer profile plus their complete repair history. */
export class GetCustomerService extends BaseHandler {
  async run() {
    const { id } = this.args;

    const customer = await db.Customer.findByPk(id, {
      include: [{ model: db.LeadHandler, as: 'leadHandler', attributes: ['id', 'name'] }],
    });
    if (!customer) throw new AppError(Errors.CUSTOMER_NOT_FOUND);

    const repairJobs = await db.RepairJob.findAll({
      where: { customerId: id },
      include: [{ model: db.Engineer, as: 'engineer', attributes: ['id', 'name'] }],
      order: [['receivedAt', 'DESC']],
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

    const history = repairJobs.map((job) => {
      const plain = job.toJSON();
      const totalAmount = round2(plain.totalAmount);
      const totalPaid = paidByJob.get(plain.id) ?? 0;
      return {
        id: plain.id,
        receiptNumber: plain.receiptNumber,
        brand: plain.brand,
        modelNumber: plain.modelNumber,
        customerComplaint: plain.customerComplaint,
        status: plain.status,
        engineer: plain.engineer,
        receivedAt: plain.receivedAt,
        deliveredAt: plain.deliveredAt,
        totalAmount,
        totalPaid,
        balance: subtractAmounts(totalAmount, totalPaid),
      };
    });

    return {
      ...getSuccessResponse('Customer fetched successfully.'),
      customer,
      repairJobs: history,
      summary: {
        totalRepairs: history.length,
        totalSpent: round2(history.reduce((sum, job) => sum + job.totalPaid, 0)),
        totalOutstanding: round2(history.reduce((sum, job) => sum + Math.max(job.balance, 0), 0)),
      },
    };
  }
}

export class UpdateCustomerService extends BaseHandler {
  async run() {
    const { id, ...updates } = this.args;
    const transaction = this.dbTransaction;

    const customer = await db.Customer.findByPk(id, { transaction });
    if (!customer) throw new AppError(Errors.CUSTOMER_NOT_FOUND);

    if (updates.mobile) {
      const mobile = String(updates.mobile).trim();
      const clash = await db.Customer.findOne({ where: { mobile, id: { [Op.ne]: id } }, transaction });
      if (clash) throw new AppError(Errors.CUSTOMER_MOBILE_EXISTS(mobile));
      updates.mobile = mobile;
    }

    await customer.update(updates, { transaction });

    return { ...getSuccessResponse('Customer updated successfully.'), customer };
  }
}
