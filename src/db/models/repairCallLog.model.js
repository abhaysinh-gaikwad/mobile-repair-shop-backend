'use strict';

/**
 * The customer calling history for a repair job.
 *
 * APPEND-ONLY BY DESIGN. There is no update or delete route, and no UI
 * affordance to edit one. What was told to the customer, and when, is a
 * record the shop may need to rely on later — so it is never overwritten.
 */
module.exports = function (sequelize, DataTypes) {
  const RepairCallLog = sequelize.define(
    'RepairCallLog',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      repairJobId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'repair_job_id',
        references: { model: 'repair_jobs', key: 'id' },
        onDelete: 'CASCADE',
      },
      calledAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'called_at' },

      // Free text, not an FK: the caller is not always a system user.
      calledBy: { type: DataTypes.STRING(120), allowNull: false, field: 'called_by' },

      communication: { type: DataTypes.TEXT, allowNull: false },
      nextAction: { type: DataTypes.TEXT, allowNull: true, field: 'next_action' },

      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'created_by',
        references: { model: 'admin_users', key: 'id' },
      },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
    },
    {
      tableName: 'repair_call_logs',
      schema: 'public',
      underscored: true,
      timestamps: false,
      indexes: [{ fields: ['repair_job_id', 'called_at'] }],
    },
  );

  RepairCallLog.associate = function (models) {
    RepairCallLog.belongsTo(models.RepairJob, { foreignKey: 'repairJobId', as: 'repairJob' });
    RepairCallLog.belongsTo(models.AdminUser, { foreignKey: 'createdBy', as: 'creator' });
  };

  return RepairCallLog;
};
