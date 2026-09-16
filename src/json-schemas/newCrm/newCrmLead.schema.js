const idParams = {
  type: 'object',
  properties: { id: { type: 'integer', minimum: 1 } },
  required: ['id'],
};

export const createNewCrmLeadSchema = {
  body: {
    type: 'object',
    properties: {
      telecallerId: { type: 'integer', minimum: 1 },
      leadDate: { type: 'string' },
      customerName: { type: 'string', minLength: 1, maxLength: 120 },
      location: { type: 'string', maxLength: 120, nullable: true },
      mobileNumber: { type: 'string', minLength: 1, maxLength: 20 },
      modelNumber: { type: 'string', maxLength: 120, nullable: true },
      problem: { type: 'string', nullable: true },
      telecallerRate: { type: 'number', minimum: 0, nullable: true },
    },
    required: ['telecallerId', 'customerName', 'mobileNumber'],
    additionalProperties: false,
  },
};

export const getNewCrmLeadsSchema = {
  query: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      telecallerId: { type: 'integer', minimum: 1 },
      status: { type: 'string', maxLength: 40 },
      search: { type: 'string', maxLength: 120 },
    },
    additionalProperties: false,
  },
};

export const newCrmLeadIdSchema = { params: idParams };

/** Full edit — everything except serialNo, which is generated once and never changes. */
export const updateNewCrmLeadSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      telecallerId: { type: 'integer', minimum: 1 },
      leadDate: { type: 'string' },
      customerName: { type: 'string', minLength: 1, maxLength: 120 },
      location: { type: 'string', maxLength: 120, nullable: true },
      mobileNumber: { type: 'string', minLength: 1, maxLength: 20 },
      modelNumber: { type: 'string', maxLength: 120, nullable: true },
      problem: { type: 'string', nullable: true },
      telecallerRate: { type: 'number', minimum: 0, nullable: true },
      status: { type: 'string', maxLength: 40 },
      followUpDate: { type: 'string', nullable: true },
    },
    additionalProperties: false,
  },
};

/** Quick status-only change from the table's Status column. */
export const updateNewCrmLeadStatusSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: { status: { type: 'string', minLength: 1, maxLength: 40 } },
    required: ['status'],
    additionalProperties: false,
  },
};

/** Quick follow-up-date-only change from the table's Follow-up Date column. */
export const updateNewCrmLeadFollowUpSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: { followUpDate: { type: 'string', nullable: true } },
    required: ['followUpDate'],
    additionalProperties: false,
  },
};
