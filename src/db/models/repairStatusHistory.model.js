'use strict';

/**
 * One row per status change, written in the same transaction as the change
 * itself so the trail can never drift from the job's actual status.
 */
module.exports = function (sequelize, DataTypes) {
  const RepairStatusHistory = sequelize.define(
    'RepairStatusHistory',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      repairJobId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'repair_job_id',
        references: { model: 'repair_jobs', key: 'id' },
        onDelete: 'CASCADE',
      },
      fromStatus: { type: DataTypes.STRING(30), allowNull: true, field: 'from_status' },
      toStatus: { type: DataTypes.STRING(30), allowNull: false, field: 'to_status' },
      note: { type: DataTypes.TEXT, allowNull: true },
      changedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'changed_by',
        references: { model: 'admin_users', key: 'id' },
      },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
    },
    {
      tableName: 'repair_status_history',
      schema: 'public',
      underscored: true,
      timestamps: false,
      indexes: [{ fields: ['repair_job_id'] }],
    },
  );

  RepairStatusHistory.associate = function (models) {
    RepairStatusHistory.belongsTo(models.RepairJob, { foreignKey: 'repairJobId', as: 'repairJob' });
    RepairStatusHistory.belongsTo(models.AdminUser, { foreignKey: 'changedBy', as: 'changer' });
  };

  return RepairStatusHistory;
};
