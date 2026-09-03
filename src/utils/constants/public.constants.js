/**
 * Repair lifecycle, in pipeline order.
 *
 * Stored as STRING (not a Postgres ENUM) on purpose: Postgres cannot drop an
 * enum value, and a real shop will want to adjust this list over time.
 *
 * OUTDOOR_OUT / OUTDOOR_IN cover work the shop sends to an outside specialist
 * (chip-level/motherboard work it can't do in-house) — the phone leaves the
 * counter and later comes back.
 */
export const REPAIR_STATUS = Object.freeze({
  PENDING: 'PENDING',
  QUOTATION_GIVEN: 'QUOTATION_GIVEN',
  CUSTOMER_APPROVAL: 'CUSTOMER_APPROVAL',
  OUTDOOR_OUT: 'OUTDOOR_OUT',
  OUTDOOR_IN: 'OUTDOOR_IN',
  IN_REPAIR: 'IN_REPAIR',
  JOB_DONE: 'JOB_DONE',
  DELIVERED: 'DELIVERED',
});

/** Statuses that mean the job is finished and no longer "active work". */
export const CLOSED_REPAIR_STATUSES = Object.freeze([REPAIR_STATUS.DELIVERED]);

/**
 * How the customer's phone screen is locked.
 *
 * This is ONLY the device screen lock, captured so the engineer can test the
 * phone after repair. It is never a Google/Apple/email/banking credential.
 */
export const DEVICE_UNLOCK_TYPE = Object.freeze({
  NONE: 'NONE',
  PIN: 'PIN',
  PASSWORD: 'PASSWORD',
  PATTERN: 'PATTERN',
});

/** Ledger row kind. Reversals carry a negative amount. */
export const LEDGER_ENTRY_TYPE = Object.freeze({
  PAYMENT: 'PAYMENT',
  REVERSAL: 'REVERSAL',
});

/** Which stage of the job the money was taken at. */
export const PAYMENT_TYPE = Object.freeze({
  ADVANCE: 'ADVANCE',
  PART: 'PART',
  FINAL: 'FINAL',
});

/**
 * How a customer paid. Only Cash and Online are offered going forward.
 *
 * Legacy values (PHONEPE / GOOGLE_PAY / UPI / CARD / BANK_TRANSFER / OTHER)
 * are kept in `ALL_PAYMENT_METHODS` so historical ledger rows still render —
 * the column is a STRING, and rewriting past entries would falsify the cash
 * memo. They are simply not offered for new payments, and are treated as
 * "online" wherever cash-vs-online is summed (see `isOnlinePaymentMethod`).
 */
export const PAYMENT_METHOD = Object.freeze({
  CASH: 'CASH',
  ONLINE: 'ONLINE',
});

/** Only these are selectable when recording new customer money. */
export const ACTIVE_PAYMENT_METHODS = Object.freeze(Object.values(PAYMENT_METHOD));

/** Retired methods that may still appear on old rows — never offered for new entries. */
export const LEGACY_PAYMENT_METHODS = Object.freeze(['PHONEPE', 'GOOGLE_PAY', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER']);

/** Everything that may appear on an existing row, including retired methods. */
export const ALL_PAYMENT_METHODS = Object.freeze([...Object.values(PAYMENT_METHOD), ...LEGACY_PAYMENT_METHODS]);

/** Anything that isn't literally CASH counts as "online" for cash-vs-online summaries. */
export const isOnlinePaymentMethod = (method) => method !== PAYMENT_METHOD.CASH;

/**
 * How a SHOP EXPENSE was paid — the same Cash/Online plus CREDIT, which means
 * no money left the drawer yet: the supplier is owed, to be paid later.
 * CREDIT is deliberately NOT a customer payment method — a customer payment
 * is money already received, never a promise to pay later.
 */
export const EXPENSE_PAYMENT_METHOD = Object.freeze({
  CASH: 'CASH',
  ONLINE: 'ONLINE',
  CREDIT: 'CREDIT',
});

export const ACTIVE_EXPENSE_PAYMENT_METHODS = Object.freeze(Object.values(EXPENSE_PAYMENT_METHOD));

/** Everything that may appear on an existing expense row, including retired methods. */
export const ALL_EXPENSE_PAYMENT_METHODS = Object.freeze([
  ...Object.values(EXPENSE_PAYMENT_METHOD),
  ...LEGACY_PAYMENT_METHODS,
]);

/**
 * What a shop expense was for. "All Expense" (no filter) is not a stored
 * value — it just means "don't filter by category".
 */
export const EXPENSE_CATEGORY = Object.freeze({
  MATERIAL: 'MATERIAL',
  LOSS: 'LOSS',
  OTHER: 'OTHER',
});

/**
 * Cash-drawer transaction kinds.
 *
 * CUSTOMER_PAYMENT flows through `repair_ledger` (money in, tied to a receipt).
 * SHOP_EXPENSE is money OUT — a part bought from a shop — and is deliberately
 * a separate table so it can never be mistaken for customer revenue.
 */
export const CASH_TXN_TYPE = Object.freeze({
  CUSTOMER_PAYMENT: 'CUSTOMER_PAYMENT',
  SHOP_EXPENSE: 'SHOP_EXPENSE',
});

/** A cash day is OPEN until the admin closes it. */
export const CASH_DAY_STATUS = Object.freeze({
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
});

/** Seeded into the `lead_sources` table; editable in Settings afterwards. */
export const DEFAULT_LEAD_SOURCES = Object.freeze([
  'Google Maps',
  'Google Ads',
  'WhatsApp',
  'Instagram',
  'Instagram Reels',
  'Facebook',
  'Referral',
  'Walk-in',
  'Existing Customer',
  'Other',
]);

/** Shop settings keys. Values live in the `shop_settings` table. */
export const SETTING_KEYS = Object.freeze({
  SHOP_NAME: 'shop_name',
  SHOP_NAME_MARATHI: 'shop_name_marathi',
  SHOP_ADDRESS_MARATHI: 'shop_address_marathi',
  SHOP_PHONE_1: 'shop_phone_1',
  SHOP_PHONE_2: 'shop_phone_2',
  RECEIPT_PREFIX: 'receipt_prefix',
  RECEIPT_TERMS_MARATHI: 'receipt_terms_marathi',
  RECEIPT_PAPER_SIZE: 'receipt_paper_size',
  RECEIPT_COPIES: 'receipt_copies',
  DEFAULT_WARRANTY_DAYS: 'default_warranty_days',
});

/** Postgres sequences created by the initial migration. */
export const SEQUENCES = Object.freeze({
  RECEIPT_NUMBER: 'repair_receipt_number_seq',
  LEDGER_ENTRY_NUMBER: 'repair_ledger_entry_no_seq',
});

export const TOKEN_TYPE = Object.freeze({
  LOGIN: 'login',
});

/** Outbound WhatsApp send lifecycle for one `whatsapp_notifications` row. */
export const WHATSAPP_STATUS = Object.freeze({
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
});

/** What the message was about. */
export const WHATSAPP_MESSAGE_TYPE = Object.freeze({
  RECEIPT: 'RECEIPT',
  JOB_DONE: 'JOB_DONE',
});

/**
 * Minimal role split, added specifically to gate Rate Card management
 * (telecallers should see prices, not change them). Every other page in the
 * app is deliberately left open to any logged-in admin, exactly as before —
 * this is not a general permissions system, just one door with a lock on it.
 * OWNER is the default for every existing/new account unless set otherwise,
 * so nobody is locked out of anything by this column's mere existence.
 */
export const ADMIN_ROLE = Object.freeze({
  OWNER: 'OWNER',
  STAFF: 'STAFF',
});

export const ACTIVE_ADMIN_ROLES = Object.freeze(Object.values(ADMIN_ROLE));
