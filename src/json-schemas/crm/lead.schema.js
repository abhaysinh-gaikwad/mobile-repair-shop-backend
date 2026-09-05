import {
  ACTIVE_LEAD_SOURCES,
  ACTIVE_LEAD_STATUSES,
} from '@src/utils/constants/public.constants';

const idParams = {
  type: 'object',
  properties: { id: { type: 'integer', minimum: 1 } },
  required: ['id'],
};

/**
 * Deliberately permissive on the detail fields: a WhatsApp enquiry often
 * arrives as nothing but a phone number and a sentence, and refusing it for
 * lack of a device model would lose the lead entirely. Only the source is
 * genuinely required, because "where did this come from" is the one thing the
 * shop can never reconstruct later.
 */
export const createLeadSchema = {
  body: {
    type: 'object',
    properties: {
      customerName: { type: 'string', maxLength: 120 },
      mobile: { type: 'string', maxLength: 20 },
      source: { type: 'string', enum: ACTIVE_LEAD_SOURCES },
      enquiry: { type: 'string' },
      brand: { type: 'string', maxLength: 60 },
      modelNumber: { type: 'string', maxLength: 80 },
      problem: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['source'],
    additionalProperties: false,
  },
};

export const getLeadsSchema = {
  query: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      status: { type: 'string', enum: ACTIVE_LEAD_STATUSES },
      source: { type: 'string', enum: ACTIVE_LEAD_SOURCES },
      assignedTo: { type: 'integer', minimum: 1 },
      search: { type: 'string', maxLength: 120 },
    },
    additionalProperties: false,
  },
};

export const leadIdSchema = { params: idParams };

export const updateLeadSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      customerName: { type: 'string', maxLength: 120 },
      mobile: { type: 'string', maxLength: 20 },
      brand: { type: 'string', maxLength: 60 },
      modelNumber: { type: 'string', maxLength: 80 },
      problem: { type: 'string' },
      enquiry: { type: 'string' },
      notes: { type: 'string' },
      status: { type: 'string', enum: ACTIVE_LEAD_STATUSES },
      repairJobId: { type: 'integer', minimum: 1 },
    },
    additionalProperties: false,
  },
};

export const reassignLeadSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      toAdminUserId: { type: 'integer', minimum: 1 },
      note: { type: 'string', maxLength: 500 },
    },
    required: ['toAdminUserId'],
    additionalProperties: false,
  },
};
