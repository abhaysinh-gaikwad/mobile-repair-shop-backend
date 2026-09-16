import { Op } from 'sequelize';

import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { EXPENSE_PAYMENT_METHOD } from '@src/utils/constants/public.constants';
import { round2 } from '@src/utils/money.utils';

/**
 * Suppliers — who the shop buys parts/material from.
 *
 * Deliberately a simple registry, not a procurement system: no purchase
 * orders, no stock levels. The value is being able to answer, per supplier,
 * "what have I bought, how much, and how much is still owed" — both are
 * computed live from `shop_expenses`, not tracked separately.
 */

export class GetSuppliersService extends BaseHandler {
  async run() {
    const { isActive } = this.args;
    const where = {};
    if (isActive !== undefined) where.isActive = isActive;

    const suppliers = await db.Supplier.findAll({
      where,
      order: [
        ['isActive', 'DESC'],
        ['name', 'ASC'],
      ],
    });

    // Purchased-to-date and outstanding-credit per supplier, in one grouped
    // query rather than N+1 sums.
    const supplierIds = suppliers.map((supplier) => supplier.id);
    const totals = supplierIds.length
      ? await db.ShopExpense.findAll({
          attributes: [
            'supplierId',
            [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'total'],
            [
              db.sequelize.fn(
                'SUM',
                db.sequelize.literal(`CASE WHEN payment_method = 'CREDIT' THEN amount ELSE 0 END`),
              ),
              'credit',
            ],
          ],
          where: { supplierId: { [Op.in]: supplierIds } },
          group: ['supplier_id'],
          raw: true,
        })
      : [];
    const totalsBySupplier = new Map(
      totals.map((row) => [Number(row.supplierId), { total: round2(row.total), credit: round2(row.credit) }]),
    );

    return {
      ...getSuccessResponse('Suppliers fetched successfully.'),
      suppliers: suppliers.map((supplier) => {
        const stats = totalsBySupplier.get(supplier.id) ?? { total: 0, credit: 0 };
        return { ...supplier.toJSON(), totalPurchased: stats.total, totalCredit: stats.credit };
      }),
    };
  }
}

/** Supplier profile plus every purchase recorded against them. */
export class GetSupplierService extends BaseHandler {
  async run() {
    const { id } = this.args;

    const supplier = await db.Supplier.findByPk(id);
    if (!supplier) throw new AppError(Errors.SUPPLIER_NOT_FOUND);

    const expenses = await db.ShopExpense.findAll({
      where: { supplierId: id },
      include: [{ model: db.RepairJob, as: 'repairJob', attributes: ['id', 'receiptNumber'] }],
      order: [['spentAt', 'DESC']],
    });

    const plain = expenses.map((expense) => ({ ...expense.toJSON(), amount: round2(expense.amount) }));
    const totalPurchased = round2(plain.reduce((sum, expense) => sum + expense.amount, 0));
    const totalCredit = round2(
      plain
        .filter((expense) => expense.paymentMethod === EXPENSE_PAYMENT_METHOD.CREDIT)
        .reduce((sum, expense) => sum + expense.amount, 0),
    );

    return {
      ...getSuccessResponse('Supplier fetched successfully.'),
      supplier,
      expenses: plain,
      summary: { totalPurchased, totalCredit, purchaseCount: plain.length },
    };
  }
}

export class CreateSupplierService extends BaseHandler {
  async run() {
    const { name, mobile, notes } = this.args;
    const transaction = this.dbTransaction;

    const trimmedName = String(name).trim();
    const existing = await db.Supplier.findOne({ where: { name: trimmedName }, transaction });
    if (existing) throw new AppError(Errors.DUPLICATE_NAME(trimmedName));

    const supplier = await db.Supplier.create(
      { name: trimmedName, mobile: mobile ?? null, notes: notes ?? null },
      { transaction },
    );

    return { ...getSuccessResponse('Supplier added successfully.'), supplier };
  }
}

export class UpdateSupplierService extends BaseHandler {
  async run() {
    const { id, ...updates } = this.args;
    const transaction = this.dbTransaction;

    const supplier = await db.Supplier.findByPk(id, { transaction });
    if (!supplier) throw new AppError(Errors.SUPPLIER_NOT_FOUND);

    if (updates.name) {
      const trimmedName = String(updates.name).trim();
      const clash = await db.Supplier.findOne({ where: { name: trimmedName, id: { [Op.ne]: id } }, transaction });
      if (clash) throw new AppError(Errors.DUPLICATE_NAME(trimmedName));
      updates.name = trimmedName;
    }

    await supplier.update(updates, { transaction });

    return { ...getSuccessResponse('Supplier updated successfully.'), supplier };
  }
}

/** Deactivated, never deleted — historical expenses must keep pointing at who they were bought from. */
export class ToggleSupplierStatusService extends BaseHandler {
  async run() {
    const { id, isActive } = this.args;
    const transaction = this.dbTransaction;

    const supplier = await db.Supplier.findByPk(id, { transaction });
    if (!supplier) throw new AppError(Errors.SUPPLIER_NOT_FOUND);

    await supplier.update({ isActive }, { transaction });

    return {
      ...getSuccessResponse(`Supplier ${isActive ? 'activated' : 'deactivated'} successfully.`),
      supplier,
    };
  }
}
