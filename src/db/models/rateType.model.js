'use strict';

/**
 * "Original", "Market", "Market Quality 100" — global and open-ended, same
 * reasoning as RateCardPart: the shop invents these as needed, and this
 * list is never a fixed enum.
 */
module.exports = function (sequelize, DataTypes) {
  const RateType = sequelize.define(
    'RateType',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
      createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    },
    {
      tableName: 'rate_types',
      schema: 'public',
      underscored: true,
      timestamps: true,
      indexes: [{ fields: ['is_active'] }],
    },
  );

  RateType.associate = function (models) {
    RateType.hasMany(models.RateCardEntry, { foreignKey: 'rateTypeId', as: 'entries' });
    RateType.belongsTo(models.AdminUser, { foreignKey: 'createdBy', as: 'creator' });
  };

  return RateType;
};
