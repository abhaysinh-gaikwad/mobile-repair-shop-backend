import {
  ACTIVE_EXPENSE_PAYMENT_METHODS,
  ACTIVE_PAYMENT_METHODS,
  EXPENSE_CATEGORY,
  PAYMENT_TYPE,
} from '@src/utils/constants/public.constants';

const dateQuery = {
  query: {
    type: 'object',
    properties: { date: { type: 'string' } },
    additionalProperties: false,
  },
};

export const getCashDaySchema = dateQuery;

export const openCashDaySchema = {
  body: {
    type: 'object',
    properties: {
      businessDate: { type: 'string' },
      openingBalance: { type: 'number', minimum: 0 },
      notes: { type: 'string', maxLength: 500, nullable: true },
    },
    required: ['openingBalance'],
    additionalProperties: false,
  },
};

export const closeCashDaySchema = {
  body: {
    type: 'object',
    properties: {
      date: { type: 'string' },
      notes: { type: 'string', maxLength: 500, nullable: true },
    },
    additionalProperties: false,
  },
};

export const reopenCashDaySchema = {
  body: {
    type: 'object',
    properties: { date: { type: 'string' } },
    additionalProperties: false,
  },
};

/**
 * Money OUT — a part bought from a shop. Never a customer payment.
 * `paymentMethod: CREDIT` means nothing has been paid to the supplier yet.
 */
export const addShopExpenseSchema = {
  body: {
    type: 'object',
    properties: {
      amount: { type: 'number', exclusiveMinimum: 0 },
      description: { type: 'string', minLength: 1, maxLength: 255 },
      paymentMethod: { type: 'string', enum: ACTIVE_EXPENSE_PAYMENT_METHODS },
      category: { type: 'string', enum: Object.values(EXPENSE_CATEGORY) },
      // Optional link to the repair the part was bought for.
      receiptNumber: { type: 'string', maxLength: 20, nullable: true },
      // Registered supplier (preferred) or free-text vendor for an ad-hoc buy.
      supplierId: { type: 'integer', minimum: 1, nullable: true },
      vendor: { type: 'string', maxLength: 120, nullable: true },
      broughtBy: { type: 'string', maxLength: 120, nullable: true },
      spentAt: { type: 'string', nullable: true },
    },
    required: ['amount', 'description'],
    additionalProperties: false,
  },
};

export const shopExpenseIdSchema = {
  params: {
    type: 'object',
    properties: { id: { type: 'integer', minimum: 1 } },
    required: ['id'],
  },
};

/** Customer payment taken at the counter, identified by receipt number. */
export const addPaymentByReceiptSchema = {
  body: {
    type: 'object',
    properties: {
      receiptNumber: { type: 'string', minLength: 1, maxLength: 20 },
      amount: { type: 'number', exclusiveMinimum: 0 },
      paymentType: { type: 'string', enum: Object.values(PAYMENT_TYPE) },
      paymentMethod: { type: 'string', enum: ACTIVE_PAYMENT_METHODS },
      note: { type: 'string', maxLength: 500, nullable: true },
      paidAt: { type: 'string', nullable: true },
    },
    required: ['receiptNumber', 'amount'],
    additionalProperties: false,
  },
};

export const lookupReceiptSchema = {
  params: {
    type: 'object',
    properties: { receiptNumber: { type: 'string', minLength: 1, maxLength: 20 } },
    required: ['receiptNumber'],
  },
};


/**
 * A manual Cash Memo entry. Only the amount and a description are required —
 * an old paper record often has nothing else, and demanding a customer name
 * or receipt number would make exactly the entries this feature exists for
 * impossible to enter.
 */
export const addManualLedgerEntrySchema = {
  body: {
    type: 'object',
    properties: {
      amount: { type: 'number', exclusiveMinimum: 0 },
      description: { type: 'string', minLength: 1, maxLength: 500 },
      paymentMethod: { type: 'string', enum: ACTIVE_PAYMENT_METHODS },
      // Backdating is the point for historical records.
      paidAt: { type: 'string' },
      customerName: { type: 'string', maxLength: 120 },
      customerMobile: { type: 'string', maxLength: 20 },
      // The shop's own paper bill number, if the old record has one.
      reference: { type: 'string', maxLength: 60 },
      note: { type: 'string', maxLength: 500 },
    },
    required: ['amount', 'description'],
    additionalProperties: false,
  },
};

export const reverseManualEntrySchema = {
  params: {
    type: 'object',
    properties: { entryId: { type: 'integer', minimum: 1 } },
    required: ['entryId'],
  },
  body: {
    type: 'object',
    // A reason is mandatory, exactly as it is for a repair-job reversal — an
    // unexplained correction to money is not something this ledger allows.
    properties: { reversalReason: { type: 'string', minLength: 3, maxLength: 500 } },
    required: ['reversalReason'],
    additionalProperties: false,
  },
};
