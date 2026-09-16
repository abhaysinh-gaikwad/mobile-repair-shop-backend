import { DATE_PRESETS } from '@src/libs/dayjs';

const getRepairsSchema = {
  query: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      // A single status ("PENDING") or several joined by commas
      // ("QUOTATION_GIVEN,CUSTOMER_APPROVAL,OUTDOOR_OUT,OUTDOOR_IN,IN_REPAIR")
      // — the latter is how the Dashboard's "In Repair" card (a combined
      // pipeline bucket, not one single status) links here with the exact
      // same set of statuses it counted, instead of a mismatched subset.
      // Validated against REPAIR_STATUS at the service level rather than an
      // AJV enum, which can't express "one of these OR a comma list of them".
      status: { type: 'string', maxLength: 200 },
      engineerId: { type: 'integer', minimum: 1 },
      leadSource: { type: 'string', maxLength: 60 },
      leadHandlerId: { type: 'integer', minimum: 1 },
      customerId: { type: 'integer', minimum: 1 },
      search: { type: 'string', maxLength: 120 },
      // Same shared date-range shape as Dashboard/Reports — a named preset
      // (resolved server-side in the shop's timezone, inclusive of the
      // whole end day) or an explicit CUSTOM dateFrom/dateTo pair.
      preset: { type: 'string', enum: Object.values(DATE_PRESETS) },
      dateFrom: { type: 'string' },
      dateTo: { type: 'string' },
      paymentStatus: { type: 'string', enum: ['pending', 'paid'] },
      active: { type: 'boolean' },
    },
    additionalProperties: false,
  },
};

export default getRepairsSchema;
