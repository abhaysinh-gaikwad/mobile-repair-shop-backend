'use strict';

/**
 * "Display", "Battery", "Charging Port" — GLOBAL, not per-brand/model. A
 * "Display" means the same thing regardless of which phone it's for, so
 * this list is shared across every brand and model rather than duplicated
 * per device.
 */
module.exports = function (sequelize, DataTypes) {
  const RateCardPart = sequelize.define(
    'RateCardPart',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
      createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    },
    {
      tableName: 'rate_card_parts',
      schema: 'public',
      underscored: true,
      timestamps: true,
      indexes: [{ fields: ['is_active'] }],
    },
  );

  RateCardPart.associate = function (models) {
    RateCardPart.hasMany(models.RateCardEntry, { foreignKey: 'partId', as: 'entries' });
    RateCardPart.belongsTo(models.AdminUser, { foreignKey: 'createdBy', as: 'creator' });
  };

  return RateCardPart;
};
