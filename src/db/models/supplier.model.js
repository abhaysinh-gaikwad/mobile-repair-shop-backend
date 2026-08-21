'use strict';

/**
 * Who the shop buys parts/material from. Deliberately minimal — this is a
 * registry, not a procurement system: no purchase orders, no stock levels,
 * just a name to attach to a shop expense so purchases can be traced back to
 * where they came from and what is still owed.
 */
module.exports = function (sequelize, DataTypes) {
  const Supplier = sequelize.define(
    'Supplier',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      mobile: { type: DataTypes.STRING(20), allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    },
    {
      tableName: 'suppliers',
      schema: 'public',
      underscored: true,
      timestamps: true,
      indexes: [{ fields: ['is_active'] }],
    },
  );

  Supplier.associate = function (models) {
    Supplier.hasMany(models.ShopExpense, { foreignKey: 'supplierId', as: 'expenses' });
  };

  return Supplier;
};
