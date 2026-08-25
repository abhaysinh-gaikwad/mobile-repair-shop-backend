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
  addPaymentByReceiptSchema,
  addShopExpenseSchema,
  closeCashDaySchema,
  getCashDaySchema,
  lookupReceiptSchema,
  openCashDaySchema,
  reopenCashDaySchema,
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
import { requestValidationMiddleware } from '@src/rest-resources/middlewares/requestValidation.middleware';

const read = (schema, handler) => [
  contextMiddleware(false),
  isAuthenticated(),
  ...(schema ? [requestValidationMiddleware(schema)] : []),
  handler,
];
const write = (schema, handler) => [
  contextMiddleware(true),
  isAuthenticated(),
  ...(schema ? [requestValidationMiddleware(schema)] : []),
  handler,
];

// ------------------------------------------------------------- customers
export const customerRouter = express.Router({ mergeParams: true });
customerRouter.get('/', ...read(getCustomersSchema, CustomerController.getCustomers));
customerRouter.get('/:id', ...read(customerIdSchema, CustomerController.getCustomerById));
customerRouter.put('/:id', ...write(updateCustomerSchema, CustomerController.updateCustomer));

// ---------------------------------------------------------- lead handlers
export const leadHandlerRouter = express.Router({ mergeParams: true });
leadHandlerRouter.get('/', ...read(listActiveSchema, LeadController.getLeadHandlers));
leadHandlerRouter.post('/', ...write(createLeadHandlerSchema, LeadController.createLeadHandler));
leadHandlerRouter.put('/:id', ...write(updateLeadHandlerSchema, LeadController.updateLeadHandler));
leadHandlerRouter.patch('/:id/status', ...write(toggleSchema, LeadController.toggleLeadHandler));

// ----------------------------------------------------------- lead sources
export const leadSourceRouter = express.Router({ mergeParams: true });
leadSourceRouter.get('/', ...read(listActiveSchema, LeadController.getLeadSources));
leadSourceRouter.post('/', ...write(createLeadSourceSchema, LeadController.createLeadSource));
leadSourceRouter.put('/:id', ...write(updateLeadSourceSchema, LeadController.updateLeadSource));
leadSourceRouter.patch('/:id/status', ...write(toggleSchema, LeadController.toggleLeadSource));

// --------------------------------------------------------------- billing
export const billingRouter = express.Router({ mergeParams: true });
billingRouter.get('/ledger', ...read(getCashMemoSchema, BillingController.getCashMemo));
billingRouter.get('/daily-collection', ...read(dailyCollectionSchema, BillingController.getDailyCollection));
billingRouter.get('/pending', ...read(pendingPaymentsSchema, BillingController.getPending));

// ---- Daily cash drawer ----
billingRouter.get('/cash-day', ...read(getCashDaySchema, BillingController.getCashDay));
billingRouter.post('/cash-day/open', ...write(openCashDaySchema, BillingController.openCashDay));
billingRouter.post('/cash-day/close', ...write(closeCashDaySchema, BillingController.closeCashDay));
billingRouter.post('/cash-day/reopen', ...write(reopenCashDaySchema, BillingController.reopenCashDay));

// ---- Money OUT: parts bought from a shop (never customer revenue) ----
billingRouter.post('/expenses', ...write(addShopExpenseSchema, BillingController.addShopExpense));
billingRouter.delete('/expenses/:id', ...write(shopExpenseIdSchema, BillingController.deleteShopExpense));

// ---- Money IN: customer payment, looked up by the receipt number ----
billingRouter.get('/receipt/:receiptNumber', ...read(lookupReceiptSchema, BillingController.lookupReceipt));
billingRouter.post('/payments', ...write(addPaymentByReceiptSchema, BillingController.addPaymentByReceipt));

// --------------------------------------------------------------- reports
// Each report gets ONLY the filters that are meaningful for it.
export const reportRouter = express.Router({ mergeParams: true });
reportRouter.get('/repair-summary', ...read(repairReportSchema, ReportController.repairSummary));
reportRouter.get('/delivery', ...read(deliveryReportSchema, ReportController.delivery));
reportRouter.get('/engineers', ...read(engineerReportSchema, ReportController.engineers));
reportRouter.get('/lead-sources', ...read(leadReportSchema, ReportController.leadSources));
reportRouter.get('/lead-handlers', ...read(leadReportSchema, ReportController.leadHandlers));
reportRouter.get('/collection', ...read(collectionReportSchema, ReportController.collection));
reportRouter.get('/expenses', ...read(expenseReportSchema, ReportController.expenses));

// -------------------------------------------------------------- suppliers
export const supplierRouter = express.Router({ mergeParams: true });
supplierRouter.get('/', ...read(listActiveSchema, SupplierController.getSuppliers));
supplierRouter.get('/:id', ...read(supplierIdSchema, SupplierController.getSupplierById));
supplierRouter.post('/', ...write(createSupplierSchema, SupplierController.createSupplier));
supplierRouter.put('/:id', ...write(updateSupplierSchema, SupplierController.updateSupplier));
supplierRouter.patch('/:id/status', ...write(toggleSchema, SupplierController.toggleStatus));

// ------------------------------------------------------------- dashboard
export const dashboardRouter = express.Router({ mergeParams: true });
dashboardRouter.get('/summary', ...read(null, ReportController.dashboard));

// -------------------------------------------------------------- settings
export const settingRouter = express.Router({ mergeParams: true });
settingRouter.get('/', ...read(null, SettingController.getSettings));
settingRouter.put('/', ...write(updateSettingsSchema, SettingController.updateSettings));

// ------------------------------------------------------- whatsapp (web QR)
// Connection status for the WhatsApp Web provider — separate from
// /repairs/:id/whatsapp/* which is about sending a specific receipt.
export const whatsappWebRouter = express.Router({ mergeParams: true });
whatsappWebRouter.get('/status', ...read(null, WhatsAppController.getWebStatus));
