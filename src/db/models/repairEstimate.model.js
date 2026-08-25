'use strict';

/**
 * The history of quoted costs for a repair job.
 *
 * APPEND-ONLY BY DESIGN, same as call logs: no update or delete route, no UI
 * affordance to edit one. A quote given to a customer is a record the shop
 * may need to point back to later ("we told you ₹1,500 on the 12th").
 */
module.exports = function (sequelize, DataTypes) {
  const RepairEstimate = sequelize.define(
    'RepairEstimate',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      repairJobId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'repair_job_id',
        references: { model: 'repair_jobs', key: 'id' },
        onDelete: 'CASCADE',
      },
      amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      note: { type: DataTypes.TEXT, allowNull: true },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'created_by',
        references: { model: 'admin_users', key: 'id' },
      },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
    },
    {
      tableName: 'repair_estimates',
      schema: 'public',
      underscored: true,
      timestamps: false,
      indexes: [{ fields: ['repair_job_id', 'created_at'] }],
    },
  );

  RepairEstimate.associate = function (models) {
    RepairEstimate.belongsTo(models.RepairJob, { foreignKey: 'repairJobId', as: 'repairJob' });
    RepairEstimate.belongsTo(models.AdminUser, { foreignKey: 'createdBy', as: 'creator' });
  };

  return RepairEstimate;
};
