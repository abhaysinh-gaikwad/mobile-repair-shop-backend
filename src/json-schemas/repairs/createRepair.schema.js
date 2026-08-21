import { DEVICE_UNLOCK_TYPE } from '@src/utils/constants/public.constants';

const createRepairSchema = {
  body: {
    type: 'object',
    properties: {
      // Customer
      customerName: { type: 'string', minLength: 1, maxLength: 120 },
      customerMobile: { type: 'string', minLength: 6, maxLength: 20 },
      alternateMobile: { type: 'string', maxLength: 20, nullable: true },
      address: { type: 'string', maxLength: 500, nullable: true },

      // Lead attribution
      leadSource: { type: 'string', maxLength: 60, nullable: true },
      leadHandlerId: { type: 'integer', minimum: 1, nullable: true },
      leadAt: { type: 'string', format: 'date-time', nullable: true },

      // Device
      brand: { type: 'string', minLength: 1, maxLength: 60 },
      modelNumber: { type: 'string', minLength: 1, maxLength: 120 },
      imei: { type: 'string', maxLength: 30, nullable: true },

      // Items received with the phone
      hasSimCard: { type: 'boolean' },
      hasMemoryCard: { type: 'boolean' },
      hasBattery: { type: 'boolean' },
      hasCharger: { type: 'boolean' },
      otherAccessories: { type: 'string', maxLength: 255, nullable: true },

      customerComplaint: { type: 'string', minLength: 1, maxLength: 2000 },

      // Screen-lock credential ONLY — never a Google/Apple/email/banking
      // password. Optional; stored encrypted and never returned in lists.
      deviceUnlockType: { type: 'string', enum: Object.values(DEVICE_UNLOCK_TYPE), nullable: true },
      deviceUnlockCredential: { type: 'string', maxLength: 100, nullable: true },

      // Set when this is a repeat repair of a previously delivered job. The
      // old job is only referenced — a brand new receipt number is issued.
      previousRepairJobId: { type: 'integer', minimum: 1, nullable: true },

      engineerId: { type: 'integer', minimum: 1, nullable: true },
      estimatedCost: { type: 'number', minimum: 0, nullable: true },
      labourCharge: { type: 'number', minimum: 0 },
      notes: { type: 'string', maxLength: 2000, nullable: true },
    },
    required: ['customerName', 'customerMobile', 'brand', 'modelNumber', 'customerComplaint'],
    additionalProperties: false,
  },
};

export default createRepairSchema;
