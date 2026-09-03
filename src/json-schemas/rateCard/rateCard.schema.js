const idParams = {
  type: 'object',
  properties: { id: { type: 'integer', minimum: 1 } },
  required: ['id'],
};

export const listActiveSchema = {
  query: {
    type: 'object',
    properties: { isActive: { type: 'boolean' } },
    additionalProperties: false,
  },
};

const namedEntityBody = {
  type: 'object',
  properties: { name: { type: 'string', minLength: 1, maxLength: 120 } },
  required: ['name'],
  additionalProperties: false,
};

const namedEntityUpdateBody = {
  type: 'object',
  properties: { name: { type: 'string', minLength: 1, maxLength: 120 } },
  additionalProperties: false,
};

// ------------------------------------------------------------------ brands
export const createRateCardBrandSchema = { body: namedEntityBody };
export const updateRateCardBrandSchema = { params: idParams, body: namedEntityUpdateBody };

// ------------------------------------------------------------------ models
export const getRateCardModelsSchema = {
  query: {
    type: 'object',
    properties: {
      brandId: { type: 'integer', minimum: 1 },
      isActive: { type: 'boolean' },
      search: { type: 'string', maxLength: 120 },
    },
    additionalProperties: false,
  },
};

export const createRateCardModelSchema = {
  body: {
    type: 'object',
    properties: {
      brandId: { type: 'integer', minimum: 1 },
      name: { type: 'string', minLength: 1, maxLength: 120 },
    },
    required: ['brandId', 'name'],
    additionalProperties: false,
  },
};

export const updateRateCardModelSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      brandId: { type: 'integer', minimum: 1 },
      name: { type: 'string', minLength: 1, maxLength: 120 },
    },
    additionalProperties: false,
  },
};

// ------------------------------------------------------------------- parts
export const createRateCardPartSchema = { body: namedEntityBody };
export const updateRateCardPartSchema = { params: idParams, body: namedEntityUpdateBody };

// --------------------------------------------------------------- rate types
export const createRateTypeSchema = { body: namedEntityBody };
export const updateRateTypeSchema = { params: idParams, body: namedEntityUpdateBody };

// ----------------------------------------------------- toggle (any entity)
export const toggleRateCardEntitySchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      isActive: { type: 'boolean' },
      entity: { type: 'string', enum: ['brand', 'model', 'part', 'rateType'] },
    },
    required: ['isActive', 'entity'],
    additionalProperties: false,
  },
};

// ----------------------------------------------------------------- entries
export const addRateCardEntrySchema = {
  body: {
    type: 'object',
    properties: {
      modelId: { type: 'integer', minimum: 1 },
      partId: { type: 'integer', minimum: 1 },
      rateTypeId: { type: 'integer', minimum: 1 },
      price: { type: 'number', exclusiveMinimum: 0 },
      notes: { type: 'string', maxLength: 500, nullable: true },
    },
    required: ['modelId', 'partId', 'rateTypeId', 'price'],
    additionalProperties: false,
  },
};

export const updateRateCardEntrySchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      price: { type: 'number', exclusiveMinimum: 0 },
      notes: { type: 'string', maxLength: 500, nullable: true },
    },
    additionalProperties: false,
  },
};

export const rateCardEntryIdParamsSchema = { params: idParams };

// ------------------------------------------------------------------ lookup
export const getRatesForModelSchema = {
  params: {
    type: 'object',
    properties: { modelId: { type: 'integer', minimum: 1 } },
    required: ['modelId'],
  },
};

export const searchRateCardModelsSchema = {
  query: {
    type: 'object',
    properties: { search: { type: 'string', minLength: 1, maxLength: 120 } },
    required: ['search'],
    additionalProperties: false,
  },
};
