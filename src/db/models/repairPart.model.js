'use strict';

/**
 * Spare parts used on a repair. Deliberately NOT an inventory system —
 * there is no stock level, no supplier, no purchase order. The requirement
 * is only to record what was fitted and what it cost.
 */
module.exports = function (sequelize, DataTypes) {
  const RepairPart = sequelize.define(
    'RepairPart',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      repairJobId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'repair_job_id',
        references: { model: 'repair_jobs', key: 'id' },
        onDelete: 'CASCADE',
      },
      partName: { type: DataTypes.STRING(160), allowNull: false, field: 'part_name' },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0, field: 'unit_price' },
      totalPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0, field: 'total_price' },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'repair_parts',
      schema: 'public',
      underscored: true,
      timestamps: true,
      indexes: [{ fields: ['repair_job_id'] }],
    },
  );

  RepairPart.associate = function (models) {
    RepairPart.belongsTo(models.RepairJob, { foreignKey: 'repairJobId', as: 'repairJob' });
  };

  return RepairPart;
};
