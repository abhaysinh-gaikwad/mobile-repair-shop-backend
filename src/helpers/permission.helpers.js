import {
  ADMIN_ROLE,
  ALL_PERMISSIONS,
  PERMISSION_ACTION,
  PERMISSION_MODULE,
  ROLE_PERMISSIONS,
  permission,
} from '@src/utils/constants/public.constants';

/**
 * Turns "what role are you" + "what did the Super Admin change for you
 * personally" into the flat list of permissions a request is actually
 * allowed to use.
 *
 *   effective = role defaults  ∪ grant  \  revoke
 *
 * Two layers, not one, because both questions are real: roles keep the common
 * case to a single dropdown, while overrides answer "this ONE telecaller may
 * also edit the Rate Card" without inventing a whole new role for one person.
 *
 * Overrides are stored on `admin_users.permissions` as
 * `{ grant: [...], revoke: [...] }`. Storing the delta rather than a resolved
 * list is deliberate: when a role's defaults change later, everybody who never
 * had a personal exception simply follows the new defaults.
 */

/** Every permission string that is actually recognised — anything else is dropped. */
const KNOWN_PERMISSIONS = new Set(ALL_PERMISSIONS);

const sanitize = (values) =>
  (Array.isArray(values) ? values : []).filter((value) => KNOWN_PERMISSIONS.has(value));

/**
 * SUPER_ADMIN always holds everything, and `revoke` is ignored for them.
 *
 * This is a safety property, not a shortcut: without it, a Super Admin could
 * revoke USERS:EDIT from themselves and leave the shop with no account able
 * to manage accounts — an unrecoverable state on a system whose whole point
 * is that the owner stays in control.
 */
export const resolvePermissions = (adminUser) => {
  if (!adminUser) return [];
  if (adminUser.role === ADMIN_ROLE.SUPER_ADMIN) return [...ALL_PERMISSIONS];

  const base = ROLE_PERMISSIONS[adminUser.role] ?? [];
  const overrides = adminUser.permissions ?? {};

  const granted = new Set([...base, ...sanitize(overrides.grant)]);
  for (const revoked of sanitize(overrides.revoke)) granted.delete(revoked);

  return [...granted];
};

export const hasPermission = (adminUser, required) => resolvePermissions(adminUser).includes(required);

/** Normalises whatever the Super Admin submitted into a storable override delta. */
export const buildOverrides = ({ grant, revoke } = {}) => ({
  grant: [...new Set(sanitize(grant))],
  revoke: [...new Set(sanitize(revoke))],
});

export { PERMISSION_ACTION, PERMISSION_MODULE, permission };
