'use strict';

const { REPAIR_STATUS } = require('@src/utils/constants/public.constants');

/**
 * The spine of the whole system. Everything about one customer's repair —
 * parts, payments, calls, status changes, the printed receipt — hangs off
 * a single repair job identified by its receipt number.
 */
module.exports = function (sequelize, DataTypes) {
  const RepairJob = sequelize.define(
    'RepairJob',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

      // Assigned from a Postgres SEQUENCE inside the creating transaction.
      receiptNumber: { type: DataTypes.STRING(20), allowNull: false, unique: true, field: 'receipt_number' },

      customerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'customer_id',
        references: { model: 'customers', key: 'id' },
      },
      engineerId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'engineer_id',
        references: { model: 'engineers', key: 'id' },
      },

      // Per-visit attribution, snapshotted as text (see leadSource.model.js).
      leadSource: { type: DataTypes.STRING(60), allowNull: true, field: 'lead_source' },
      leadHandlerId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'lead_handler_id',
        references: { model: 'lead_handlers', key: 'id' },
      },
      leadAt: { type: DataTypes.DATE, allowNull: true, field: 'lead_at' },

      // ---- Device ----
      brand: { type: DataTypes.STRING(60), allowNull: false },
      modelNumber: { type: DataTypes.STRING(120), allowNull: false, field: 'model_number' },
      imei: { type: DataTypes.STRING(30), allowNull: true },

      // ---- Items received with the phone (printed on the receipt) ----
      hasSimCard: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'has_sim_card' },
      hasMemoryCard: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'has_memory_card' },
      hasBattery: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'has_battery' },
      hasCharger: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'has_charger' },
      otherAccessories: { type: DataTypes.STRING(255), allowNull: true, field: 'other_accessories' },

      // What the customer said when handing the phone over. Never edited
      // afterwards — findings belong in `diagnosis`.
      customerComplaint: { type: DataTypes.TEXT, allowNull: false, field: 'customer_complaint' },

      // ---- Device screen lock (sensitive) ----
      // Captured so the engineer can test the phone after repair. NEVER a
      // Google/Apple/email/banking password. The secret is stored encrypted
      // (see crypto.utils.js) and excluded from the default scope so it can
      // never be serialized into a list response or a receipt by accident.
      deviceUnlockType: { type: DataTypes.STRING(20), allowNull: true, field: 'device_unlock_type' },
      deviceUnlockSecret: { type: DataTypes.TEXT, allowNull: true, field: 'device_unlock_secret' },

      // ---- Repeat repair ----
      // A returning phone gets a BRAND NEW job and receipt number; the old job
      // is never reopened. These columns record the lineage only.
      previousRepairJobId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'previous_repair_job_id',
        references: { model: 'repair_jobs', key: 'id' },
      },
      repeatOfReceipt: { type: DataTypes.STRING(20), allowNull: true, field: 'repeat_of_receipt' },

      diagnosis: { type: DataTypes.TEXT, allowNull: true },
      repairDetails: { type: DataTypes.TEXT, allowNull: true, field: 'repair_details' },
      notes: { type: DataTypes.TEXT, allowNull: true },

      status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: REPAIR_STATUS.PENDING,
      },

      // The quotation given at the counter, before the phone is opened up.
      estimatedCost: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'estimated_cost' },

      // What the customer actually owes once the work is done. Distinct from
      // the estimate on purpose: the shop quotes ~₹1,200 and the real job may
      // come to ₹1,350. When set, this overrides parts+labour as the amount due.
      finalAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'final_amount' },
      labourCharge: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0, field: 'labour_charge' },

      // Persisted (= sum of parts + labour) so list and report queries stay a
      // single scan. Recomputed whenever parts or the labour charge change.
      totalAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0, field: 'total_amount' },

      receivedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'received_at' },
      deliveredAt: { type: DataTypes.DATE, allowNull: true, field: 'delivered_at' },

      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'created_by',
        references: { model: 'admin_users', key: 'id' },
      },
    },
    {
      tableName: 'repair_jobs',
      schema: 'public',
      underscored: true,
      timestamps: true,
      // The encrypted device credential is excluded everywhere by default;
      // only the explicit `withDeviceSecret` scope can load it, which keeps it
      // out of list responses, history views, reports and the receipt.
      defaultScope: {
        attributes: { exclude: ['deviceUnlockSecret'] },
      },
      scopes: {
        withDeviceSecret: {},
      },
      indexes: [
        { fields: ['customer_id'] },
        { fields: ['engineer_id'] },
        { fields: ['status'] },
        { fields: ['imei'] },
        { fields: ['received_at'] },
        { fields: ['lead_source'] },
      ],
    },
  );

  RepairJob.associate = function (models) {
    RepairJob.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
    RepairJob.belongsTo(models.Engineer, { foreignKey: 'engineerId', as: 'engineer' });
    RepairJob.belongsTo(models.LeadHandler, { foreignKey: 'leadHandlerId', as: 'leadHandler' });
    RepairJob.belongsTo(models.AdminUser, { foreignKey: 'createdBy', as: 'creator' });

    // Repeat-repair lineage: this job was raised because an earlier one came back.
    RepairJob.belongsTo(models.RepairJob, { foreignKey: 'previousRepairJobId', as: 'previousRepair' });
    RepairJob.hasMany(models.RepairJob, { foreignKey: 'previousRepairJobId', as: 'repeatRepairs' });

    RepairJob.hasMany(models.RepairPart, { foreignKey: 'repairJobId', as: 'parts' });
    RepairJob.hasMany(models.RepairLedger, { foreignKey: 'repairJobId', as: 'ledgerEntries' });
    RepairJob.hasMany(models.RepairCallLog, { foreignKey: 'repairJobId', as: 'callLogs' });
    RepairJob.hasMany(models.RepairStatusHistory, { foreignKey: 'repairJobId', as: 'statusHistory' });
  };

  return RepairJob;
};
