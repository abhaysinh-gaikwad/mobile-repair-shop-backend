import {
  ACTIVE_ADMIN_ROLES,
  ACTIVE_STAFF_AVAILABILITY,
  ALL_PERMISSIONS,
} from '@src/utils/constants/public.constants';

const idParams = {
  type: 'object',
  properties: { id: { type: 'integer', minimum: 1 } },
  required: ['id'],
};

/**
 * Per-user overrides. Constrained to the known permission strings so a typo
 * is rejected at the edge rather than silently stored and then ignored by
 * resolvePermissions() — a permission that looks granted but does nothing is
 * far worse than an error message.
 */
const permissionOverrides = {
  type: 'object',
  properties: {
    grant: { type: 'array', items: { type: 'string', enum: ALL_PERMISSIONS } },
    revoke: { type: 'array', items: { type: 'string', enum: ALL_PERMISSIONS } },
  },
  additionalProperties: false,
};

export const getUsersSchema = {
  query: {
    type: 'object',
    properties: {
      role: { type: 'string', enum: ACTIVE_ADMIN_ROLES },
      isActive: { type: 'boolean' },
    },
    additionalProperties: false,
  },
};

export const createUserSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 120 },
      email: { type: 'string', format: 'email', maxLength: 160 },
      password: { type: 'string', minLength: 8, maxLength: 100 },
      role: { type: 'string', enum: ACTIVE_ADMIN_ROLES },
      mobile: { type: 'string', maxLength: 20 },
      permissions: permissionOverrides,
    },
    required: ['name', 'email', 'password', 'role'],
    additionalProperties: false,
  },
};

export const updateUserSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 120 },
      email: { type: 'string', format: 'email', maxLength: 160 },
      mobile: { type: 'string', maxLength: 20 },
      role: { type: 'string', enum: ACTIVE_ADMIN_ROLES },
      availability: { type: 'string', enum: ACTIVE_STAFF_AVAILABILITY },
      permissions: permissionOverrides,
      password: { type: 'string', minLength: 8, maxLength: 100 },
    },
    additionalProperties: false,
  },
};

export const toggleUserSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: { isActive: { type: 'boolean' } },
    required: ['isActive'],
    additionalProperties: false,
  },
};
