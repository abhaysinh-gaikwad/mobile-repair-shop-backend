'use strict';

const { CASH_DAY_STATUS } = require('@src/utils/constants/public.constants');

/**
 * One row per shop day.
 *
 * The admin counts the drawer each morning and records the opening balance;
 * at the end of the day they close it, which freezes a snapshot of the
 * collections, expenses and closing balance. The snapshot matters: without it,
 * a back-dated entry could silently change a figure the owner already signed
 * off on.
 */
module.exports = function (sequelize, DataTypes) {
  const CashDay = sequelize.define(
    'CashDay',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      businessDate: { type: DataTypes.DATEONLY, allowNull: false, unique: true, field: 'business_date' },
      openingBalance: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0, field: 'opening_balance' },
      status: { type: DataTypes.STRING(10), allowNull: false, defaultValue: CASH_DAY_STATUS.OPEN },

      closingBalance: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'closing_balance' },
      closingCollections: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'closing_collections' },
      closingExpenses: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'closing_expenses' },
      closedAt: { type: DataTypes.DATE, allowNull: true, field: 'closed_at' },
      closedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'closed_by',
        references: { model: 'admin_users', key: 'id' },
      },

      notes: { type: DataTypes.TEXT, allowNull: true },
      openedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'opened_by',
        references: { model: 'admin_users', key: 'id' },
      },
    },
    {
      tableName: 'cash_days',
      schema: 'public',
      underscored: true,
      timestamps: true,
    },
  );

  CashDay.associate = function (models) {
    CashDay.belongsTo(models.AdminUser, { foreignKey: 'openedBy', as: 'opener' });
    CashDay.belongsTo(models.AdminUser, { foreignKey: 'closedBy', as: 'closer' });
  };

  return CashDay;
};
