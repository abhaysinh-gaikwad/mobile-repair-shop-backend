'use strict';

/**
 * The 2-3 employees who handle online enquiries and calling.
 * Records only — they do not log into the system.
 */
module.exports = function (sequelize, DataTypes) {
  const LeadHandler = sequelize.define(
    'LeadHandler',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      mobile: { type: DataTypes.STRING(20), allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    },
    {
      tableName: 'lead_handlers',
      schema: 'public',
      underscored: true,
      timestamps: true,
      indexes: [{ fields: ['is_active'] }],
    },
  );

  LeadHandler.associate = function (models) {
    LeadHandler.hasMany(models.RepairJob, { foreignKey: 'leadHandlerId', as: 'repairJobs' });
    LeadHandler.hasMany(models.Customer, { foreignKey: 'leadHandlerId', as: 'customers' });
  };

  return LeadHandler;
};
