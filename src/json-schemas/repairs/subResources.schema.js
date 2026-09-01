import { ACTIVE_PAYMENT_METHODS, PAYMENT_TYPE } from '@src/utils/constants/public.constants';

const jobIdParams = {
  type: 'object',
  properties: { id: { type: 'integer', minimum: 1 } },
  required: ['id'],
};

// ---------------------------------------------------------------- parts
export const addPartSchema = {
  params: jobIdParams,
  body: {
    type: 'object',
    properties: {
      partName: { type: 'string', minLength: 1, maxLength: 160 },
      quantity: { type: 'integer', minimum: 1, default: 1 },
      unitPrice: { type: 'number', minimum: 0, default: 0 },
      notes: { type: 'string', maxLength: 1000, nullable: true },
    },
    required: ['partName'],
    additionalProperties: false,
  },
};

export const updatePartSchema = {
  params: {
    type: 'object',
    properties: {
      id: { type: 'integer', minimum: 1 },
      partId: { type: 'integer', minimum: 1 },
    },
    required: ['id', 'partId'],
  },
  body: {
    type: 'object',
    properties: {
      partName: { type: 'string', minLength: 1, maxLength: 160 },
      quantity: { type: 'integer', minimum: 1 },
      unitPrice: { type: 'number', minimum: 0 },
      notes: { type: 'string', maxLength: 1000, nullable: true },
    },
    additionalProperties: false,
  },
};

export const partIdParamsSchema = {
  params: {
    type: 'object',
    properties: {
      id: { type: 'integer', minimum: 1 },
      partId: { type: 'integer', minimum: 1 },
    },
    required: ['id', 'partId'],
  },
};

// ------------------------------------------------------------- payments
export const addPaymentSchema = {
  params: jobIdParams,
  body: {
    type: 'object',
    properties: {
      // Must be positive: undoing money goes through /reverse, never a
      // negative payment.
      amount: { type: 'number', exclusiveMinimum: 0 },
      paymentType: { type: 'string', enum: Object.values(PAYMENT_TYPE) },
      paymentMethod: { type: 'string', enum: ACTIVE_PAYMENT_METHODS },
      paidAt: { type: 'string', nullable: true },
      note: { type: 'string', maxLength: 500, nullable: true },
    },
    required: ['amount'],
    additionalProperties: false,
  },
};

export const reversePaymentSchema = {
  params: {
    type: 'object',
    properties: {
      id: { type: 'integer', minimum: 1 },
      entryId: { type: 'integer', minimum: 1 },
    },
    required: ['id', 'entryId'],
  },
  body: {
    type: 'object',
    properties: {
      // Mandatory: a correction to the books must always say why.
      reversalReason: { type: 'string', minLength: 3, maxLength: 500 },
    },
    required: ['reversalReason'],
    additionalProperties: false,
  },
};

// ------------------------------------------------------------ call logs
export const addCallLogSchema = {
  params: jobIdParams,
  body: {
    type: 'object',
    properties: {
      calledBy: { type: 'string', minLength: 1, maxLength: 120 },
      communication: { type: 'string', minLength: 1, maxLength: 2000 },
      nextAction: { type: 'string', maxLength: 1000, nullable: true },
      calledAt: { type: 'string', nullable: true },
    },
    required: ['calledBy', 'communication'],
    additionalProperties: false,
  },
};

// ------------------------------------------------------------- estimates
export const addEstimateSchema = {
  params: jobIdParams,
  body: {
    type: 'object',
    properties: {
      amount: { type: 'number', exclusiveMinimum: 0 },
      note: { type: 'string', maxLength: 255, nullable: true },
    },
    required: ['amount'],
    additionalProperties: false,
  },
};

export const jobIdParamsSchema = { params: jobIdParams };
