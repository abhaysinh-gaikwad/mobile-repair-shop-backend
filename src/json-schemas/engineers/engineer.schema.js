const idParams = {
  type: 'object',
  properties: { id: { type: 'integer', minimum: 1 } },
  required: ['id'],
};

export const getEngineersSchema = {
  query: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      isActive: { type: 'boolean' },
      search: { type: 'string', maxLength: 120 },
    },
    additionalProperties: false,
  },
};

export const createEngineerSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 120 },
      mobile: { type: 'string', maxLength: 20, nullable: true },
      specialization: { type: 'string', maxLength: 120, nullable: true },
      notes: { type: 'string', maxLength: 1000, nullable: true },
    },
    required: ['name'],
    additionalProperties: false,
  },
};

export const updateEngineerSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 120 },
      mobile: { type: 'string', maxLength: 20, nullable: true },
      specialization: { type: 'string', maxLength: 120, nullable: true },
      notes: { type: 'string', maxLength: 1000, nullable: true },
    },
    additionalProperties: false,
  },
};

export const toggleEngineerSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: { isActive: { type: 'boolean' } },
    required: ['isActive'],
    additionalProperties: false,
  },
};
