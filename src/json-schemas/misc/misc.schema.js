import { DATE_PRESETS } from '@src/libs/dayjs';
import {
  ALL_PAYMENT_METHODS,
  EXPENSE_CATEGORY,
  LEDGER_ENTRY_TYPE,
  REPAIR_STATUS,
} from '@src/utils/constants/public.constants';

/** Shared by every report: a named preset, or an explicit custom range. */
const datePresetProps = {
  preset: { type: 'string', enum: Object.values(DATE_PRESETS) },
  dateFrom: { type: 'string' },
  dateTo: { type: 'string' },
};

const idParams = {
  type: 'object',
  properties: { id: { type: 'integer', minimum: 1 } },
  required: ['id'],
};

// ------------------------------------------------------------- customers
export const getCustomersSchema = {
  query: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      search: { type: 'string', maxLength: 120 },
      // The screen defaults to today; omit entirely to see every customer.
      date: { type: 'string' },
    },
    additionalProperties: false,
  },
};

export const customerIdSchema = { params: idParams };

export const updateCustomerSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 120 },
      mobile: { type: 'string', minLength: 6, maxLength: 20 },
      alternateMobile: { type: 'string', maxLength: 20, nullable: true },
      address: { type: 'string', maxLength: 500, nullable: true },
      leadSource: { type: 'string', maxLength: 60, nullable: true },
      leadHandlerId: { type: 'integer', minimum: 1, nullable: true },
      notes: { type: 'string', maxLength: 1000, nullable: true },
    },
    additionalProperties: false,
  },
};

// ------------------------------------------------------------------ leads
export const listActiveSchema = {
  query: {
    type: 'object',
    properties: { isActive: { type: 'boolean' } },
    additionalProperties: false,
  },
};

export const createLeadHandlerSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 120 },
      mobile: { type: 'string', maxLength: 20, nullable: true },
      notes: { type: 'string', maxLength: 1000, nullable: true },
    },
    required: ['name'],
    additionalProperties: false,
  },
};

export const updateLeadHandlerSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 120 },
      mobile: { type: 'string', maxLength: 20, nullable: true },
      notes: { type: 'string', maxLength: 1000, nullable: true },
    },
    additionalProperties: false,
  },
};

export const createLeadSourceSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 60 },
      displayOrder: { type: 'integer', minimum: 0, default: 0 },
    },
    required: ['name'],
    additionalProperties: false,
  },
};

export const updateLeadSourceSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 60 },
      displayOrder: { type: 'integer', minimum: 0 },
    },
    additionalProperties: false,
  },
};

export const toggleSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: { isActive: { type: 'boolean' } },
    required: ['isActive'],
    additionalProperties: false,
  },
};

// ---------------------------------------------------------------- billing
export const getCashMemoSchema = {
  query: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      paymentMethod: { type: 'string', enum: ALL_PAYMENT_METHODS },
      entryType: { type: 'string', enum: Object.values(LEDGER_ENTRY_TYPE) },
      search: { type: 'string', maxLength: 120 },
      ...datePresetProps,
    },
    additionalProperties: false,
  },
};

export const dailyCollectionSchema = {
  query: {
    type: 'object',
    properties: {
      date: { type: 'string' },
      paymentMethod: { type: 'string', enum: ALL_PAYMENT_METHODS },
      ...datePresetProps,
    },
    additionalProperties: false,
  },
};

export const pendingPaymentsSchema = {
  query: {
    type: 'object',
    properties: { includeClosed: { type: 'boolean', default: false } },
    additionalProperties: false,
  },
};

// ---------------------------------------------------------------- reports
// Each report takes ONLY the filters that mean something for it — no single
// universal filter object.

/** Repair report: Date + Status + Engineer. */
export const repairReportSchema = {
  query: {
    type: 'object',
    properties: {
      ...datePresetProps,
      status: { type: 'string', enum: Object.values(REPAIR_STATUS) },
      engineerId: { type: 'integer', minimum: 1 },
    },
    additionalProperties: false,
  },
};

/** Delivery report: Date + Engineer + Status. */
export const deliveryReportSchema = {
  query: {
    type: 'object',
    properties: {
      ...datePresetProps,
      engineerId: { type: 'integer', minimum: 1 },
      status: { type: 'string', enum: Object.values(REPAIR_STATUS) },
    },
    additionalProperties: false,
  },
};

/** Engineer report: Date + Engineer + Status. */
export const engineerReportSchema = {
  query: {
    type: 'object',
    properties: {
      ...datePresetProps,
      engineerId: { type: 'integer', minimum: 1 },
      status: { type: 'string', enum: Object.values(REPAIR_STATUS) },
    },
    additionalProperties: false,
  },
};

/** Lead reports: Date + Lead Source + Lead Person. Never engineer. */
export const leadReportSchema = {
  query: {
    type: 'object',
    properties: {
      ...datePresetProps,
      leadSource: { type: 'string', maxLength: 60 },
      leadHandlerId: { type: 'integer', minimum: 1 },
    },
    additionalProperties: false,
  },
};

/** Collection report: Date + Payment Method. */
export const collectionReportSchema = {
  query: {
    type: 'object',
    properties: {
      ...datePresetProps,
      paymentMethod: { type: 'string', enum: ALL_PAYMENT_METHODS },
    },
    additionalProperties: false,
  },
};

/** Expense report: Date + Category (Material / Loss / Other Expense / All Expense). */
export const expenseReportSchema = {
  query: {
    type: 'object',
    properties: {
      ...datePresetProps,
      category: { type: 'string', enum: Object.values(EXPENSE_CATEGORY) },
    },
    additionalProperties: false,
  },
};

// -------------------------------------------------------------- suppliers
export const createSupplierSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 120 },
      mobile: { type: 'string', maxLength: 20, nullable: true },
      notes: { type: 'string', maxLength: 1000, nullable: true },
    },
    required: ['name'],
    additionalProperties: false,
  },
};

export const updateSupplierSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 120 },
      mobile: { type: 'string', maxLength: 20, nullable: true },
      notes: { type: 'string', maxLength: 1000, nullable: true },
    },
    additionalProperties: false,
  },
};

export const supplierIdSchema = { params: idParams };

// --------------------------------------------------------------- settings
export const updateSettingsSchema = {
  body: {
    type: 'object',
    properties: {
      settings: { type: 'object', additionalProperties: { type: ['string', 'number', 'boolean'] } },
    },
    required: ['settings'],
    additionalProperties: false,
  },
};
