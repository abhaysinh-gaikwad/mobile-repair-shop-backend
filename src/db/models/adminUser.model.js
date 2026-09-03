'use strict';

module.exports = function (sequelize, DataTypes) {
  const AdminUser = sequelize.define(
    'AdminUser',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      email: { type: DataTypes.STRING(160), allowNull: false, unique: true },
      password: { type: DataTypes.STRING(255), allowNull: false },
      // See public.constants.js ADMIN_ROLE — OWNER (default, full access) vs
      // STAFF (telecaller; restricted only where explicitly checked, e.g.
      // Rate Card management).
      role: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'OWNER' },
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

  return AdminUser;
};
