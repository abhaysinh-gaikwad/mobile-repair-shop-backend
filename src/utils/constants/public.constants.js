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

/**
 * Which stage of the job the money was taken at.
 *
 * MANUAL is the odd one out: it belongs to a Cash Memo entry that has no
 * repair job at all (see LEDGER_SOURCE), so "which stage" is meaningless for
 * it. It exists because the column is NOT NULL, and labelling such a row
 * ADVANCE or FINAL would be an outright lie about money.
 */
export const PAYMENT_TYPE = Object.freeze({
  ADVANCE: 'ADVANCE',
  PART: 'PART',
  FINAL: 'FINAL',
  MANUAL: 'MANUAL',
});

/** The payment stages that can be chosen against a real repair job. */
export const REPAIR_PAYMENT_TYPES = Object.freeze([
  PAYMENT_TYPE.ADVANCE,
  PAYMENT_TYPE.PART,
  PAYMENT_TYPE.FINAL,
]);

/**
 * Whether a ledger row came from a repair receipt or was entered by hand.
 *
 * MANUAL covers both "a customer paid for something with no repair job" and
 * the shop's older paper records from before this software, many of which
 * have no receipt number at all. A database CHECK constraint enforces the
 * shape of each kind — see the 20260905150000 migration.
 */
export const LEDGER_SOURCE = Object.freeze({
  REPAIR_JOB: 'REPAIR_JOB',
  MANUAL: 'MANUAL',
});

export const ACTIVE_LEDGER_SOURCES = Object.freeze(Object.values(LEDGER_SOURCE));

/**
 * Lifecycle of a payment entered with "Payment Received" left UNTICKED.
 *
 * PENDING rows live only in `unconfirmed_payments` — never in
 * `repair_ledger` — so they cannot affect a job's balance or any Cash Memo
 * total until a person explicitly resolves them. CONFIRMED means a real
 * ledger row was created for it (see `confirmedLedgerEntryId`); REJECTED
 * means staff decided the money was never actually received and no ledger
 * row will ever be created for it.
 */
export const UNCONFIRMED_PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  REJECTED: 'REJECTED',
});

export const ACTIVE_UNCONFIRMED_PAYMENT_STATUSES = Object.freeze(Object.values(UNCONFIRMED_PAYMENT_STATUS));

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
 * Who someone is in the shop. STRING-backed (see REPAIR_STATUS for why not a
 * Postgres ENUM).
 *
 * SUPER_ADMIN and TELECALLER replace the earlier OWNER/STAFF pair — the
 * 20260905 migration rewrites existing rows in place, so nobody's access
 * changes. The old names are gone rather than kept as aliases: two spellings
 * of the same role is exactly how permission bugs get in.
 */
export const ADMIN_ROLE = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  TELECALLER: 'TELECALLER',
  MARKETING: 'MARKETING',
  ENGINEER: 'ENGINEER',
});

export const ACTIVE_ADMIN_ROLES = Object.freeze(Object.values(ADMIN_ROLE));

export const ADMIN_ROLE_LABELS = Object.freeze({
  [ADMIN_ROLE.SUPER_ADMIN]: 'Super Admin',
  [ADMIN_ROLE.TELECALLER]: 'Telecaller / Lead Person',
  [ADMIN_ROLE.MARKETING]: 'Marketing Person',
  [ADMIN_ROLE.ENGINEER]: 'Engineer',
});

/**
 * Whether a telecaller is currently in the Round Robin rotation.
 *
 * Separate from `isActive` on purpose: deactivating an account is an admin
 * action about LOGIN, while "on leave today" is an everyday scheduling fact
 * that shouldn't require disabling somebody's ability to sign in and see
 * their existing leads.
 */
export const STAFF_AVAILABILITY = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  ON_LEAVE: 'ON_LEAVE',
  UNAVAILABLE: 'UNAVAILABLE',
});

export const ACTIVE_STAFF_AVAILABILITY = Object.freeze(Object.values(STAFF_AVAILABILITY));

// ------------------------------------------------------------------- RBAC
/**
 * The things permissions are granted ON. One entry per area of the app that
 * is worth restricting separately — deliberately coarse: a shop with four
 * roles does not need per-field permissions.
 */
export const PERMISSION_MODULE = Object.freeze({
  DASHBOARD: 'DASHBOARD',
  REPAIRS: 'REPAIRS',
  CRM: 'CRM',
  RATE_CARD: 'RATE_CARD',
  CUSTOMERS: 'CUSTOMERS',
  BILLING: 'BILLING',
  REPORTS: 'REPORTS',
  STAFF: 'STAFF',
  USERS: 'USERS',
  SETTINGS: 'SETTINGS',
});

export const PERMISSION_ACTION = Object.freeze({
  VIEW: 'VIEW',
  CREATE: 'CREATE',
  EDIT: 'EDIT',
  DELETE: 'DELETE',
});

export const PERMISSION_MODULE_LABELS = Object.freeze({
  [PERMISSION_MODULE.DASHBOARD]: 'Dashboard',
  [PERMISSION_MODULE.REPAIRS]: 'Repairs',
  [PERMISSION_MODULE.CRM]: 'CRM / Leads',
  [PERMISSION_MODULE.RATE_CARD]: 'Rate Card',
  [PERMISSION_MODULE.CUSTOMERS]: 'Customers',
  [PERMISSION_MODULE.BILLING]: 'Billing / Cash Memo',
  [PERMISSION_MODULE.REPORTS]: 'Reports',
  [PERMISSION_MODULE.STAFF]: 'Technicians, Sales & Suppliers',
  [PERMISSION_MODULE.USERS]: 'User Management',
  [PERMISSION_MODULE.SETTINGS]: 'Settings',
});

/** A permission is the string "MODULE:ACTION", e.g. "RATE_CARD:EDIT". */
export const permission = (module, action) => `${module}:${action}`;

/** Every permission that exists — the full grid the Super Admin ticks boxes in. */
export const ALL_PERMISSIONS = Object.freeze(
  Object.values(PERMISSION_MODULE).flatMap((module) =>
    Object.values(PERMISSION_ACTION).map((action) => permission(module, action)),
  ),
);

const viewOnly = (...modules) => modules.map((module) => permission(module, PERMISSION_ACTION.VIEW));

/**
 * The DEFAULT permissions each role carries. A user's effective permissions
 * are these, plus their individual `grant` list, minus their individual
 * `revoke` list — see resolvePermissions() in permission.helpers.js.
 *
 * SUPER_ADMIN is deliberately NOT listed: it is special-cased to hold every
 * permission unconditionally, so adding a new module later can never
 * accidentally lock the owner out of it.
 */
export const ROLE_PERMISSIONS = Object.freeze({
  [ADMIN_ROLE.SUPER_ADMIN]: Object.freeze([...ALL_PERMISSIONS]),

  // Works the CRM all day; sees prices but may not change them (the original
  // reason a role column was added at all). Rate Card EDIT is exactly the
  // kind of thing granted per-user as an override.
  //
  // NOTE the missing CRM:DELETE. Throughout the CRM that permission means
  // "supervises the whole board" — it unlocks seeing every telecaller's
  // leads, the distribution dashboard, and manual reassignment. A telecaller
  // must NOT have it by default, or each of them could reassign the others'
  // leads and Round Robin would stop meaning anything.
  [ADMIN_ROLE.TELECALLER]: Object.freeze([
    permission(PERMISSION_MODULE.CRM, PERMISSION_ACTION.VIEW),
    permission(PERMISSION_MODULE.CRM, PERMISSION_ACTION.CREATE),
    permission(PERMISSION_MODULE.CRM, PERMISSION_ACTION.EDIT),
    ...viewOnly(
      PERMISSION_MODULE.DASHBOARD,
      PERMISSION_MODULE.RATE_CARD,
      PERMISSION_MODULE.REPAIRS,
      PERMISSION_MODULE.CUSTOMERS,
      // Needed to populate the technician dropdown on the repair screens.
      PERMISSION_MODULE.STAFF,
    ),
  ]),

  // Runs the ad/social side: needs to see where leads come from and create
  // leads by hand, but has no business in billing or repairs.
  [ADMIN_ROLE.MARKETING]: Object.freeze([
    permission(PERMISSION_MODULE.CRM, PERMISSION_ACTION.VIEW),
    permission(PERMISSION_MODULE.CRM, PERMISSION_ACTION.CREATE),
    ...viewOnly(PERMISSION_MODULE.DASHBOARD, PERMISSION_MODULE.REPORTS, PERMISSION_MODULE.RATE_CARD),
  ]),

  // Repairs the phones. EDIT on REPAIRS is what allows a status update; there
  // is deliberately no CREATE (jobs are booked at the counter), no DELETE,
  // and nothing at all on money, customers or users.
  [ADMIN_ROLE.ENGINEER]: Object.freeze([
    permission(PERMISSION_MODULE.REPAIRS, PERMISSION_ACTION.VIEW),
    permission(PERMISSION_MODULE.REPAIRS, PERMISSION_ACTION.EDIT),
    // STAFF:VIEW only so the technician dropdown loads. Note there is
    // deliberately nothing under BILLING: the payment routes that live at
    // /repairs/:id/payments are gated on BILLING, so REPAIRS:EDIT lets an
    // engineer update the job but never take or reverse money.
    ...viewOnly(PERMISSION_MODULE.DASHBOARD, PERMISSION_MODULE.RATE_CARD, PERMISSION_MODULE.STAFF),
  ]),
});

// -------------------------------------------------------------------- CRM
/**
 * Where an enquiry came from. Stored as a STRING on the lead so a source can
 * be renamed later without rewriting history — same reasoning as
 * repair_jobs' snapshotted lead source.
 */
export const LEAD_SOURCE = Object.freeze({
  WHATSAPP: 'WHATSAPP',
  INSTAGRAM: 'INSTAGRAM',
  FACEBOOK: 'FACEBOOK',
  MANUAL: 'MANUAL',
  OTHER: 'OTHER',
});

export const ACTIVE_LEAD_SOURCES = Object.freeze(Object.values(LEAD_SOURCE));

export const LEAD_SOURCE_LABELS = Object.freeze({
  [LEAD_SOURCE.WHATSAPP]: 'WhatsApp',
  [LEAD_SOURCE.INSTAGRAM]: 'Instagram',
  [LEAD_SOURCE.FACEBOOK]: 'Facebook',
  [LEAD_SOURCE.MANUAL]: 'Added by hand',
  [LEAD_SOURCE.OTHER]: 'Other',
});

/**
 * Lead statuses — the shop's OWN vocabulary, taken from the "CALL STATUS"
 * column of their existing CRM spreadsheet rather than invented here.
 *
 * The generic NEW/CONTACTED/FOLLOW_UP set that was here first was replaced
 * once the real sheet arrived: telecallers already think in "ringing",
 * "switch off", "out of coverage", and asking them to translate that into
 * someone else's words is how a CRM stops being used. Every value below
 * appears in their data.
 *
 * STRING-backed (see REPAIR_STATUS) so this list can grow without a migration.
 */
export const LEAD_STATUS = Object.freeze({
  NEW: 'NEW',
  INTERESTED: 'INTERESTED',
  RINGING: 'RINGING',
  CALL_BACK: 'CALL_BACK',
  OUT_OF_COVERAGE: 'OUT_OF_COVERAGE',
  OUT_OF_LOCATION: 'OUT_OF_LOCATION',
  SWITCH_OFF: 'SWITCH_OFF',
  MATERIAL_NOT_AVAILABLE: 'MATERIAL_NOT_AVAILABLE',
  RATES_GIVEN: 'RATES_GIVEN',
  OTHER: 'OTHER',
  // ---- finished, won ----
  SHOP_VISIT_DONE: 'SHOP_VISIT_DONE',
  WORK_DONE: 'WORK_DONE',
  // ---- finished, lost ----
  NOT_INTERESTED: 'NOT_INTERESTED',
  NOT_DONE: 'NOT_DONE',
  JUST_TO_SAVE_NUMBER: 'JUST_TO_SAVE_NUMBER',
  SECOND_HAND_MOBILE: 'SECOND_HAND_MOBILE',
  WANT_TO_JOIN_CLASS: 'WANT_TO_JOIN_CLASS',
});

export const ACTIVE_LEAD_STATUSES = Object.freeze(Object.values(LEAD_STATUS));

/** Their spelling, corrected only where it was a typo (INTRESTED -> Interested). */
export const LEAD_STATUS_LABELS = Object.freeze({
  [LEAD_STATUS.NEW]: 'New',
  [LEAD_STATUS.INTERESTED]: 'Interested',
  [LEAD_STATUS.RINGING]: 'Ringing',
  [LEAD_STATUS.CALL_BACK]: 'Call Back',
  [LEAD_STATUS.OUT_OF_COVERAGE]: 'Out of Coverage',
  [LEAD_STATUS.OUT_OF_LOCATION]: 'Out of Location',
  [LEAD_STATUS.SWITCH_OFF]: 'Switch Off',
  [LEAD_STATUS.MATERIAL_NOT_AVAILABLE]: 'Material Not Available',
  [LEAD_STATUS.RATES_GIVEN]: 'Rates Given',
  [LEAD_STATUS.OTHER]: 'Other',
  [LEAD_STATUS.SHOP_VISIT_DONE]: 'Shop Visit Done',
  [LEAD_STATUS.WORK_DONE]: 'Work Done',
  [LEAD_STATUS.NOT_INTERESTED]: 'Not Interested',
  [LEAD_STATUS.NOT_DONE]: 'Not Done',
  [LEAD_STATUS.JUST_TO_SAVE_NUMBER]: 'Just To Save Number',
  [LEAD_STATUS.SECOND_HAND_MOBILE]: 'Second Hand Mobile',
  [LEAD_STATUS.WANT_TO_JOIN_CLASS]: 'Wants To Join Class',
});

/**
 * Seventeen statuses is a lot to scan, so each one belongs to exactly one of
 * three groups. The board is filtered and coloured by GROUP — "is this still
 * being worked, did we win it, did we lose it" — which is the only question
 * anyone actually asks of the whole list at once.
 */
export const LEAD_STATUS_GROUP = Object.freeze({ OPEN: 'OPEN', WON: 'WON', LOST: 'LOST' });

export const LEAD_STATUS_GROUPS = Object.freeze({
  [LEAD_STATUS_GROUP.OPEN]: Object.freeze([
    LEAD_STATUS.NEW,
    LEAD_STATUS.INTERESTED,
    LEAD_STATUS.RINGING,
    LEAD_STATUS.CALL_BACK,
    LEAD_STATUS.OUT_OF_COVERAGE,
    LEAD_STATUS.OUT_OF_LOCATION,
    LEAD_STATUS.SWITCH_OFF,
    LEAD_STATUS.MATERIAL_NOT_AVAILABLE,
    LEAD_STATUS.RATES_GIVEN,
    LEAD_STATUS.OTHER,
  ]),
  // The customer actually turned up, or the job was completed.
  [LEAD_STATUS_GROUP.WON]: Object.freeze([LEAD_STATUS.SHOP_VISIT_DONE, LEAD_STATUS.WORK_DONE]),
  [LEAD_STATUS_GROUP.LOST]: Object.freeze([
    LEAD_STATUS.NOT_INTERESTED,
    LEAD_STATUS.NOT_DONE,
    LEAD_STATUS.JUST_TO_SAVE_NUMBER,
    LEAD_STATUS.SECOND_HAND_MOBILE,
    LEAD_STATUS.WANT_TO_JOIN_CLASS,
  ]),
});

export const groupForLeadStatus = (status) =>
  Object.keys(LEAD_STATUS_GROUPS).find((group) => LEAD_STATUS_GROUPS[group].includes(status)) ??
  LEAD_STATUS_GROUP.OPEN;

/**
 * Statuses that mean the lead is finished — won or lost.
 *
 * Drives duplicate handling: a repeat enquiry is folded into an OPEN lead
 * rather than creating a second one, while a customer whose previous lead is
 * CLOSED gets a new lead that still goes back to their original telecaller.
 */
export const CLOSED_LEAD_STATUSES = Object.freeze([
  ...LEAD_STATUS_GROUPS[LEAD_STATUS_GROUP.WON],
  ...LEAD_STATUS_GROUPS[LEAD_STATUS_GROUP.LOST],
]);

export const isClosedLeadStatus = (status) => CLOSED_LEAD_STATUSES.includes(status);
