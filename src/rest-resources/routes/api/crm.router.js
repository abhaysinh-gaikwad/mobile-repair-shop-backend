import express from 'express';

import {
  createLeadSchema,
  getLeadsSchema,
  leadIdSchema,
  reassignLeadSchema,
  updateLeadSchema,
} from '@src/json-schemas/crm/lead.schema';
import CrmController from '@src/rest-resources/controllers/crm.controller';
import contextMiddleware from '@src/rest-resources/middlewares/context.middleware';
import { isAuthenticated } from '@src/rest-resources/middlewares/isAuthenticated';
import { requirePermission } from '@src/rest-resources/middlewares/requirePermission';
import { requestValidationMiddleware } from '@src/rest-resources/middlewares/requestValidation.middleware';
import { PERMISSION_ACTION, PERMISSION_MODULE, permission } from '@src/utils/constants/public.constants';

const CRM = PERMISSION_MODULE.CRM;

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

const crmRouter = express.Router({ mergeParams: true });

crmRouter.get(
  '/leads',
  ...read(permission(CRM, PERMISSION_ACTION.VIEW), getLeadsSchema, CrmController.getLeads),
);

/**
 * The distribution dashboard shows every telecaller's numbers, so it needs
 * the wider CRM permission (DELETE = "manages the whole board"), not the
 * VIEW a telecaller has for their own leads.
 */
crmRouter.get(
  '/distribution',
  ...read(permission(CRM, PERMISSION_ACTION.DELETE), null, CrmController.getDistribution),
);

crmRouter.get(
  '/leads/:id',
  ...read(permission(CRM, PERMISSION_ACTION.VIEW), leadIdSchema, CrmController.getLead),
);

crmRouter.post(
  '/leads',
  ...write(permission(CRM, PERMISSION_ACTION.CREATE), createLeadSchema, CrmController.createLead),
);

crmRouter.put(
  '/leads/:id',
  ...write(permission(CRM, PERMISSION_ACTION.EDIT), updateLeadSchema, CrmController.updateLead),
);

// Manual reassignment is a supervisor action, gated on the same "manages the
// whole board" permission as the dashboard — a telecaller must not be able to
// hand their own leads to somebody else.
crmRouter.patch(
  '/leads/:id/assignee',
  ...write(permission(CRM, PERMISSION_ACTION.DELETE), reassignLeadSchema, CrmController.reassignLead),
);

export default crmRouter;
