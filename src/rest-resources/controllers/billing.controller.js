import {
  AddManualLedgerEntryService,
  ReverseManualEntryService,
} from '@src/services/billing/manualLedgerEntry.service';
import { sendResponse } from '@src/helpers/response.helpers';
import {
  GetCashMemoService,
  GetDailyCollectionService,
  GetPendingPaymentsService,
} from '@src/services/billing/billing.service';
import {
  AddShopExpenseService,
  CloseCashDayService,
  DeleteShopExpenseService,
  GetCashDayService,
  OpenCashDayService,
  ReopenCashDayService,
} from '@src/services/billing/cashDay.service';
import AddPaymentByReceiptService from '@src/services/payments/addPaymentByReceipt.service';
import LookupReceiptService from '@src/services/payments/lookupReceipt.service';
import {
  ConfirmUnconfirmedPaymentService,
  GetUnconfirmedPaymentsService,
  RejectUnconfirmedPaymentService,
} from '@src/services/payments/unconfirmedPayment.service';

export default class BillingController {
  // ------------------------------------------------------------ cash day
  static async getCashDay(req, res, next) {
    try {
      sendResponse({ req, res, next }, await GetCashDayService.execute({ ...req.query }, req.context));
    } catch (error) {
      next(error);
    }
  }

  static async openCashDay(req, res, next) {
    try {
      const data = await OpenCashDayService.execute({ ...req.body, adminId: req.user.id }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async closeCashDay(req, res, next) {
    try {
      const data = await CloseCashDayService.execute({ ...req.body, adminId: req.user.id }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async reopenCashDay(req, res, next) {
    try {
      sendResponse({ req, res, next }, await ReopenCashDayService.execute({ ...req.body }, req.context));
    } catch (error) {
      next(error);
    }
  }

  // ------------------------------------------------------- shop expenses
  static async addShopExpense(req, res, next) {
    try {
      const data = await AddShopExpenseService.execute({ ...req.body, adminId: req.user.id }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async deleteShopExpense(req, res, next) {
    try {
      const data = await DeleteShopExpenseService.execute({ id: Number(req.params.id) }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  // --------------------------------------- customer payment by receipt no
  static async lookupReceipt(req, res, next) {
    try {
      const data = await LookupReceiptService.execute({ receiptNumber: req.params.receiptNumber }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async addPaymentByReceipt(req, res, next) {
    try {
      const data = await AddPaymentByReceiptService.execute({ ...req.body, adminId: req.user.id }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }
  static async getCashMemo(req, res, next) {
    try {
      const data = await GetCashMemoService.execute({ ...req.query }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async getDailyCollection(req, res, next) {
    try {
      const data = await GetDailyCollectionService.execute({ ...req.query }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async getPending(req, res, next) {
    try {
      const data = await GetPendingPaymentsService.execute({ ...req.query }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  // ---- "Payment Received" left unticked — awaiting confirmation ----
  static async getUnconfirmedPayments(req, res, next) {
    try {
      const data = await GetUnconfirmedPaymentsService.execute({ ...req.query }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async confirmUnconfirmedPayment(req, res, next) {
    try {
      const data = await ConfirmUnconfirmedPaymentService.execute(
        { id: Number(req.params.id), adminId: req.user.id },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async rejectUnconfirmedPayment(req, res, next) {
    try {
      const data = await RejectUnconfirmedPaymentService.execute(
        { id: Number(req.params.id), ...req.body, adminId: req.user.id },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  // ---- Manual Cash Memo entries (no repair receipt) ----
  static async addManualEntry(req, res, next) {
    try {
      const data = await AddManualLedgerEntryService.execute(
        { ...req.body, adminId: req.user.id },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async reverseManualEntry(req, res, next) {
    try {
      const data = await ReverseManualEntryService.execute(
        { entryId: Number(req.params.entryId), ...req.body, adminId: req.user.id },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }
}
