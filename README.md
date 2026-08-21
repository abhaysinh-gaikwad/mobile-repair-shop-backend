# Mobile Repair Shop — Backend API

Node.js + Express + PostgreSQL API for a single mobile repair shop.
Standalone: its own database, its own auth, no Kafka/Redis/microservices.

## Quick start

```bash
cp .env.sample .env      # then set DB_PASSWORD and LOGIN_JWT_SECRET
npm install
npm run db:setup         # create database + migrate + seed
npm run dev              # http://localhost:4200
```

Health check: `GET /healthcheck`

## Seeded login

Set `OWNER_EMAIL` / `OWNER_PASSWORD` in `.env` **before** running `db:setup`.
Defaults: `owner@sushantmobile.local` / `changeme123` — change these before real use.

## Architecture

```
Router → Controller (thin) → Service (one class per use-case) → Sequelize
```

- **`@src` alias** (Babel `module-resolver`) — never relative `../../` imports.
- **Services** extend `BaseHandler` (`src/libs/logicBase.js`) and implement one
  `async run()`. Inputs come from `this.args`, the transaction from
  `this.dbTransaction`.
- **Transactions are declarative**: `contextMiddleware(true)` opens one for
  write routes; `BaseHandler` commits on success and rolls back on error. No
  service ever calls `.commit()`.
- **Validation** is AJV JSON Schema in `src/json-schemas/`, always with
  `additionalProperties: false`.
- **Responses**: `{ data, errors: [] }` on success, `{ data: {}, errors: {...} }`
  on failure. Every service must return something — `sendResponse` treats an
  empty result as a bug.

## The money model — read this before touching payments

There is exactly **one** money table: **`repair_ledger`**. It is the shop's
cash-memo notebook in digital form, and it is **immutable and append-only**:

- No UPDATE and no DELETE route exists for it, and it has no `updated_at`.
- A mistake is corrected by posting a **REVERSAL** row: a negative amount
  linked to the original with a **mandatory reason**. Both rows stay visible.
- Because reversals are negative, `SUM(amount)` is always the correct answer
  for a job, a day, or all time — no filtering, no `is_deleted` flag.
- A partial unique index (`repair_ledger_one_reversal_per_entry_idx`) enforces
  one-reversal-per-entry **in the database**, not just in the service.

Billing / cash memo endpoints are a pure *query surface* over this table.
Never add a second table that also records money.

## Receipt & ledger numbers

Both come from Postgres `SEQUENCE`s (`repair_receipt_number_seq`,
`repair_ledger_entry_no_seq`). `nextval` is atomic, so concurrent creation can
never produce a duplicate — verified with 12 simultaneous creates.

A failed insert **burns a number**, leaving a gap. That is deliberate: a gap is
harmless, a duplicated receipt number on a customer document is not. Never use
`COUNT(*) + 1`, and never catch-unique-violation-and-retry (the request
transaction has no savepoints, so a real violation would poison it).

## Device unlock credential (sensitive)

The screen-lock PIN / password / pattern captured at intake so the engineer can
test the phone. **Never** a Google, Apple, email or banking password.

- Encrypted at rest with **AES-256-GCM** (`src/utils/crypto.utils.js`), keyed by
  `DEVICE_SECRET_KEY`. Encryption, not hashing, because it must be read back.
- The column is excluded by the model's **`defaultScope`**, so it cannot be
  serialized into a list response, the receipt, or a report by accident.
- Decryption happens in exactly one place: `POST /repairs/:id/device-unlock/reveal`.
  It is a POST because it is an audited action with a side effect and keeps the
  value out of URLs and browser history.
- Every reveal writes a row to `device_unlock_access_logs` (who, which repair,
  when, from which IP). Append-only.
- **Changing `DEVICE_SECRET_KEY` makes existing credentials unreadable** — the
  reveal endpoint returns a clear error rather than garbage.

## Repeat repairs

When a delivered phone comes back it becomes a **brand new repair job with its
own receipt number**. The old job is never reopened or edited.

`previous_repair_job_id` + `repeat_of_receipt` record the lineage only.
`GET /repairs/:id/device-history` returns every repair on the same handset,
matched by **IMEI** (falling back to customer + brand + model when no IMEI was
recorded, reported as `matchedBy`).

## WhatsApp receipt notifications

Sends the repair receipt to the customer's WhatsApp via **Meta's Cloud API
directly** — no Twilio, no third-party BSP.

**Setup** (`.env`):

```env
WHATSAPP_ACCESS_TOKEN=            # from Meta Business Manager — NEVER sent to the frontend
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_API_VERSION=v21.0
WHATSAPP_RECEIPT_TEMPLATE_NAME=repair_receipt   # must be an APPROVED template in Meta Business Manager
WHATSAPP_TEMPLATE_LANGUAGE=en
WHATSAPP_DEFAULT_COUNTRY_CODE=91  # prepended to a saved 10-digit number with no country code
```

Until `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` are both set, `POST
/repairs/:id/whatsapp/send-receipt` returns a clean `503 WhatsAppNotConfigured`
rather than attempting a call.

**Why a template, not free text:** Meta requires a pre-approved template for
any business-initiated message outside the customer's 24-hour service window —
a "your receipt is ready" notification always is. The template must be created
and approved in Meta Business Manager first; this code does not (and cannot)
create one for you. Whatever the template's approved placeholder order is, it
must match `buildReceiptTemplateParams()` in
`src/services/whatsapp/sendReceiptNotification.service.js` — Meta positions
`{{1}}, {{2}}, …`, it doesn't name them.

**Architecture — kept deliberately separate from repair/payment logic:**

- `src/integrations/whatsapp/whatsappClient.js` — the ONLY file that knows
  Meta's Graph API shape (auth header, endpoint, error envelope). Exposes
  `sendTemplateMessage()` and `sendDocumentMessage()` (document-sending is
  wired for later — see PDF note below).
- `src/services/whatsapp/sendReceiptNotification.service.js` — maps a
  `RepairJob` onto the template's placeholders. Has no idea how Graph API auth
  works; the client has no idea what a repair is.
- `whatsapp_notifications` table — one row per **attempt** (success or
  failure), not a single mutable "last status" field. **Written outside the
  request transaction**, on purpose: if the send itself fails and the outer
  transaction rolls back, the audit row must still survive — otherwise a
  failure would leave literally no trace it was ever attempted.

**No PDF yet.** There's no PDF generation or file storage (S3, etc.) anywhere
in this codebase — the printed receipt is a browser-rendered React page, not a
server-side document. The message currently sends receipt details as template
text only. `sendDocumentMessage()` is ready to use once PDF rendering +
hosting exists; Meta needs a real public HTTPS URL to fetch the file from
(never localhost).

## Engineer vs Sales / Lead person

Two different people, deliberately kept apart:

| | Table | Meaning |
|---|---|---|
| **Engineer** | `engineers` | Actually repairs the phone. Assigned to the repair job. |
| **Sales / Lead person** | `lead_handlers` | Brought the customer in (WhatsApp, Instagram, calls). Recorded against the lead, never the repair work. |

Their reports are separate endpoints with separate filters — mixing them would
make both sets of numbers meaningless.

## Reports

Each report takes only the filters that matter to it (`src/services/reports/`):

| Report | Filters |
|---|---|
| `/reports/repair-summary` | Date + Status + Engineer |
| `/reports/delivery` | Date + Engineer + Status (dates on `delivered_at`) |
| `/reports/collection` | Date + Payment Method |
| `/reports/engineers` | Date + Engineer + Status |
| `/reports/lead-sources`, `/reports/lead-handlers` | Date + Lead Source + Lead Person |

Dates accept a `preset` (`TODAY`, `THIS_WEEK`, `LAST_MONTH`, `THIS_YEAR`,
`ALL_TIME`, …) or `CUSTOM` with `dateFrom`/`dateTo`. All boundaries resolve in
the **shop's timezone** (`Asia/Kolkata`) via `resolveDateRange`, so "This Month"
means the shop's calendar month, not UTC's.

## Other invariants

- **`customer_complaint` is immutable.** It is what the customer said at
  intake and is printed on their receipt. Findings go in `diagnosis`.
- **Call logs are append-only** — no update/delete route.
- **Engineers/handlers are deactivated, never deleted** — historical jobs must
  keep pointing at whoever did the work.
- **Status transitions are unrestricted** by design; a real shop backtracks.
  Every change writes a `repair_status_history` row in the same transaction.

## Commands

```bash
npm run dev              # nodemon + babel-node
npm run build && npm start
npm run lint             # eslint
npm run db:migrate       # apply migrations
npm run db:migrate:undo  # roll back the last one
npm run db:reset         # drop + recreate + migrate + seed
```

## Backups

The shop's financial records live only in this database. Set up a daily dump:

```bash
pg_dump -h localhost -p 5432 -U postgres mobile_repair_shop \
  | gzip > backups/mobile_repair_shop_$(date +%F).sql.gz
```
# mobile-repair-shop-frontend
