import { StatusCodes } from 'http-status-codes';

/**
 * Central error catalog.
 *
 * Entries are either plain objects or functions (when the message needs to
 * quote a value back to the user). Throw them as:
 *   throw new AppError(Errors.REPAIR_NOT_FOUND);
 *   throw new AppError(Errors.CUSTOMER_MOBILE_EXISTS('9876543210'));
 */
export const Errors = Object.freeze({
  // ---- Generic (1xxx) ----
  INTERNAL_ERROR: {
    name: 'InternalError',
    message: 'Something went wrong. Please try again.',
    explanation: 'An unexpected error occurred while processing the request.',
    code: 1000,
    httpStatusCode: StatusCodes.INTERNAL_SERVER_ERROR,
  },
  NOT_FOUND: {
    name: 'NotFound',
    message: 'The requested resource was not found',
    explanation: 'No resource exists at the requested path.',
    code: 1001,
    httpStatusCode: StatusCodes.NOT_FOUND,
  },

  // ---- Auth (2xxx) ----
  UN_AUTHORIZE: {
    name: 'Unauthorized',
    message: 'You are not logged in',
    explanation: 'A valid bearer token is required for this endpoint.',
    code: 2000,
    httpStatusCode: StatusCodes.UNAUTHORIZED,
  },
  INVALID_TOKEN: {
    name: 'InvalidToken',
    message: 'Your session is invalid or has expired. Please log in again.',
    explanation: 'The supplied JWT could not be verified.',
    code: 2001,
    httpStatusCode: StatusCodes.UNAUTHORIZED,
  },
  INVALID_CREDENTIALS: {
    name: 'InvalidCredentials',
    message: 'Incorrect email or password',
    explanation: 'No active admin user matches the supplied credentials.',
    code: 2002,
    httpStatusCode: StatusCodes.UNAUTHORIZED,
  },
  ACCOUNT_INACTIVE: {
    name: 'AccountInactive',
    message: 'This account has been deactivated',
    explanation: 'The admin user exists but is marked inactive.',
    code: 2003,
    httpStatusCode: StatusCodes.FORBIDDEN,
  },
  FORBIDDEN: {
    name: 'Forbidden',
    message: 'You do not have permission to do this',
    explanation: 'This action is restricted to the shop owner.',
    code: 2004,
    httpStatusCode: StatusCodes.FORBIDDEN,
  },
  CURRENT_PASSWORD_INCORRECT: {
    name: 'CurrentPasswordIncorrect',
    message: 'Your current password is incorrect',
    explanation: 'The supplied current password does not match the stored hash.',
    code: 2004,
    httpStatusCode: StatusCodes.BAD_REQUEST,
  },

  // ---- Repair jobs (3xxx) ----
  REPAIR_NOT_FOUND: {
    name: 'RepairNotFound',
    message: 'Repair job not found',
    explanation: 'No repair job exists with the supplied id or receipt number.',
    code: 3000,
    httpStatusCode: StatusCodes.NOT_FOUND,
  },
  REPAIR_COMPLAINT_IMMUTABLE: {
    name: 'RepairComplaintImmutable',
    message: "The customer's original complaint cannot be changed",
    explanation:
      "The complaint is what the customer said when handing the phone over. Record findings in 'diagnosis' instead.",
    code: 3001,
    httpStatusCode: StatusCodes.BAD_REQUEST,
  },
  RECEIPT_NOT_FOUND: (receiptNumber) => ({
    name: 'ReceiptNotFound',
    message: `No repair found for receipt ${receiptNumber}`,
    explanation: 'Check the receipt number on the customer’s slip and try again.',
    code: 3004,
    httpStatusCode: StatusCodes.NOT_FOUND,
  }),
  DEVICE_UNLOCK_UNREADABLE: {
    name: 'DeviceUnlockUnreadable',
    message: 'The stored device unlock credential could not be read',
    explanation:
      'The credential was encrypted with a different key (DEVICE_SECRET_KEY may have changed). Ask the customer for it again.',
    code: 3003,
    httpStatusCode: StatusCodes.UNPROCESSABLE_ENTITY,
  },
  INVALID_REPAIR_STATUS: (status) => ({
    name: 'InvalidRepairStatus',
    message: `"${status}" is not a valid repair status`,
    explanation: 'The status must be one of the supported repair statuses.',
    code: 3002,
    httpStatusCode: StatusCodes.BAD_REQUEST,
  }),

  // ---- Customers (4xxx) ----
  CUSTOMER_NOT_FOUND: {
    name: 'CustomerNotFound',
    message: 'Customer not found',
    explanation: 'No customer exists with the supplied id.',
    code: 4000,
    httpStatusCode: StatusCodes.NOT_FOUND,
  },
  CUSTOMER_MOBILE_EXISTS: (mobile) => ({
    name: 'CustomerMobileExists',
    message: `Another customer is already registered with mobile ${mobile}`,
    explanation: 'Customer mobile numbers must be unique.',
    code: 4001,
    httpStatusCode: StatusCodes.CONFLICT,
  }),

  // ---- Engineers / lead handlers / lead sources (5xxx) ----
  ENGINEER_NOT_FOUND: {
    name: 'EngineerNotFound',
    message: 'Engineer not found',
    explanation: 'No engineer exists with the supplied id.',
    code: 5000,
    httpStatusCode: StatusCodes.NOT_FOUND,
  },
  ENGINEER_INACTIVE: {
    name: 'EngineerInactive',
    message: 'That engineer is deactivated and cannot be assigned new repairs',
    explanation: 'Reactivate the engineer first, or pick a different one.',
    code: 5001,
    httpStatusCode: StatusCodes.BAD_REQUEST,
  },
  LEAD_HANDLER_NOT_FOUND: {
    name: 'LeadHandlerNotFound',
    message: 'Lead handler not found',
    explanation: 'No lead handler exists with the supplied id.',
    code: 5002,
    httpStatusCode: StatusCodes.NOT_FOUND,
  },
  LEAD_SOURCE_NOT_FOUND: {
    name: 'LeadSourceNotFound',
    message: 'Lead source not found',
    explanation: 'No lead source exists with the supplied id.',
    code: 5003,
    httpStatusCode: StatusCodes.NOT_FOUND,
  },
  LEAD_SOURCE_EXISTS: (name) => ({
    name: 'LeadSourceExists',
    message: `A lead source named "${name}" already exists`,
    explanation: 'Lead source names must be unique.',
    code: 5004,
    httpStatusCode: StatusCodes.CONFLICT,
  }),
  DUPLICATE_NAME: (name) => ({
    name: 'DuplicateName',
    message: `"${name}" already exists`,
    explanation: 'That name is already in use.',
    code: 5005,
    httpStatusCode: StatusCodes.CONFLICT,
  }),

  // ---- Parts (6xxx) ----
  PART_NOT_FOUND: {
    name: 'PartNotFound',
    message: 'Spare part entry not found',
    explanation: 'No part exists with the supplied id on this repair job.',
    code: 6000,
    httpStatusCode: StatusCodes.NOT_FOUND,
  },

  // ---- Ledger / payments (7xxx) ----
  LEDGER_ENTRY_NOT_FOUND: {
    name: 'LedgerEntryNotFound',
    message: 'Payment entry not found',
    explanation: 'No ledger entry exists with the supplied id on this repair job.',
    code: 7000,
    httpStatusCode: StatusCodes.NOT_FOUND,
  },
  LEDGER_ALREADY_REVERSED: {
    name: 'LedgerAlreadyReversed',
    message: 'That payment has already been reversed',
    explanation: 'A payment entry can only be reversed once.',
    code: 7001,
    httpStatusCode: StatusCodes.CONFLICT,
  },
  LEDGER_CANNOT_REVERSE_REVERSAL: {
    name: 'LedgerCannotReverseReversal',
    message: 'A reversal entry cannot itself be reversed',
    explanation: 'To undo a reversal, record a fresh payment instead.',
    code: 7002,
    httpStatusCode: StatusCodes.BAD_REQUEST,
  },
  LEDGER_IMMUTABLE: {
    name: 'LedgerImmutable',
    message: 'Payment records cannot be edited or deleted',
    explanation:
      'The ledger is append-only so the cash memo always reconciles. Reverse the entry instead — the correction stays visible.',
    code: 7003,
    httpStatusCode: StatusCodes.METHOD_NOT_ALLOWED,
  },
  INVALID_PAYMENT_AMOUNT: {
    name: 'InvalidPaymentAmount',
    message: 'Payment amount must be greater than zero',
    explanation: 'Use the reverse endpoint to undo a payment rather than posting a negative amount.',
    code: 7004,
    httpStatusCode: StatusCodes.BAD_REQUEST,
  },

  // ---- WhatsApp (76xx) ----
  WHATSAPP_NOT_CONFIGURED: {
    name: 'WhatsAppNotConfigured',
    message: 'WhatsApp is not set up yet',
    explanation: 'Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in the backend .env, then restart the server.',
    code: 7600,
    httpStatusCode: StatusCodes.SERVICE_UNAVAILABLE,
  },
  WHATSAPP_NO_PHONE_NUMBER: {
    name: 'WhatsAppNoPhoneNumber',
    message: 'This customer has no mobile number on file',
    explanation: 'Add a mobile number to the customer before sending a WhatsApp message.',
    code: 7601,
    httpStatusCode: StatusCodes.BAD_REQUEST,
  },
  WHATSAPP_SEND_FAILED: (message) => ({
    name: 'WhatsAppSendFailed',
    message: message || 'WhatsApp could not deliver this message',
    explanation: 'Meta rejected or failed to send the message. Check the notification history for details.',
    code: 7602,
    httpStatusCode: StatusCodes.BAD_GATEWAY,
  }),
  WHATSAPP_NOTIFICATION_NOT_FOUND: {
    name: 'WhatsAppNotificationNotFound',
    message: 'WhatsApp notification not found',
    explanation: 'No notification exists with the supplied id.',
    code: 7603,
    httpStatusCode: StatusCodes.NOT_FOUND,
  },

  // ---- Cash day / shop expenses (75xx) ----
  CASH_DAY_CLOSED: (date) => ({
    name: 'CashDayClosed',
    message: `The cash memo for ${date} is already closed`,
    explanation: 'Re-open the day before recording or changing anything for it.',
    code: 7500,
    httpStatusCode: StatusCodes.CONFLICT,
  }),
  CASH_DAY_NOT_OPENED: (date) => ({
    name: 'CashDayNotOpened',
    message: `No cash memo has been opened for ${date}`,
    explanation: 'Enter the opening balance for the day first.',
    code: 7501,
    httpStatusCode: StatusCodes.NOT_FOUND,
  }),
  SHOP_EXPENSE_NOT_FOUND: {
    name: 'ShopExpenseNotFound',
    message: 'Shop expense not found',
    explanation: 'No expense exists with the supplied id.',
    code: 7502,
    httpStatusCode: StatusCodes.NOT_FOUND,
  },
  SUPPLIER_NOT_FOUND: {
    name: 'SupplierNotFound',
    message: 'Supplier not found',
    explanation: 'No supplier exists with the supplied id.',
    code: 7503,
    httpStatusCode: StatusCodes.NOT_FOUND,
  },
  ESTIMATE_NOT_FOUND: {
    name: 'EstimateNotFound',
    message: 'Estimate not found',
    explanation: 'No estimate exists with the supplied id on this repair.',
    code: 7504,
    httpStatusCode: StatusCodes.NOT_FOUND,
  },

  // ---- Call logs (8xxx) ----
  CALL_LOG_NOT_FOUND: {
    name: 'CallLogNotFound',
    message: 'Call log not found',
    explanation: 'No call log exists with the supplied id.',
    code: 8000,
    httpStatusCode: StatusCodes.NOT_FOUND,
  },
  CALL_LOG_IMMUTABLE: {
    name: 'CallLogImmutable',
    message: 'Call records cannot be edited or deleted',
    explanation: 'The calling history is append-only. Add a new call log instead.',
    code: 8001,
    httpStatusCode: StatusCodes.METHOD_NOT_ALLOWED,
  },

  // ---- Settings (9xxx) ----
  SETTING_NOT_FOUND: (key) => ({
    name: 'SettingNotFound',
    message: `Setting "${key}" not found`,
    explanation: 'No shop setting exists with that key.',
    code: 9000,
    httpStatusCode: StatusCodes.NOT_FOUND,
  }),

  // ---- Rate Card (10xxx) ----
  RATE_CARD_BRAND_NOT_FOUND: {
    name: 'RateCardBrandNotFound',
    message: 'Brand not found',
    explanation: 'No rate card brand exists with the supplied id.',
    code: 10000,
    httpStatusCode: StatusCodes.NOT_FOUND,
  },
  RATE_CARD_BRAND_EXISTS: (name) => ({
    name: 'RateCardBrandExists',
    message: `Brand "${name}" already exists`,
    explanation: 'Use the existing brand instead of creating a duplicate.',
    code: 10001,
    httpStatusCode: StatusCodes.CONFLICT,
  }),
  RATE_CARD_MODEL_NOT_FOUND: {
    name: 'RateCardModelNotFound',
    message: 'Model not found',
    explanation: 'No rate card model exists with the supplied id.',
    code: 10002,
    httpStatusCode: StatusCodes.NOT_FOUND,
  },
  RATE_CARD_MODEL_EXISTS: (name) => ({
    name: 'RateCardModelExists',
    message: `Model "${name}" already exists for this brand`,
    explanation: 'Use the existing model instead of creating a duplicate.',
    code: 10003,
    httpStatusCode: StatusCodes.CONFLICT,
  }),
  RATE_CARD_PART_NOT_FOUND: {
    name: 'RateCardPartNotFound',
    message: 'Part not found',
    explanation: 'No rate card part exists with the supplied id.',
    code: 10004,
    httpStatusCode: StatusCodes.NOT_FOUND,
  },
  RATE_CARD_PART_EXISTS: (name) => ({
    name: 'RateCardPartExists',
    message: `Part "${name}" already exists`,
    explanation: 'Use the existing part instead of creating a duplicate.',
    code: 10005,
    httpStatusCode: StatusCodes.CONFLICT,
  }),
  RATE_TYPE_NOT_FOUND: {
    name: 'RateTypeNotFound',
    message: 'Rate type not found',
    explanation: 'No rate type exists with the supplied id.',
    code: 10006,
    httpStatusCode: StatusCodes.NOT_FOUND,
  },
  RATE_TYPE_EXISTS: (name) => ({
    name: 'RateTypeExists',
    message: `Rate type "${name}" already exists`,
    explanation: 'Use the existing rate type instead of creating a duplicate.',
    code: 10007,
    httpStatusCode: StatusCodes.CONFLICT,
  }),
  RATE_CARD_ENTRY_NOT_FOUND: {
    name: 'RateCardEntryNotFound',
    message: 'Rate not found',
    explanation: 'No rate exists with the supplied id.',
    code: 10008,
    httpStatusCode: StatusCodes.NOT_FOUND,
  },
  RATE_CARD_ENTRY_EXISTS: {
    name: 'RateCardEntryExists',
    message: 'A rate of this type already exists for this model and part',
    explanation: 'Edit the existing rate instead of adding a duplicate rate type.',
    code: 10009,
    httpStatusCode: StatusCodes.CONFLICT,
  },
});

export default Errors;
