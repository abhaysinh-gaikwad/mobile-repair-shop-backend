import express from 'express';

import createRepairSchema from '@src/json-schemas/repairs/createRepair.schema';
import getRepairsSchema from '@src/json-schemas/repairs/getRepairs.schema';
import {
  assignEngineerSchema,
  getRepairByIdSchema,
  updateDeviceUnlockSchema,
  updateDiagnosisSchema,
  updateRepairSchema,
  updateRepairStatusSchema,
} from '@src/json-schemas/repairs/updateRepair.schema';
import {
  addCallLogSchema,
  addEstimateSchema,
  addPartSchema,
  addPaymentSchema,
  estimateIdParamsSchema,
  jobIdParamsSchema,
  partIdParamsSchema,
  reversePaymentSchema,
  updateEstimateSchema,
  updatePartSchema,
} from '@src/json-schemas/repairs/subResources.schema';
import { getNotificationsSchema, sendReceiptSchema } from '@src/json-schemas/whatsapp/whatsapp.schema';
import RepairController from '@src/rest-resources/controllers/repair.controller';
import RepairSubResourceController from '@src/rest-resources/controllers/repairSubResource.controller';
import WhatsAppController from '@src/rest-resources/controllers/whatsapp.controller';
import contextMiddleware from '@src/rest-resources/middlewares/context.middleware';
import { isAuthenticated } from '@src/rest-resources/middlewares/isAuthenticated';
import { requirePermission } from '@src/rest-resources/middlewares/requirePermission';
import { requestValidationMiddleware } from '@src/rest-resources/middlewares/requestValidation.middleware';
import { PERMISSION_ACTION, PERMISSION_MODULE, permission } from '@src/utils/constants/public.constants';

/**
 * Permissions, route by route.
 *
 * REPAIRS:EDIT is what an Engineer holds, and it is deliberately enough to
 * update a job's status, diagnosis and parts — the actual repair work — while
 * REPAIRS:CREATE (booking a job at the counter) and REPAIRS:DELETE are not
 * granted to them.
 *
 * Money is the important exception: taking and reversing payments is gated on
 * BILLING, not REPAIRS, even though the routes live under /repairs. Otherwise
 * "an engineer may update the repair" would silently also mean "an engineer
 * may collect cash", which is not the same authority at all.
 */
const REPAIRS_VIEW = permission(PERMISSION_MODULE.REPAIRS, PERMISSION_ACTION.VIEW);
const REPAIRS_CREATE = permission(PERMISSION_MODULE.REPAIRS, PERMISSION_ACTION.CREATE);
const REPAIRS_EDIT = permission(PERMISSION_MODULE.REPAIRS, PERMISSION_ACTION.EDIT);
const REPAIRS_DELETE = permission(PERMISSION_MODULE.REPAIRS, PERMISSION_ACTION.DELETE);
const BILLING_VIEW = permission(PERMISSION_MODULE.BILLING, PERMISSION_ACTION.VIEW);
const BILLING_CREATE = permission(PERMISSION_MODULE.BILLING, PERMISSION_ACTION.CREATE);
const BILLING_DELETE = permission(PERMISSION_MODULE.BILLING, PERMISSION_ACTION.DELETE);

const repairRouter = express.Router({ mergeParams: true });

repairRouter.post(
  '/',
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(REPAIRS_CREATE),
  requestValidationMiddleware(createRepairSchema),
  RepairController.createRepair,
);

repairRouter.get(
  '/',
  contextMiddleware(false),
  isAuthenticated(),
  requirePermission(REPAIRS_VIEW),
  requestValidationMiddleware(getRepairsSchema),
  RepairController.getRepairs,
);

// Declared BEFORE '/:id' so the literal path is not swallowed by the param route.
repairRouter.get(
  '/receipt/:receiptNumber',
  contextMiddleware(false),
  isAuthenticated(),
  requirePermission(REPAIRS_VIEW),
  RepairController.getRepairByReceipt,
);

repairRouter.get(
  '/:id',
  contextMiddleware(false),
  isAuthenticated(),
  requirePermission(REPAIRS_VIEW),
  requestValidationMiddleware(getRepairByIdSchema),
  RepairController.getRepairById,
);

// Flattened payload for the printed Marathi receipt — one call so the print
// dialog never opens before the data has arrived.
repairRouter.get(
  '/:id/receipt',
  contextMiddleware(false),
  isAuthenticated(),
  requirePermission(REPAIRS_VIEW),
  requestValidationMiddleware(getRepairByIdSchema),
  RepairController.getReceipt,
);

// Every repair on this same physical phone (IMEI-matched).
repairRouter.get(
  '/:id/device-history',
  contextMiddleware(false),
  isAuthenticated(),
  requirePermission(REPAIRS_VIEW),
  requestValidationMiddleware(getRepairByIdSchema),
  RepairController.getDeviceHistory,
);

// --------------------------------------------- device screen-lock credential
// POST (not GET) for the reveal: it is an audited action with a side effect,
// and it keeps the credential out of URLs, browser history and access logs.
repairRouter.post(
  '/:id/device-unlock/reveal',
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(REPAIRS_EDIT),
  requestValidationMiddleware(getRepairByIdSchema),
  RepairController.revealDeviceUnlock,
);

repairRouter.put(
  '/:id/device-unlock',
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(REPAIRS_EDIT),
  requestValidationMiddleware(updateDeviceUnlockSchema),
  RepairController.updateDeviceUnlock,
);

repairRouter.put(
  '/:id',
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(REPAIRS_EDIT),
  requestValidationMiddleware(updateRepairSchema),
  RepairController.updateRepair,
);

repairRouter.patch(
  '/:id/status',
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(REPAIRS_EDIT),
  requestValidationMiddleware(updateRepairStatusSchema),
  RepairController.updateStatus,
);

repairRouter.patch(
  '/:id/engineer',
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(REPAIRS_EDIT),
  requestValidationMiddleware(assignEngineerSchema),
  RepairController.assignEngineer,
);

repairRouter.patch(
  '/:id/diagnosis',
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(REPAIRS_EDIT),
  requestValidationMiddleware(updateDiagnosisSchema),
  RepairController.updateDiagnosis,
);

// ------------------------------------------------------------------- parts
repairRouter.post(
  '/:id/parts',
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(REPAIRS_EDIT),
  requestValidationMiddleware(addPartSchema),
  RepairSubResourceController.addPart,
);

repairRouter.put(
  '/:id/parts/:partId',
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(REPAIRS_EDIT),
  requestValidationMiddleware(updatePartSchema),
  RepairSubResourceController.updatePart,
);

repairRouter.delete(
  '/:id/parts/:partId',
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(REPAIRS_DELETE),
  requestValidationMiddleware(partIdParamsSchema),
  RepairSubResourceController.deletePart,
);

// ---------------------------------------------------------------- payments
// NOTE: there is deliberately NO PUT and NO DELETE for payments. The ledger is
// append-only; a mistake is corrected via POST /:id/payments/:entryId/reverse,
// which keeps both the original and the correction visible.
repairRouter.post(
  '/:id/payments',
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(BILLING_CREATE),
  requestValidationMiddleware(addPaymentSchema),
  RepairSubResourceController.addPayment,
);

repairRouter.get(
  '/:id/payments',
  contextMiddleware(false),
  isAuthenticated(),
  requirePermission(BILLING_VIEW),
  requestValidationMiddleware(jobIdParamsSchema),
  RepairSubResourceController.getPayments,
);

repairRouter.post(
  '/:id/payments/:entryId/reverse',
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(BILLING_DELETE),
  requestValidationMiddleware(reversePaymentSchema),
  RepairSubResourceController.reversePayment,
);

// --------------------------------------------------------------- call logs
// Append-only as well: no update, no delete.
repairRouter.post(
  '/:id/call-logs',
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(REPAIRS_EDIT),
  requestValidationMiddleware(addCallLogSchema),
  RepairSubResourceController.addCallLog,
);

repairRouter.get(
  '/:id/call-logs',
  contextMiddleware(false),
  isAuthenticated(),
  requirePermission(REPAIRS_VIEW),
  requestValidationMiddleware(jobIdParamsSchema),
  RepairSubResourceController.getCallLogs,
);

// --------------------------------------------------------------- estimates
// Editable/deletable at the shop's request — see manageEstimates.service.js
// for the trade-off this accepts (a past quote can change with no record
// that it differed). Unlike payments/call logs, which stay append-only.
repairRouter.post(
  '/:id/estimates',
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(REPAIRS_EDIT),
  requestValidationMiddleware(addEstimateSchema),
  RepairSubResourceController.addEstimate,
);

repairRouter.get(
  '/:id/estimates',
  contextMiddleware(false),
  isAuthenticated(),
  requirePermission(REPAIRS_VIEW),
  requestValidationMiddleware(jobIdParamsSchema),
  RepairSubResourceController.getEstimates,
);

repairRouter.put(
  '/:id/estimates/:estimateId',
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(REPAIRS_EDIT),
  requestValidationMiddleware(updateEstimateSchema),
  RepairSubResourceController.updateEstimate,
);

repairRouter.delete(
  '/:id/estimates/:estimateId',
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(REPAIRS_DELETE),
  requestValidationMiddleware(estimateIdParamsSchema),
  RepairSubResourceController.deleteEstimate,
);

// --------------------------------------------------------------- whatsapp
// Kept as its own controller/service (WhatsApp logic never mixes with repair
// or payment business logic) but nested under the repair, like device-unlock.
repairRouter.post(
  '/:id/whatsapp/send-receipt',
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(REPAIRS_EDIT),
  requestValidationMiddleware(sendReceiptSchema),
  WhatsAppController.sendReceipt,
);

repairRouter.get(
  '/:id/whatsapp/notifications',
  contextMiddleware(false),
  isAuthenticated(),
  requirePermission(REPAIRS_VIEW),
  requestValidationMiddleware(getNotificationsSchema),
  WhatsAppController.getNotifications,
);

export default repairRouter;
