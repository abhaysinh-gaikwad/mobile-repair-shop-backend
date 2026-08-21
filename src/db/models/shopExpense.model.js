'use strict';

const { PAYMENT_METHOD } = require('@src/utils/constants/public.constants');

/**
 * Money going OUT of the drawer — typically a part fetched from a supplier.
 *
 * Deliberately NOT stored in `repair_ledger`. That table is the record of what
 * CUSTOMERS paid; putting an expense in it would reduce reported collections
 * and quietly corrupt every revenue figure and daily-collection total the shop
 * already relies on.
 *
 * `repairJobId` is optional: a part may be bought for one specific repair, or
 * as general stock.
 */
module.exports = function (sequelize, DataTypes) {
  const ShopExpense = sequelize.define(
    'ShopExpense',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      entryNo: { type: DataTypes.STRING(20), allowNull: false, unique: true, field: 'entry_no' },
      amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      description: { type: DataTypes.STRING(255), allowNull: false },
      paymentMethod: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: PAYMENT_METHOD.CASH,
        field: 'payment_method',
      },

      repairJobId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'repair_job_id',
        references: { model: 'repair_jobs', key: 'id' },
      },
      receiptNumber: { type: DataTypes.STRING(20), allowNull: true, field: 'receipt_number' },
      // Free-text fallback for an ad-hoc purchase with no registered supplier.
      // When `supplierId` is set, the supplier's own name is the source of truth.
      vendor: { type: DataTypes.STRING(120), allowNull: true },
      supplierId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'supplier_id',
        references: { model: 'suppliers', key: 'id' },
      },
      // Material / Loss / Other — drives the Reports expense filter.
      category: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'MATERIAL' },
      broughtBy: { type: DataTypes.STRING(120), allowNull: true, field: 'brought_by' },

      spentAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'spent_at' },
      recordedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'recorded_by',
        references: { model: 'admin_users', key: 'id' },
      },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
    },
    {
      tableName: 'shop_expenses',
      schema: 'public',
      underscored: true,
      timestamps: false,
      indexes: [
        { fields: ['spent_at'] },
        { fields: ['repair_job_id'] },
        { fields: ['payment_method'] },
        { fields: ['category'] },
        { fields: ['supplier_id'] },
      ],
    },
  );

  ShopExpense.associate = function (models) {
    ShopExpense.belongsTo(models.RepairJob, { foreignKey: 'repairJobId', as: 'repairJob' });
    ShopExpense.belongsTo(models.AdminUser, { foreignKey: 'recordedBy', as: 'recorder' });
    ShopExpense.belongsTo(models.Supplier, { foreignKey: 'supplierId', as: 'supplier' });
  };

  return ShopExpense;
};
