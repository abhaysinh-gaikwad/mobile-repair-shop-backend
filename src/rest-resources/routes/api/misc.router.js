import express from 'express';

import {
  collectionReportSchema,
  createLeadHandlerSchema,
  createLeadSourceSchema,
  createSupplierSchema,
  customerIdSchema,
  dailyCollectionSchema,
  deliveryReportSchema,
  engineerReportSchema,
  expenseReportSchema,
  getCashMemoSchema,
  getCustomersSchema,
  leadReportSchema,
  listActiveSchema,
  pendingPaymentsSchema,
  repairReportSchema,
  supplierIdSchema,
  toggleSchema,
  updateCustomerSchema,
  updateLeadHandlerSchema,
  updateLeadSourceSchema,
  updateSettingsSchema,
  updateSupplierSchema,
} from '@src/json-schemas/misc/misc.schema';
import {
  addManualLedgerEntrySchema,
  addPaymentByReceiptSchema,
  addShopExpenseSchema,
  closeCashDaySchema,
  getCashDaySchema,
  lookupReceiptSchema,
  openCashDaySchema,
  reopenCashDaySchema,
  reverseManualEntrySchema,
  shopExpenseIdSchema,
} from '@src/json-schemas/billing/cashDay.schema';
import BillingController from '@src/rest-resources/controllers/billing.controller';
import CustomerController from '@src/rest-resources/controllers/customer.controller';
import LeadController from '@src/rest-resources/controllers/lead.controller';
import ReportController from '@src/rest-resources/controllers/report.controller';
import SettingController from '@src/rest-resources/controllers/setting.controller';
import SupplierController from '@src/rest-resources/controllers/supplier.controller';
import WhatsAppController from '@src/rest-resources/controllers/whatsapp.controller';
import contextMiddleware from '@src/rest-resources/middlewares/context.middleware';
import { isAuthenticated } from '@src/rest-resources/middlewares/isAuthenticated';
import { requirePermission } from '@src/rest-resources/middlewares/requirePermission';
import { requestValidationMiddleware } from '@src/rest-resources/middlewares/requestValidation.middleware';
import { PERMISSION_ACTION, PERMISSION_MODULE, permission } from '@src/utils/constants/public.constants';

/**
 * Every route in this file now names the permission it needs. Previously they
 * required only "is logged in", which is why RBAC had to reach in here at all:
 * an Engineer account with no billing rights could still have called
 * /billing/ledger directly, whatever the sidebar showed them.
 */
const read = (perm, schema, handler) => [
  contextMiddleware(false),
  isAuthenticated(),
  requirePermission(perm),
  ...(schema ? [requestValidationMiddleware(schema)] : []),
  handler,
];
const write = (perm, schema, handler) => [
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(perm),
  ...(schema ? [requestValidationMiddleware(schema)] : []),
  handler,
];

const P = (module, action) => permission(PERMISSION_MODULE[module], PERMISSION_ACTION[action]);

// ------------------------------------------------------------- customers
export const customerRouter = express.Router({ mergeParams: true });
customerRouter.get('/', ...read(P('CUSTOMERS', 'VIEW'), getCustomersSchema, CustomerController.getCustomers));
customerRouter.get('/:id', ...read(P('CUSTOMERS', 'VIEW'), customerIdSchema, CustomerController.getCustomerById));
customerRouter.put('/:id', ...write(P('CUSTOMERS', 'EDIT'), updateCustomerSchema, CustomerController.updateCustomer));

// ---------------------------------------------------------- lead handlers
export const leadHandlerRouter = express.Router({ mergeParams: true });
leadHandlerRouter.get('/', ...read(P('STAFF', 'VIEW'), listActiveSchema, LeadController.getLeadHandlers));
leadHandlerRouter.post('/', ...write(P('STAFF', 'CREATE'), createLeadHandlerSchema, LeadController.createLeadHandler));
leadHandlerRouter.put('/:id', ...write(P('STAFF', 'EDIT'), updateLeadHandlerSchema, LeadController.updateLeadHandler));
leadHandlerRouter.patch('/:id/status', ...write(P('STAFF', 'EDIT'), toggleSchema, LeadController.toggleLeadHandler));

// ----------------------------------------------------------- lead sources
export const leadSourceRouter = express.Router({ mergeParams: true });
leadSourceRouter.get('/', ...read(P('STAFF', 'VIEW'), listActiveSchema, LeadController.getLeadSources));
leadSourceRouter.post('/', ...write(P('STAFF', 'CREATE'), createLeadSourceSchema, LeadController.createLeadSource));
leadSourceRouter.put('/:id', ...write(P('STAFF', 'EDIT'), updateLeadSourceSchema, LeadController.updateLeadSource));
leadSourceRouter.patch('/:id/status', ...write(P('STAFF', 'EDIT'), toggleSchema, LeadController.toggleLeadSource));

// --------------------------------------------------------------- billing
export const billingRouter = express.Router({ mergeParams: true });
billingRouter.get('/ledger', ...read(P('BILLING', 'VIEW'), getCashMemoSchema, BillingController.getCashMemo));
billingRouter.get('/daily-collection', ...read(P('BILLING', 'VIEW'), dailyCollectionSchema, BillingController.getDailyCollection));
billingRouter.get('/pending', ...read(P('BILLING', 'VIEW'), pendingPaymentsSchema, BillingController.getPending));

// ---- Daily cash drawer ----
billingRouter.get('/cash-day', ...read(P('BILLING', 'VIEW'), getCashDaySchema, BillingController.getCashDay));
billingRouter.post('/cash-day/open', ...write(P('BILLING', 'CREATE'), openCashDaySchema, BillingController.openCashDay));
billingRouter.post('/cash-day/close', ...write(P('BILLING', 'CREATE'), closeCashDaySchema, BillingController.closeCashDay));
billingRouter.post('/cash-day/reopen', ...write(P('BILLING', 'EDIT'), reopenCashDaySchema, BillingController.reopenCashDay));

// ---- Money OUT: parts bought from a shop (never customer revenue) ----
billingRouter.post('/expenses', ...write(P('BILLING', 'CREATE'), addShopExpenseSchema, BillingController.addShopExpense));
billingRouter.delete('/expenses/:id', ...write(P('BILLING', 'DELETE'), shopExpenseIdSchema, BillingController.deleteShopExpense));

// ---- Money IN: customer payment, looked up by the receipt number ----
billingRouter.get('/receipt/:receiptNumber', ...read(P('BILLING', 'VIEW'), lookupReceiptSchema, BillingController.lookupReceipt));
billingRouter.post('/payments', ...write(P('BILLING', 'CREATE'), addPaymentByReceiptSchema, BillingController.addPaymentByReceipt));

// ---- Money IN with NO repair receipt: ad-hoc payments and old paper records.
// Same ledger table, same append-only rules — only the `source` differs. A
// mistake is corrected by reversal here too, never by edit or delete.
billingRouter.post('/manual-entries', ...write(P('BILLING', 'CREATE'), addManualLedgerEntrySchema, BillingController.addManualEntry));
billingRouter.post('/manual-entries/:entryId/reverse', ...write(P('BILLING', 'DELETE'), reverseManualEntrySchema, BillingController.reverseManualEntry));

// --------------------------------------------------------------- reports
// Each report gets ONLY the filters that are meaningful for it.
export const reportRouter = express.Router({ mergeParams: true });
reportRouter.get('/repair-summary', ...read(P('REPORTS', 'VIEW'), repairReportSchema, ReportController.repairSummary));
reportRouter.get('/delivery', ...read(P('REPORTS', 'VIEW'), deliveryReportSchema, ReportController.delivery));
reportRouter.get('/engineers', ...read(P('REPORTS', 'VIEW'), engineerReportSchema, ReportController.engineers));
reportRouter.get('/lead-sources', ...read(P('REPORTS', 'VIEW'), leadReportSchema, ReportController.leadSources));
reportRouter.get('/lead-handlers', ...read(P('REPORTS', 'VIEW'), leadReportSchema, ReportController.leadHandlers));
// The two MONEY reports are gated on BILLING, not REPORTS. Revenue collected
// and money spent are financial records, and REPORTS:VIEW is held by roles
// (Marketing) whose job is lead sources and conversion, not the shop's books.
// Same principle as the payment routes under /repairs.
reportRouter.get('/collection', ...read(P('BILLING', 'VIEW'), collectionReportSchema, ReportController.collection));
reportRouter.get('/expenses', ...read(P('BILLING', 'VIEW'), expenseReportSchema, ReportController.expenses));

// -------------------------------------------------------------- suppliers
export const supplierRouter = express.Router({ mergeParams: true });
supplierRouter.get('/', ...read(P('STAFF', 'VIEW'), listActiveSchema, SupplierController.getSuppliers));
supplierRouter.get('/:id', ...read(P('STAFF', 'VIEW'), supplierIdSchema, SupplierController.getSupplierById));
supplierRouter.post('/', ...write(P('STAFF', 'CREATE'), createSupplierSchema, SupplierController.createSupplier));
supplierRouter.put('/:id', ...write(P('STAFF', 'EDIT'), updateSupplierSchema, SupplierController.updateSupplier));
supplierRouter.patch('/:id/status', ...write(P('STAFF', 'EDIT'), toggleSchema, SupplierController.toggleStatus));

// ------------------------------------------------------------- dashboard
export const dashboardRouter = express.Router({ mergeParams: true });
dashboardRouter.get('/summary', ...read(P('DASHBOARD', 'VIEW'), null, ReportController.dashboard));

// -------------------------------------------------------------- settings
export const settingRouter = express.Router({ mergeParams: true });
settingRouter.get('/', ...read(P('SETTINGS', 'VIEW'), null, SettingController.getSettings));
settingRouter.put('/', ...write(P('SETTINGS', 'EDIT'), updateSettingsSchema, SettingController.updateSettings));

// ------------------------------------------------------- whatsapp (web QR)
// Connection status for the WhatsApp Web provider — separate from
// /repairs/:id/whatsapp/* which is about sending a specific receipt.
export const whatsappWebRouter = express.Router({ mergeParams: true });
whatsappWebRouter.get('/status', ...read(P('SETTINGS', 'VIEW'), null, WhatsAppController.getWebStatus));
whatsappWebRouter.post('/reset', ...write(P('SETTINGS', 'EDIT'), null, WhatsAppController.resetWeb));
