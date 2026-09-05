'use strict';

module.exports = function (sequelize, DataTypes) {
  const AdminUser = sequelize.define(
    'AdminUser',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      email: { type: DataTypes.STRING(160), allowNull: false, unique: true },
      password: { type: DataTypes.STRING(255), allowNull: false },
      // See public.constants.js ADMIN_ROLE. TELECALLER is the default because
      // it is the least-privileged useful role — a new account should never
      // arrive holding more access than someone deliberately gave it.
      role: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'TELECALLER' },
      mobile: { type: DataTypes.STRING(20), allowNull: true },
      /**
       * Per-user permission overrides as { grant: [...], revoke: [...] }.
       * A DELTA against the role's defaults, not a resolved list — see
       * permission.helpers.js resolvePermissions() for why.
       */
      permissions: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: { grant: [], revoke: [] },
      },
      /** Round Robin eligibility. Distinct from isActive, which is about login. */
      availability: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'AVAILABLE' },
      /** Which legacy lead_handlers row this account was migrated from, if any. */
      leadHandlerId: { type: DataTypes.INTEGER, allowNull: true, field: 'lead_handler_id' },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
      lastLoginAt: { type: DataTypes.DATE, allowNull: true, field: 'last_login_at' },
    },
    {
      tableName: 'admin_users',
      schema: 'public',
      underscored: true,
      timestamps: true,
      defaultScope: {
        // The password hash must never leave the database by accident.
        attributes: { exclude: ['password'] },
      },
      scopes: {
        // Explicitly opt in when you actually need to compare a password.
        withPassword: { attributes: { include: ['password'] } },
      },
    },
  );

  AdminUser.associate = function (models) {
    AdminUser.hasMany(models.Lead, { foreignKey: 'assignedTo', as: 'assignedLeads' });
    AdminUser.belongsTo(models.LeadHandler, { foreignKey: 'leadHandlerId', as: 'legacyLeadHandler' });
  };

  return AdminUser;
};
