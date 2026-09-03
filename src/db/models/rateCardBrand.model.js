'use strict';

/** "Samsung", "Apple", "Vivo" — admin-managed, not a fixed list. */
module.exports = function (sequelize, DataTypes) {
  const RateCardBrand = sequelize.define(
    'RateCardBrand',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
      createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    },
    {
      tableName: 'rate_card_brands',
      schema: 'public',
      underscored: true,
      timestamps: true,
      indexes: [{ fields: ['is_active'] }],
    },
  );

  RateCardBrand.associate = function (models) {
    RateCardBrand.hasMany(models.RateCardModel, { foreignKey: 'brandId', as: 'models' });
    RateCardBrand.belongsTo(models.AdminUser, { foreignKey: 'createdBy', as: 'creator' });
  };

  return RateCardBrand;
};
