import express from 'express';

import {
  createNewCrmLeadSchema,
  getNewCrmLeadsSchema,
  updateNewCrmLeadFollowUpSchema,
  updateNewCrmLeadSchema,
  updateNewCrmLeadStatusSchema,
} from '@src/json-schemas/newCrm/newCrmLead.schema';
import NewCrmController from '@src/rest-resources/controllers/newCrm.controller';
import contextMiddleware from '@src/rest-resources/middlewares/context.middleware';
import { isAuthenticated } from '@src/rest-resources/middlewares/isAuthenticated';
import { requirePermission } from '@src/rest-resources/middlewares/requirePermission';
import { requestValidationMiddleware } from '@src/rest-resources/middlewares/requestValidation.middleware';
import { PERMISSION_ACTION, PERMISSION_MODULE, permission } from '@src/utils/constants/public.constants';

const NEW_CRM = PERMISSION_MODULE.NEW_CRM;

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

const newCrmRouter = express.Router({ mergeParams: true });

newCrmRouter.get(
  '/leads',
  ...read(permission(NEW_CRM, PERMISSION_ACTION.VIEW), getNewCrmLeadsSchema, NewCrmController.getLeads),
);

newCrmRouter.post(
  '/leads',
  ...write(permission(NEW_CRM, PERMISSION_ACTION.CREATE), createNewCrmLeadSchema, NewCrmController.createLead),
);

newCrmRouter.put(
  '/leads/:id',
  ...write(permission(NEW_CRM, PERMISSION_ACTION.EDIT), updateNewCrmLeadSchema, NewCrmController.updateLead),
);

newCrmRouter.patch(
  '/leads/:id/status',
  ...write(permission(NEW_CRM, PERMISSION_ACTION.EDIT), updateNewCrmLeadStatusSchema, NewCrmController.updateStatus),
);

newCrmRouter.patch(
  '/leads/:id/follow-up',
  ...write(
    permission(NEW_CRM, PERMISSION_ACTION.EDIT),
    updateNewCrmLeadFollowUpSchema,
    NewCrmController.updateFollowUp,
  ),
);

export default newCrmRouter;
