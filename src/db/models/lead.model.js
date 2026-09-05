'use strict';

/**
 * A customer enquiry, BEFORE it becomes a repair job.
 *
 * Deliberately a separate entity from RepairJob: most enquiries never turn
 * into a repair, and forcing them into repair_jobs would pollute receipt
 * numbering, billing and every report in the app. When a lead does convert,
 * `repairJobId` links the two.
 */
module.exports = function (sequelize, DataTypes) {
  const Lead = sequelize.define(
    'Lead',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

      customerName: { type: DataTypes.STRING(120), allowNull: true, field: 'customer_name' },
      mobile: { type: DataTypes.STRING(20), allowNull: true },
      /**
       * Last 10 digits of `mobile`. Set by normalizeMobile() in the service
       * layer, never by hand — duplicate detection depends entirely on this
       * being consistent. See the migration for the full reasoning.
       */
      mobileNormalized: { type: DataTypes.STRING(10), allowNull: true, field: 'mobile_normalized' },

      source: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'MANUAL' },
      enquiry: { type: DataTypes.TEXT, allowNull: true },
      brand: { type: DataTypes.STRING(60), allowNull: true },
      modelNumber: { type: DataTypes.STRING(80), allowNull: true, field: 'model_number' },
      problem: { type: DataTypes.TEXT, allowNull: true },

      status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'NEW' },
      assignedTo: { type: DataTypes.INTEGER, allowNull: true, field: 'assigned_to' },
      repairJobId: { type: DataTypes.INTEGER, allowNull: true, field: 'repair_job_id' },

      notes: { type: DataTypes.TEXT, allowNull: true },
      lastContactAt: { type: DataTypes.DATE, allowNull: true, field: 'last_contact_at' },
      contactCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'contact_count' },

      createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    },
    {
      tableName: 'leads',
      schema: 'public',
      underscored: true,
      timestamps: true,
    },
  );

  Lead.associate = function (models) {
    Lead.belongsTo(models.AdminUser, { foreignKey: 'assignedTo', as: 'assignee' });
    Lead.belongsTo(models.AdminUser, { foreignKey: 'createdBy', as: 'creator' });
    Lead.belongsTo(models.RepairJob, { foreignKey: 'repairJobId', as: 'repairJob' });
    Lead.hasMany(models.LeadAssignment, { foreignKey: 'leadId', as: 'assignments' });
  };

  return Lead;
};
