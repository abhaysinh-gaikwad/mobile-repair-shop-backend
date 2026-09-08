import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getPagination, getPaginationResponse, getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import AddPaymentService from '@src/services/payments/addPayment.service';
import { PAYMENT_METHOD, PAYMENT_TYPE, UNCONFIRMED_PAYMENT_STATUS } from '@src/utils/constants/public.constants';
import { round2 } from '@src/utils/money.utils';

/**
 * "Payment Received" left UNTICKED at the counter.
 *
 * The row created here never touches `repair_ledger` — see the
 * 20260907120000 migration for why that matters. It exists purely so the
 * entry is not lost (the till drawer disagreeing with what staff remember
 * typing is worse than the entry never having been made), and so it shows up
 * somewhere staff will actually look again.
 */
export class CreateUnconfirmedPaymentService extends BaseHandler {
  async run() {
    const { repairJobId, amount, paymentType = PAYMENT_TYPE.ADVANCE, paymentMethod = PAYMENT_METHOD.CASH, paidAt, note, adminId } =
      this.args;
    const transaction = this.dbTransaction;

    if (round2(amount) <= 0) throw new AppError(Errors.INVALID_PAYMENT_AMOUNT);

    const repairJob = await db.RepairJob.findByPk(repairJobId, {
      include: [{ model: db.Customer, as: 'customer' }],
      transaction,
    });
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    const entry = await db.UnconfirmedPayment.create(
      {
        repairJobId,
        receiptNumber: repairJob.receiptNumber,
        customerId: repairJob.customerId,
        customerName: repairJob.customer?.name ?? null,
        customerMobile: repairJob.customer?.mobile ?? null,
        amount: round2(amount),
        paymentType,
        paymentMethod,
        note: note ?? null,
        status: UNCONFIRMED_PAYMENT_STATUS.PENDING,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        createdBy: adminId ?? null,
      },
      { transaction },
    );

    return {
      ...getSuccessResponse(
        `Saved as pending against ${repairJob.receiptNumber} — not added to the Cash Drawer until confirmed.`,
      ),
      entry,
      // Nothing about the job's own numbers moved. Named explicitly so the
      // frontend never has to guess whether it should refetch the balance.
      unconfirmed: true,
    };
  }
}

/** The list behind the "Payments Awaiting Confirmation" panel. */
export class GetUnconfirmedPaymentsService extends BaseHandler {
  async run() {
    const { status = UNCONFIRMED_PAYMENT_STATUS.PENDING, repairJobId, page = 1, limit = 50 } = this.args;

    const where = {};
    if (status) where.status = status;
    if (repairJobId) where.repairJobId = Number(repairJobId);

    const { offset } = getPagination(page, limit);

    const { rows, count } = await db.UnconfirmedPayment.findAndCountAll({
      where,
      include: [
        { model: db.AdminUser, as: 'creator', attributes: ['id', 'name'] },
        { model: db.AdminUser, as: 'confirmer', attributes: ['id', 'name'] },
        { model: db.AdminUser, as: 'rejecter', attributes: ['id', 'name'] },
      ],
      order: [['paidAt', 'DESC']],
      limit: Number(limit),
      offset,
    });

    return {
      ...getSuccessResponse('Unconfirmed payments fetched successfully.'),
      entries: rows.map((row) => ({ ...row.toJSON(), amount: round2(row.amount) })),
      pagination: getPaginationResponse({ totalCount: count, page: Number(page), limit: Number(limit), count: rows.length }),
    };
  }
}

/**
 * Confirm: the money really was received. Turns the staging row into an
 * ORDINARY `repair_ledger` entry via `AddPaymentService` — the exact same
 * write a ticked-checkbox payment makes — then marks the staging row done.
 *
 * Run directly (`.run()`, not `.execute()`) so both writes share this
 * request's transaction and either both happen or neither does.
 */
export class ConfirmUnconfirmedPaymentService extends BaseHandler {
  async run() {
    const { id, adminId } = this.args;
    const transaction = this.dbTransaction;

    const pending = await db.UnconfirmedPayment.findByPk(id, { transaction });
    if (!pending) throw new AppError(Errors.UNCONFIRMED_PAYMENT_NOT_FOUND);
    if (pending.status !== UNCONFIRMED_PAYMENT_STATUS.PENDING) {
      throw new AppError(Errors.UNCONFIRMED_PAYMENT_ALREADY_RESOLVED);
    }

    const inner = new AddPaymentService(
      {
        repairJobId: pending.repairJobId,
        amount: pending.amount,
        paymentType: pending.paymentType,
        paymentMethod: pending.paymentMethod,
        // Backdated to when the money was originally said to have been taken,
        // not to the moment someone got around to confirming it — otherwise
        // a payment collected Monday and confirmed Wednesday would show up
        // in Wednesday's Cash Memo instead of Monday's.
        paidAt: pending.paidAt,
        note: pending.note,
        adminId,
      },
      this.context,
    );
    const result = await inner.run();

    await pending.update(
      {
        status: UNCONFIRMED_PAYMENT_STATUS.CONFIRMED,
        confirmedLedgerEntryId: result.entry.id,
        confirmedBy: adminId ?? null,
        confirmedAt: new Date(),
      },
      { transaction },
    );

    return {
      ...getSuccessResponse(`Confirmed — ${round2(pending.amount)} added to the Cash Drawer.`),
      entry: result.entry,
      totalAmount: result.totalAmount,
      totalPaid: result.totalPaid,
      balance: result.balance,
    };
  }
}

/** Reject: staff decide the money was never actually received. No ledger row is ever created. */
export class RejectUnconfirmedPaymentService extends BaseHandler {
  async run() {
    const { id, reason, adminId } = this.args;
    const transaction = this.dbTransaction;

    const pending = await db.UnconfirmedPayment.findByPk(id, { transaction });
    if (!pending) throw new AppError(Errors.UNCONFIRMED_PAYMENT_NOT_FOUND);
    if (pending.status !== UNCONFIRMED_PAYMENT_STATUS.PENDING) {
      throw new AppError(Errors.UNCONFIRMED_PAYMENT_ALREADY_RESOLVED);
    }

    await pending.update(
      {
        status: UNCONFIRMED_PAYMENT_STATUS.REJECTED,
        rejectedBy: adminId ?? null,
        rejectedAt: new Date(),
        rejectionReason: reason?.trim() || null,
      },
      { transaction },
    );

    return { ...getSuccessResponse('Payment discarded — it was never added to the Cash Drawer.'), entry: pending };
  }
}
