'use strict';

/**
 * "A35" under Samsung, "13" under Apple. The same model name can exist
 * under different brands, so uniqueness is enforced per-brand (see the
 * migration's composite index), not globally.
 */
module.exports = function (sequelize, DataTypes) {
  const RateCardModel = sequelize.define(
    'RateCardModel',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      brandId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'brand_id',
        references: { model: 'rate_card_brands', key: 'id' },
      },
      name: { type: DataTypes.STRING(120), allowNull: false },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
      createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    },
    {
      tableName: 'rate_card_models',
      schema: 'public',
      underscored: true,
      timestamps: true,
      indexes: [{ fields: ['is_active'] }],
    },
  );

  RateCardModel.associate = function (models) {
    RateCardModel.belongsTo(models.RateCardBrand, { foreignKey: 'brandId', as: 'brand' });
    RateCardModel.hasMany(models.RateCardEntry, { foreignKey: 'modelId', as: 'entries' });
    RateCardModel.belongsTo(models.AdminUser, { foreignKey: 'createdBy', as: 'creator' });
  };

  return RateCardModel;
};
