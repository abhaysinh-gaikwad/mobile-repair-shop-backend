import { REPAIR_STATUS } from '@src/utils/constants/public.constants';

const getRepairsSchema = {
  query: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      status: { type: 'string', enum: Object.values(REPAIR_STATUS) },
      engineerId: { type: 'integer', minimum: 1 },
      leadSource: { type: 'string', maxLength: 60 },
      leadHandlerId: { type: 'integer', minimum: 1 },
      customerId: { type: 'integer', minimum: 1 },
      search: { type: 'string', maxLength: 120 },
      dateFrom: { type: 'string' },
      dateTo: { type: 'string' },
      paymentStatus: { type: 'string', enum: ['pending', 'paid'] },
      active: { type: 'boolean' },
    },
    additionalProperties: false,
  },
};

export default getRepairsSchema;
