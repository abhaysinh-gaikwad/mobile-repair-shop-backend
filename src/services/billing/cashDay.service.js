import { Op } from 'sequelize';

import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { nextSequenceValue } from '@src/helpers/repair.helpers';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { shopDayRange, shopNow } from '@src/libs/dayjs';
import { BaseHandler } from '@src/libs/logicBase';
import {
  ACTIVE_PAYMENT_METHODS,
  ALL_EXPENSE_PAYMENT_METHODS,
  ALL_PAYMENT_METHODS,
  CASH_DAY_STATUS,
  EXPENSE_CATEGORY,
  EXPENSE_PAYMENT_METHOD,
  PAYMENT_METHOD,
} from '@src/utils/constants/public.constants';
import { round2, subtractAmounts } from '@src/utils/money.utils';

/**
 * Daily cash drawer.
 *
 *   opening balance (counted each morning)
 *     + customer collections  (repair_ledger — money IN, tied to a receipt)
 *     − shop expenses         (shop_expenses — money OUT, parts bought)
 *     = closing balance
 *
 * Customer payments and shop expenses are two DIFFERENT things and live in two
 * different tables. An expense is never written into `repair_ledger`, because
 * that table is the record of what customers paid — mixing them would corrupt
 * every collection and revenue figure in the app.
 */

/** The shop's local calendar date, e.g. "2026-08-16". */
const businessDateFor = (date) => (date ? String(date).slice(0, 10) : shopNow().format('YYYY-MM-DD'));

/** Totals per payment method, always listing every active method. */
const emptyMethodTotals = () =>
  ACTIVE_PAYMENT_METHODS.reduce((acc, method) => ({ ...acc, [method]: 0 }), {});

/** Same, but includes CREDIT — expenses can be bought on credit, payments cannot. */
const emptyExpenseMethodTotals = () =>
  Object.values(EXPENSE_PAYMENT_METHOD).reduce((acc, method) => ({ ...acc, [method]: 0 }), {});

/** Open (or re-open for editing) a day and set its opening balance. */
export class OpenCashDayService extends BaseHandler {
  async run() {
    const { businessDate, openingBalance, notes, adminId } = this.args;
    const transaction = this.dbTransaction;
    const date = businessDateFor(businessDate);

    const existing = await db.CashDay.findOne({ where: { businessDate: date }, transaction });

    if (existing) {
      // A closed day is a signed-off record; re-opening it would let a figure
      // the owner already checked change underneath them.
      if (existing.status === CASH_DAY_STATUS.CLOSED) throw new AppError(Errors.CASH_DAY_CLOSED(date));

      await existing.update(
        { openingBalance: round2(openingBalance), notes: notes ?? existing.notes },
        { transaction },
      );
      return { ...getSuccessResponse('Opening balance updated.'), cashDay: existing };
    }

    const cashDay = await db.CashDay.create(
      {
        businessDate: date,
        openingBalance: round2(openingBalance),
        status: CASH_DAY_STATUS.OPEN,
        notes: notes ?? null,
        openedBy: adminId ?? null,
      },
      { transaction },
    );

    return { ...getSuccessResponse(`Day opened with ${round2(openingBalance)} in the drawer.`), cashDay };
  }
}

/**
 * Everything that happened on one day: opening balance, customer collections,
 * shop expenses, per-method totals, closing balance and the full transaction
 * list. This is what the Cash Memo screen renders.
 */
export class GetCashDayService extends BaseHandler {
  async run() {
    const { date } = this.args;
    const businessDate = businessDateFor(date);
    const { start, end } = shopDayRange(businessDate);

    const cashDay = await db.CashDay.findOne({ where: { businessDate } });

    const [payments, expenses] = await Promise.all([
      db.RepairLedger.findAll({
        where: { paidAt: { [Op.between]: [start, end] } },
        include: [{ model: db.AdminUser, as: 'receiver', attributes: ['id', 'name'] }],
        order: [['paidAt', 'ASC']],
      }),
      db.ShopExpense.findAll({
        where: { spentAt: { [Op.between]: [start, end] } },
        include: [
          { model: db.AdminUser, as: 'recorder', attributes: ['id', 'name'] },
          { model: db.Supplier, as: 'supplier', attributes: ['id', 'name'] },
        ],
        order: [['spentAt', 'ASC']],
      }),
    ]);

    // Which payments have been reversed, so the UI can strike them through.
    const reversedIds = new Set(
      payments.filter((entry) => entry.reversesEntryId).map((entry) => Number(entry.reversesEntryId)),
    );

    const collectionsByMethod = emptyMethodTotals();
    const expensesByMethod = emptyExpenseMethodTotals();

    // Reversals are negative rows, so a plain sum nets them out automatically.
    let totalCollections = 0;
    for (const entry of payments) {
      const amount = round2(entry.amount);
      totalCollections = round2(totalCollections + amount);
      const key = ALL_PAYMENT_METHODS.includes(entry.paymentMethod) ? entry.paymentMethod : 'OTHER';
      collectionsByMethod[key] = round2((collectionsByMethod[key] ?? 0) + amount);
    }

    // CREDIT expenses are money OWED to a supplier, not money that left the
    // drawer — kept out of `totalExpenses` so the daily reconciliation isn't
    // overstated by a purchase nobody has paid for yet.
    let totalExpenses = 0;
    let totalCredit = 0;
    for (const expense of expenses) {
      const amount = round2(expense.amount);
      const key = ALL_EXPENSE_PAYMENT_METHODS.includes(expense.paymentMethod) ? expense.paymentMethod : 'OTHER';
      expensesByMethod[key] = round2((expensesByMethod[key] ?? 0) + amount);
      if (expense.paymentMethod === EXPENSE_PAYMENT_METHOD.CREDIT) totalCredit = round2(totalCredit + amount);
      else totalExpenses = round2(totalExpenses + amount);
    }

    const openingBalance = round2(cashDay?.openingBalance ?? 0);

    // Only cash moves the physical drawer; digital money never touches it,
    // and credit purchases never touch it either (no money changed hands).
    const cashCollected = round2(collectionsByMethod[PAYMENT_METHOD.CASH] ?? 0);
    const cashSpent = round2(expensesByMethod[PAYMENT_METHOD.CASH] ?? 0);
    const expectedCashInDrawer = round2(openingBalance + cashCollected - cashSpent);

    return {
      ...getSuccessResponse('Cash day fetched successfully.'),
      businessDate,
      cashDay,
      isOpen: !cashDay || cashDay.status === CASH_DAY_STATUS.OPEN,
      summary: {
        openingBalance,
        totalCollections,
        totalExpenses,
        totalCredit,
        netForDay: subtractAmounts(totalCollections, totalExpenses),
        // Cash only — what should physically be in the box right now.
        cashCollected,
        cashSpent,
        expectedCashInDrawer,
        collectionsByMethod,
        expensesByMethod,
        paymentCount: payments.length,
        expenseCount: expenses.length,
      },
      payments: payments.map((entry) => {
        const plain = entry.toJSON();
        return {
          ...plain,
          amount: round2(plain.amount),
          isReversed: reversedIds.has(Number(plain.id)),
        };
      }),
      expenses: expenses.map((expense) => ({ ...expense.toJSON(), amount: round2(expense.amount) })),
    };
  }
}

/**
 * Record money spent on a part. Never a customer payment.
 *
 * `paymentMethod: 'CREDIT'` means the supplier hasn't been paid yet — the
 * purchase is recorded (so the shop knows it happened and what's owed) but
 * no money has left the drawer.
 */
export class AddShopExpenseService extends BaseHandler {
  async run() {
    const {
      amount,
      description,
      paymentMethod,
      category,
      receiptNumber,
      vendor,
      supplierId,
      broughtBy,
      spentAt,
      adminId,
    } = this.args;
    const transaction = this.dbTransaction;

    if (round2(amount) <= 0) throw new AppError(Errors.INVALID_PAYMENT_AMOUNT);

    // Optionally tie the part to the repair it was bought for.
    let repairJob = null;
    if (receiptNumber) {
      repairJob = await db.RepairJob.findOne({ where: { receiptNumber: String(receiptNumber).trim() }, transaction });
      if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);
    }

    let supplier = null;
    if (supplierId) {
      supplier = await db.Supplier.findByPk(supplierId, { transaction });
      if (!supplier) throw new AppError(Errors.SUPPLIER_NOT_FOUND);
    }

    const sequenceValue = await nextSequenceValue('shop_expense_entry_no_seq', transaction);

    const expense = await db.ShopExpense.create(
      {
        entryNo: `E-${String(sequenceValue).padStart(6, '0')}`,
        amount: round2(amount),
        description: String(description).trim(),
        paymentMethod: paymentMethod ?? PAYMENT_METHOD.CASH,
        category: category ?? EXPENSE_CATEGORY.MATERIAL,
        repairJobId: repairJob?.id ?? null,
        receiptNumber: repairJob?.receiptNumber ?? null,
        supplierId: supplier?.id ?? null,
        // A registered supplier's own name is the source of truth; free-text
        // `vendor` is only used for an ad-hoc purchase with no supplier record.
        vendor: supplier ? supplier.name : (vendor ?? null),
        broughtBy: broughtBy ?? null,
        spentAt: spentAt ? new Date(spentAt) : new Date(),
        recordedBy: adminId ?? null,
      },
      { transaction },
    );

    return { ...getSuccessResponse('Shop expense recorded.'), expense };
  }
}

/** Delete a mis-entered expense. Allowed only while the day is still open. */
export class DeleteShopExpenseService extends BaseHandler {
  async run() {
    const { id } = this.args;
    const transaction = this.dbTransaction;

    const expense = await db.ShopExpense.findByPk(id, { transaction });
    if (!expense) throw new AppError(Errors.SHOP_EXPENSE_NOT_FOUND);

    const businessDate = shopNow().format('YYYY-MM-DD');
    const expenseDate = shopDayRange(expense.spentAt).start.toISOString().slice(0, 10);

    const cashDay = await db.CashDay.findOne({
      where: { businessDate: { [Op.in]: [businessDate, expenseDate] } },
      transaction,
    });
    if (cashDay?.status === CASH_DAY_STATUS.CLOSED) throw new AppError(Errors.CASH_DAY_CLOSED(cashDay.businessDate));

    await expense.destroy({ transaction });

    return getSuccessResponse('Shop expense removed.');
  }
}

/** Close the day and freeze its totals. */
export class CloseCashDayService extends BaseHandler {
  async run() {
    const { date, notes, adminId } = this.args;
    const transaction = this.dbTransaction;
    const businessDate = businessDateFor(date);

    const cashDay = await db.CashDay.findOne({ where: { businessDate }, transaction });
    if (!cashDay) throw new AppError(Errors.CASH_DAY_NOT_OPENED(businessDate));
    if (cashDay.status === CASH_DAY_STATUS.CLOSED) throw new AppError(Errors.CASH_DAY_CLOSED(businessDate));

    const { start, end } = shopDayRange(businessDate);

    const [collected, spent, cashCollected, cashSpent] = await Promise.all([
      db.RepairLedger.sum('amount', { where: { paidAt: { [Op.between]: [start, end] } }, transaction }),
      // Real money out only — a CREDIT purchase hasn't left the drawer yet,
      // so it must not appear in the day's frozen "expenses" snapshot.
      db.ShopExpense.sum('amount', {
        where: { spentAt: { [Op.between]: [start, end] }, paymentMethod: { [Op.in]: ACTIVE_PAYMENT_METHODS } },
        transaction,
      }),
      db.RepairLedger.sum('amount', {
        where: { paidAt: { [Op.between]: [start, end] }, paymentMethod: PAYMENT_METHOD.CASH },
        transaction,
      }),
      db.ShopExpense.sum('amount', {
        where: { spentAt: { [Op.between]: [start, end] }, paymentMethod: PAYMENT_METHOD.CASH },
        transaction,
      }),
    ]);

    const openingBalance = round2(cashDay.openingBalance);
    const closingBalance = round2(openingBalance + round2(cashCollected || 0) - round2(cashSpent || 0));

    await cashDay.update(
      {
        status: CASH_DAY_STATUS.CLOSED,
        closingCollections: round2(collected || 0),
        closingExpenses: round2(spent || 0),
        closingBalance,
        closedAt: new Date(),
        closedBy: adminId ?? null,
        notes: notes ?? cashDay.notes,
      },
      { transaction },
    );

    return {
      ...getSuccessResponse(`Day ${businessDate} closed.`),
      cashDay,
      summary: {
        openingBalance,
        totalCollections: round2(collected || 0),
        totalExpenses: round2(spent || 0),
        closingBalance,
      },
    };
  }
}

/** Re-open a mistakenly closed day. */
export class ReopenCashDayService extends BaseHandler {
  async run() {
    const { date } = this.args;
    const transaction = this.dbTransaction;
    const businessDate = businessDateFor(date);

    const cashDay = await db.CashDay.findOne({ where: { businessDate }, transaction });
    if (!cashDay) throw new AppError(Errors.CASH_DAY_NOT_OPENED(businessDate));

    await cashDay.update(
      {
        status: CASH_DAY_STATUS.OPEN,
        closedAt: null,
        closedBy: null,
        closingBalance: null,
        closingCollections: null,
        closingExpenses: null,
      },
      { transaction },
    );

    return { ...getSuccessResponse(`Day ${businessDate} re-opened.`), cashDay };
  }
}
