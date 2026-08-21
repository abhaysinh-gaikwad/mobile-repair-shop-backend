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
import { requestValidationMiddleware } from '@src/rest-resources/middlewares/requestValidation.middleware';

const engineerRouter = express.Router({ mergeParams: true });

engineerRouter.get(
  '/',
  contextMiddleware(false),
  isAuthenticated(),
  requestValidationMiddleware(getEngineersSchema),
  EngineerController.getEngineers,
);

engineerRouter.post(
  '/',
  contextMiddleware(true),
  isAuthenticated(),
  requestValidationMiddleware(createEngineerSchema),
  EngineerController.createEngineer,
);

engineerRouter.put(
  '/:id',
  contextMiddleware(true),
  isAuthenticated(),
  requestValidationMiddleware(updateEngineerSchema),
  EngineerController.updateEngineer,
);

engineerRouter.patch(
  '/:id/status',
  contextMiddleware(true),
  isAuthenticated(),
  requestValidationMiddleware(toggleEngineerSchema),
  EngineerController.toggleStatus,
);

export default engineerRouter;
