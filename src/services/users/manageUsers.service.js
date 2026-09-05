import { Op } from 'sequelize';

import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { hashPassword } from '@src/helpers/authentication.helpers';
import { buildOverrides, resolvePermissions } from '@src/helpers/permission.helpers';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import {
  ACTIVE_ADMIN_ROLES,
  ADMIN_ROLE,
  ALL_PERMISSIONS,
  PERMISSION_ACTION,
  PERMISSION_MODULE,
  PERMISSION_MODULE_LABELS,
  ROLE_PERMISSIONS,
  STAFF_AVAILABILITY,
} from '@src/utils/constants/public.constants';

/**
 * Super Admin user management: onboard staff, set roles, tune individual
 * permissions, deactivate people who leave.
 *
 * Two invariants are enforced here rather than in the UI, because the UI is
 * not a security boundary:
 *
 *   1. Nobody may change their OWN role, permissions or active flag — the
 *      classic way an admin locks themselves out of the only screen that
 *      could undo it.
 *   2. The last active Super Admin cannot be demoted or deactivated, or the
 *      shop would be left with no account able to manage accounts at all.
 */

const PUBLIC_ATTRIBUTES = [
  'id',
  'name',
  'email',
  'mobile',
  'role',
  'availability',
  'permissions',
  'isActive',
  'lastLoginAt',
  'leadHandlerId',
  'createdAt',
];

/** Shapes a user for the API, with their RESOLVED permissions attached. */
const present = (user) => ({
  ...user.get({ plain: true }),
  effectivePermissions: resolvePermissions(user),
});

const assertNotSelf = (adminId, targetId) => {
  if (Number(adminId) === Number(targetId)) throw new AppError(Errors.CANNOT_MODIFY_OWN_ACCOUNT);
};

/**
 * Refuses a change that would leave zero active Super Admins.
 *
 * Called BEFORE the write, and counts everyone except the user being changed
 * — "would anybody else still be able to manage users after this?".
 */
const assertNotLastSuperAdmin = async (user, transaction) => {
  if (user.role !== ADMIN_ROLE.SUPER_ADMIN) return;

  const others = await db.AdminUser.count({
    where: { role: ADMIN_ROLE.SUPER_ADMIN, isActive: true, id: { [Op.ne]: user.id } },
    transaction,
  });

  if (others === 0) throw new AppError(Errors.LAST_SUPER_ADMIN);
};

export class GetUsersService extends BaseHandler {
  async run() {
    const { role, isActive } = this.args;

    const where = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;

    const users = await db.AdminUser.findAll({
      where,
      attributes: PUBLIC_ATTRIBUTES,
      order: [
        ['isActive', 'DESC'],
        ['name', 'ASC'],
      ],
    });

    return { ...getSuccessResponse('Users fetched successfully.'), users: users.map(present) };
  }
}

export class CreateUserService extends BaseHandler {
  async run() {
    const { name, email, password, role, mobile, permissions } = this.args;
    const transaction = this.dbTransaction;

    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await db.AdminUser.findOne({ where: { email: normalizedEmail }, transaction });
    if (existing) throw new AppError(Errors.EMAIL_ALREADY_EXISTS(normalizedEmail));

    const user = await db.AdminUser.create(
      {
        name: String(name).trim(),
        email: normalizedEmail,
        password: await hashPassword(password),
        role,
        mobile: mobile ?? null,
        permissions: buildOverrides(permissions),
        availability: STAFF_AVAILABILITY.AVAILABLE,
        isActive: true,
      },
      { transaction },
    );

    // Re-read through the default scope so the password hash is not returned.
    const created = await db.AdminUser.findByPk(user.id, { attributes: PUBLIC_ATTRIBUTES, transaction });

    return { ...getSuccessResponse(`${created.name} can now sign in.`), user: present(created) };
  }
}

export class UpdateUserService extends BaseHandler {
  async run() {
    const { id, adminId, name, email, mobile, role, availability, permissions, password } = this.args;
    const transaction = this.dbTransaction;

    const user = await db.AdminUser.scope('withPassword').findByPk(id, { transaction });
    if (!user) throw new AppError(Errors.USER_NOT_FOUND);

    const updates = {};

    if (name !== undefined) updates.name = String(name).trim();
    if (mobile !== undefined) updates.mobile = mobile || null;
    if (availability !== undefined) updates.availability = availability;

    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (normalizedEmail !== user.email) {
        const clash = await db.AdminUser.findOne({
          where: { email: normalizedEmail, id: { [Op.ne]: id } },
          transaction,
        });
        if (clash) throw new AppError(Errors.EMAIL_ALREADY_EXISTS(normalizedEmail));
        updates.email = normalizedEmail;
      }
    }

    // Role and permissions are the privilege-bearing fields — both are
    // self-modification hazards, so both are blocked on your own account.
    if (role !== undefined && role !== user.role) {
      assertNotSelf(adminId, id);
      await assertNotLastSuperAdmin(user, transaction);
      updates.role = role;
    }

    if (permissions !== undefined) {
      assertNotSelf(adminId, id);
      updates.permissions = buildOverrides(permissions);
    }

    // A Super Admin setting somebody's password is the intended recovery path
    // for the migrated telecaller accounts, which have no usable one.
    if (password) updates.password = await hashPassword(password);

    await user.update(updates, { transaction });

    const updated = await db.AdminUser.findByPk(id, { attributes: PUBLIC_ATTRIBUTES, transaction });

    return { ...getSuccessResponse('User updated successfully.'), user: present(updated) };
  }
}

export class ToggleUserService extends BaseHandler {
  async run() {
    const { id, isActive, adminId } = this.args;
    const transaction = this.dbTransaction;

    assertNotSelf(adminId, id);

    const user = await db.AdminUser.findByPk(id, { transaction });
    if (!user) throw new AppError(Errors.USER_NOT_FOUND);

    if (!isActive) await assertNotLastSuperAdmin(user, transaction);

    await user.update({ isActive }, { transaction });

    return {
      ...getSuccessResponse(`${user.name} was ${isActive ? 'activated' : 'deactivated'}.`),
      user: present(user),
    };
  }
}

/**
 * The permission catalogue the Super Admin's UI renders its tick-box grid
 * from — served by the API rather than duplicated in the frontend, so adding
 * a module never needs the two to be edited in lockstep.
 */
export class GetPermissionCatalogueService extends BaseHandler {
  async run() {
    return {
      ...getSuccessResponse('Permission catalogue fetched successfully.'),
      modules: Object.values(PERMISSION_MODULE).map((module) => ({
        module,
        label: PERMISSION_MODULE_LABELS[module],
        actions: Object.values(PERMISSION_ACTION),
      })),
      actions: Object.values(PERMISSION_ACTION),
      allPermissions: ALL_PERMISSIONS,
      roles: ACTIVE_ADMIN_ROLES.map((role) => ({
        role,
        defaultPermissions: ROLE_PERMISSIONS[role] ?? [],
      })),
    };
  }
}
