'use strict';

/**
 * One row per device-unlock-credential reveal. Append-only: there is no
 * update or delete path anywhere in the application.
 */
module.exports = function (sequelize, DataTypes) {
  const DeviceUnlockAccessLog = sequelize.define(
    'DeviceUnlockAccessLog',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      repairJobId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'repair_job_id',
        references: { model: 'repair_jobs', key: 'id' },
      },
      adminUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'admin_user_id',
        references: { model: 'admin_users', key: 'id' },
      },
      ipAddress: { type: DataTypes.STRING(64), allowNull: true, field: 'ip_address' },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
    },
    {
      tableName: 'device_unlock_access_logs',
      schema: 'public',
      underscored: true,
      timestamps: false,
      indexes: [{ fields: ['repair_job_id'] }],
    },
  );

  DeviceUnlockAccessLog.associate = function (models) {
    DeviceUnlockAccessLog.belongsTo(models.RepairJob, { foreignKey: 'repairJobId', as: 'repairJob' });
    DeviceUnlockAccessLog.belongsTo(models.AdminUser, { foreignKey: 'adminUserId', as: 'adminUser' });
  };

  return DeviceUnlockAccessLog;
};
