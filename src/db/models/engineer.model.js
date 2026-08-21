'use strict';

module.exports = function (sequelize, DataTypes) {
  const Engineer = sequelize.define(
    'Engineer',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      mobile: { type: DataTypes.STRING(20), allowNull: true },
      specialization: { type: DataTypes.STRING(120), allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      // Engineers are deactivated, never deleted — historical repair jobs
      // must keep pointing at whoever actually did the work.
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    },
    {
      tableName: 'engineers',
      schema: 'public',
      underscored: true,
      timestamps: true,
      indexes: [{ fields: ['is_active'] }],
    },
  );

  Engineer.associate = function (models) {
    Engineer.hasMany(models.RepairJob, { foreignKey: 'engineerId', as: 'repairJobs' });
  };

  return Engineer;
};
