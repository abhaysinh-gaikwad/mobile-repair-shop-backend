import express from 'express';

import {
  createUserSchema,
  getUsersSchema,
  toggleUserSchema,
  updateUserSchema,
} from '@src/json-schemas/users/user.schema';
import UserController from '@src/rest-resources/controllers/user.controller';
import contextMiddleware from '@src/rest-resources/middlewares/context.middleware';
import { isAuthenticated } from '@src/rest-resources/middlewares/isAuthenticated';
import { requirePermission } from '@src/rest-resources/middlewares/requirePermission';
import { requestValidationMiddleware } from '@src/rest-resources/middlewares/requestValidation.middleware';
import { PERMISSION_ACTION, PERMISSION_MODULE, permission } from '@src/utils/constants/public.constants';

const USERS = PERMISSION_MODULE.USERS;

const route = (transactional, perm, schema, handler) => [
  contextMiddleware(transactional),
  isAuthenticated(),
  requirePermission(perm),
  ...(schema ? [requestValidationMiddleware(schema)] : []),
  handler,
];

const userRouter = express.Router({ mergeParams: true });

userRouter.get('/', ...route(false, permission(USERS, PERMISSION_ACTION.VIEW), getUsersSchema, UserController.getUsers));

// The tick-box catalogue is only useful to somebody who can actually change
// permissions, so it rides on EDIT rather than VIEW.
userRouter.get(
  '/permission-catalogue',
  ...route(false, permission(USERS, PERMISSION_ACTION.EDIT), null, UserController.getPermissionCatalogue),
);

userRouter.post(
  '/',
  ...route(true, permission(USERS, PERMISSION_ACTION.CREATE), createUserSchema, UserController.createUser),
);

userRouter.put(
  '/:id',
  ...route(true, permission(USERS, PERMISSION_ACTION.EDIT), updateUserSchema, UserController.updateUser),
);

userRouter.patch(
  '/:id/status',
  ...route(true, permission(USERS, PERMISSION_ACTION.EDIT), toggleUserSchema, UserController.toggleUser),
);

export default userRouter;
