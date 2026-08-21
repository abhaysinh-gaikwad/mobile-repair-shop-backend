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
  addPartSchema,
  addPaymentSchema,
  jobIdParamsSchema,
  partIdParamsSchema,
  reversePaymentSchema,
  updatePartSchema,
} from '@src/json-schemas/repairs/subResources.schema';
import { getNotificationsSchema, sendReceiptSchema } from '@src/json-schemas/whatsapp/whatsapp.schema';
import RepairController from '@src/rest-resources/controllers/repair.controller';
import RepairSubResourceController from '@src/rest-resources/controllers/repairSubResource.controller';
import WhatsAppController from '@src/rest-resources/controllers/whatsapp.controller';
import contextMiddleware from '@src/rest-resources/middlewares/context.middleware';
import { isAuthenticated } from '@src/rest-resources/middlewares/isAuthenticated';
import { requestValidationMiddleware } from '@src/rest-resources/middlewares/requestValidation.middleware';

const repairRouter = express.Router({ mergeParams: true });

repairRouter.post(
  '/',
  contextMiddleware(true),
  isAuthenticated(),
  requestValidationMiddleware(createRepairSchema),
  RepairController.createRepair,
);

repairRouter.get(
  '/',
  contextMiddleware(false),
  isAuthenticated(),
  requestValidationMiddleware(getRepairsSchema),
  RepairController.getRepairs,
);

// Declared BEFORE '/:id' so the literal path is not swallowed by the param route.
repairRouter.get(
  '/receipt/:receiptNumber',
  contextMiddleware(false),
  isAuthenticated(),
  RepairController.getRepairByReceipt,
);

repairRouter.get(
  '/:id',
  contextMiddleware(false),
  isAuthenticated(),
  requestValidationMiddleware(getRepairByIdSchema),
  RepairController.getRepairById,
);

// Flattened payload for the printed Marathi receipt — one call so the print
// dialog never opens before the data has arrived.
repairRouter.get(
  '/:id/receipt',
  contextMiddleware(false),
  isAuthenticated(),
  requestValidationMiddleware(getRepairByIdSchema),
  RepairController.getReceipt,
);

// Every repair on this same physical phone (IMEI-matched).
repairRouter.get(
  '/:id/device-history',
  contextMiddleware(false),
  isAuthenticated(),
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
  requestValidationMiddleware(getRepairByIdSchema),
  RepairController.revealDeviceUnlock,
);

repairRouter.put(
  '/:id/device-unlock',
  contextMiddleware(true),
  isAuthenticated(),
  requestValidationMiddleware(updateDeviceUnlockSchema),
  RepairController.updateDeviceUnlock,
);

repairRouter.put(
  '/:id',
  contextMiddleware(true),
  isAuthenticated(),
  requestValidationMiddleware(updateRepairSchema),
  RepairController.updateRepair,
);

repairRouter.patch(
  '/:id/status',
  contextMiddleware(true),
  isAuthenticated(),
  requestValidationMiddleware(updateRepairStatusSchema),
  RepairController.updateStatus,
);

repairRouter.patch(
  '/:id/engineer',
  contextMiddleware(true),
  isAuthenticated(),
  requestValidationMiddleware(assignEngineerSchema),
  RepairController.assignEngineer,
);

repairRouter.patch(
  '/:id/diagnosis',
  contextMiddleware(true),
  isAuthenticated(),
  requestValidationMiddleware(updateDiagnosisSchema),
  RepairController.updateDiagnosis,
);

// ------------------------------------------------------------------- parts
repairRouter.post(
  '/:id/parts',
  contextMiddleware(true),
  isAuthenticated(),
  requestValidationMiddleware(addPartSchema),
  RepairSubResourceController.addPart,
);

repairRouter.put(
  '/:id/parts/:partId',
  contextMiddleware(true),
  isAuthenticated(),
  requestValidationMiddleware(updatePartSchema),
  RepairSubResourceController.updatePart,
);

repairRouter.delete(
  '/:id/parts/:partId',
  contextMiddleware(true),
  isAuthenticated(),
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
  requestValidationMiddleware(addPaymentSchema),
  RepairSubResourceController.addPayment,
);

repairRouter.get(
  '/:id/payments',
  contextMiddleware(false),
  isAuthenticated(),
  requestValidationMiddleware(jobIdParamsSchema),
  RepairSubResourceController.getPayments,
);

repairRouter.post(
  '/:id/payments/:entryId/reverse',
  contextMiddleware(true),
  isAuthenticated(),
  requestValidationMiddleware(reversePaymentSchema),
  RepairSubResourceController.reversePayment,
);

// --------------------------------------------------------------- call logs
// Append-only as well: no update, no delete.
repairRouter.post(
  '/:id/call-logs',
  contextMiddleware(true),
  isAuthenticated(),
  requestValidationMiddleware(addCallLogSchema),
  RepairSubResourceController.addCallLog,
);

repairRouter.get(
  '/:id/call-logs',
  contextMiddleware(false),
  isAuthenticated(),
  requestValidationMiddleware(jobIdParamsSchema),
  RepairSubResourceController.getCallLogs,
);

// --------------------------------------------------------------- whatsapp
// Kept as its own controller/service (WhatsApp logic never mixes with repair
// or payment business logic) but nested under the repair, like device-unlock.
repairRouter.post(
  '/:id/whatsapp/send-receipt',
  contextMiddleware(true),
  isAuthenticated(),
  requestValidationMiddleware(sendReceiptSchema),
  WhatsAppController.sendReceipt,
);

repairRouter.get(
  '/:id/whatsapp/notifications',
  contextMiddleware(false),
  isAuthenticated(),
  requestValidationMiddleware(getNotificationsSchema),
  WhatsAppController.getNotifications,
);

export default repairRouter;
