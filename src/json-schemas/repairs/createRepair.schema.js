import { ACTIVE_PAYMENT_METHODS, DEVICE_UNLOCK_TYPE } from '@src/utils/constants/public.constants';

const createRepairSchema = {
  body: {
    type: 'object',
    properties: {
      // Customer
      customerName: { type: 'string', minLength: 1, maxLength: 120 },
      customerMobile: { type: 'string', minLength: 6, maxLength: 20 },
      alternateMobile: { type: 'string', maxLength: 20, nullable: true },
      address: { type: 'string', maxLength: 500, nullable: true },

      // Lead attribution — leadSource and leadHandlerId are both mandatory
      // (see `required` below): the shop needs every repair attributed to a
      // marketing source AND a sales/lead person, not just the ones staff
      // remembered to fill in.
      leadSource: { type: 'string', minLength: 1, maxLength: 60 },
      leadHandlerId: { type: 'integer', minimum: 1 },
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
      // What the customer SAYS about the phone's own history (e.g. tried at
      // other shops already) — separate from customerComplaint.
      customerHistoryNote: { type: 'string', maxLength: 2000, nullable: true },

      // Screen-lock credential ONLY — never a Google/Apple/email/banking
      // password. Optional; stored encrypted and never returned in lists.
      deviceUnlockType: { type: 'string', enum: Object.values(DEVICE_UNLOCK_TYPE), nullable: true },
      deviceUnlockCredential: { type: 'string', maxLength: 100, nullable: true },

      // Set when this is a repeat repair of a previously delivered job. The
      // old job is only referenced — a brand new receipt number is issued.
      previousRepairJobId: { type: 'integer', minimum: 1, nullable: true },

      engineerId: { type: 'integer', minimum: 1, nullable: true },
      // Multiple quote components entered together at intake (e.g. "500
      // original", "300 market") — each becomes its own append-only estimate
      // row; the job's quoted total is the sum of every row's amount.
      // `amount` may legitimately be 0: a row can be pure text ("screen
      // replacement, price TBD") with no figure in it. Such a row still has
      // to be stored — rejecting it silently lost quotes staff had typed.
      estimates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            amount: { type: 'number', minimum: 0 },
            note: { type: 'string', maxLength: 255, nullable: true },
          },
          required: ['amount'],
          additionalProperties: false,
        },
        maxItems: 20,
        nullable: true,
      },
      // Cash taken at the counter right at intake, before the phone even
      // leaves the customer's hand — becomes a real ledger payment, not just
      // a number printed on paper.
      advancePayment: { type: 'number', exclusiveMinimum: 0, nullable: true },
      advancePaymentMethod: { type: 'string', enum: ACTIVE_PAYMENT_METHODS, nullable: true },
      labourCharge: { type: 'number', minimum: 0 },
      notes: { type: 'string', maxLength: 2000, nullable: true },
    },
    required: ['customerName', 'customerMobile', 'brand', 'modelNumber', 'customerComplaint', 'leadSource', 'leadHandlerId'],
    additionalProperties: false,
  },
};

export default createRepairSchema;
