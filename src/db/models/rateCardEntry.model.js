'use strict';

/**
 * One price for one (model, part, rate type) combination — e.g. Samsung A35
 * + Display + Original = ₹3,000. Multiple rate types coexist for the same
 * model+part on purpose (Original/Market/Market Quality 100 all sit
 * alongside each other); the unique index in the migration is what enforces
 * "one row per combination" while allowing as many DIFFERENT rate types as
 * the shop wants — adding a new one is a new row, never an overwrite of an
 * existing one.
 */
module.exports = function (sequelize, DataTypes) {
  const RateCardEntry = sequelize.define(
    'RateCardEntry',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      modelId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'model_id',
        references: { model: 'rate_card_models', key: 'id' },
      },
      partId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'part_id',
        references: { model: 'rate_card_parts', key: 'id' },
      },
      rateTypeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'rate_type_id',
        references: { model: 'rate_types', key: 'id' },
      },
      price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true },
      createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
      updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    },
    {
      tableName: 'rate_card_entries',
      schema: 'public',
      underscored: true,
      timestamps: true,
    },
  );

  RateCardEntry.associate = function (models) {
    RateCardEntry.belongsTo(models.RateCardModel, { foreignKey: 'modelId', as: 'model' });
    RateCardEntry.belongsTo(models.RateCardPart, { foreignKey: 'partId', as: 'part' });
    RateCardEntry.belongsTo(models.RateType, { foreignKey: 'rateTypeId', as: 'rateType' });
    RateCardEntry.belongsTo(models.AdminUser, { foreignKey: 'createdBy', as: 'creator' });
    RateCardEntry.belongsTo(models.AdminUser, { foreignKey: 'updatedBy', as: 'updater' });
  };

  return RateCardEntry;
};
