'use strict';

/**
 * Simple key/value shop configuration — name, address, phone numbers,
 * receipt prefix, the Marathi receipt terms, paper size.
 */
module.exports = function (sequelize, DataTypes) {
  const ShopSetting = sequelize.define(
    'ShopSetting',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      key: { type: DataTypes.STRING(150), allowNull: false, unique: true },
      value: { type: DataTypes.TEXT, allowNull: true },
      description: { type: DataTypes.STRING(255), allowNull: true },
      updatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'updated_by',
        references: { model: 'admin_users', key: 'id' },
      },
    },
    {
      tableName: 'shop_settings',
      schema: 'public',
      underscored: true,
      timestamps: true,
    },
  );

  ShopSetting.associate = function (models) {
    ShopSetting.belongsTo(models.AdminUser, { foreignKey: 'updatedBy', as: 'updater' });
  };

  return ShopSetting;
};
