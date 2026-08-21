import express from 'express';

import changePasswordSchema from '@src/json-schemas/auth/changePassword.schema';
import loginSchema from '@src/json-schemas/auth/login.schema';
import AuthController from '@src/rest-resources/controllers/auth.controller';
import contextMiddleware from '@src/rest-resources/middlewares/context.middleware';
import { isAuthenticated } from '@src/rest-resources/middlewares/isAuthenticated';
import { requestValidationMiddleware } from '@src/rest-resources/middlewares/requestValidation.middleware';

const authRouter = express.Router({ mergeParams: true });

authRouter.post(
  '/login',
  contextMiddleware(true),
  requestValidationMiddleware(loginSchema),
  AuthController.login,
);

authRouter.get('/me', contextMiddleware(false), isAuthenticated(), AuthController.me);

authRouter.post(
  '/change-password',
  contextMiddleware(true),
  isAuthenticated(),
  requestValidationMiddleware(changePasswordSchema),
  AuthController.changePassword,
);

export default authRouter;
