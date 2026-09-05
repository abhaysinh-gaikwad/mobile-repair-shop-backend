import express from 'express';

import {
  createEngineerSchema,
  getEngineersSchema,
  toggleEngineerSchema,
  updateEngineerSchema,
} from '@src/json-schemas/engineers/engineer.schema';
import EngineerController from '@src/rest-resources/controllers/engineer.controller';
import contextMiddleware from '@src/rest-resources/middlewares/context.middleware';
import { isAuthenticated } from '@src/rest-resources/middlewares/isAuthenticated';
import { requirePermission } from '@src/rest-resources/middlewares/requirePermission';
import { requestValidationMiddleware } from '@src/rest-resources/middlewares/requestValidation.middleware';
import { PERMISSION_ACTION, PERMISSION_MODULE, permission } from '@src/utils/constants/public.constants';

/**
 * The engineer ROSTER (technician records), under STAFF — not to be confused
 * with an Engineer USER ACCOUNT, which is a login with the ENGINEER role.
 * Listing technicians stays on VIEW because the repair screens need it to
 * populate the "assign engineer" dropdown.
 */
const P = (action) => permission(PERMISSION_MODULE.STAFF, PERMISSION_ACTION[action]);

const engineerRouter = express.Router({ mergeParams: true });

engineerRouter.get(
  '/',
  contextMiddleware(false),
  isAuthenticated(),
  requirePermission(P('VIEW')),
  requestValidationMiddleware(getEngineersSchema),
  EngineerController.getEngineers,
);

engineerRouter.post(
  '/',
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(P('CREATE')),
  requestValidationMiddleware(createEngineerSchema),
  EngineerController.createEngineer,
);

engineerRouter.put(
  '/:id',
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(P('EDIT')),
  requestValidationMiddleware(updateEngineerSchema),
  EngineerController.updateEngineer,
);

engineerRouter.patch(
  '/:id/status',
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(P('EDIT')),
  requestValidationMiddleware(toggleEngineerSchema),
  EngineerController.toggleStatus,
);

export default engineerRouter;
