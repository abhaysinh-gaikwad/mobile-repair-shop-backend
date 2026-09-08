'use strict';

const { PAYMENT_METHOD, PAYMENT_TYPE, UNCONFIRMED_PAYMENT_STATUS } = require('@src/utils/constants/public.constants');

/**
 * A cash-memo entry waiting on the "Payment Received" tick.
 *
 * Kept OUT of `repair_ledger` on purpose — see the migration for why. This
 * row never affects a job's balance or any Cash Memo total; it only starts
 * to once `ConfirmUnconfirmedPaymentService` turns it into a real ledger
 * entry, at which point `confirmedLedgerEntryId` points at that row.
 */
module.exports = function (sequelize, DataTypes) {
  const UnconfirmedPayment = sequelize.define(
    'UnconfirmedPayment',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

      repairJobId: { type: DataTypes.INTEGER, allowNull: false, field: 'repair_job_id' },

      // Snapshots, same reasoning as repair_ledger — reads standalone.
      receiptNumber: { type: DataTypes.STRING(20), allowNull: false, field: 'receipt_number' },
      customerId: { type: DataTypes.INTEGER, allowNull: true, field: 'customer_id' },
      customerName: { type: DataTypes.STRING(120), allowNull: true, field: 'customer_name' },
      customerMobile: { type: DataTypes.STRING(20), allowNull: true, field: 'customer_mobile' },

      amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      paymentType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: PAYMENT_TYPE.ADVANCE,
        field: 'payment_type',
      },
      paymentMethod: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: PAYMENT_METHOD.CASH,
        field: 'payment_method',
      },
      note: { type: DataTypes.TEXT, allowNull: true },

      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: UNCONFIRMED_PAYMENT_STATUS.PENDING,
      },

      paidAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'paid_at' },

      createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },

      confirmedLedgerEntryId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'confirmed_ledger_entry_id',
      },
      confirmedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'confirmed_by' },
      confirmedAt: { type: DataTypes.DATE, allowNull: true, field: 'confirmed_at' },

      rejectedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'rejected_by' },
      rejectedAt: { type: DataTypes.DATE, allowNull: true, field: 'rejected_at' },
      rejectionReason: { type: DataTypes.TEXT, allowNull: true, field: 'rejection_reason' },
    },
    {
      tableName: 'unconfirmed_payments',
      schema: 'public',
      underscored: true,
      timestamps: true,
      indexes: [{ fields: ['repair_job_id'] }, { fields: ['status'] }, { fields: ['paid_at'] }],
    },
  );

  UnconfirmedPayment.associate = function (models) {
    UnconfirmedPayment.belongsTo(models.RepairJob, { foreignKey: 'repairJobId', as: 'repairJob' });
    UnconfirmedPayment.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
    UnconfirmedPayment.belongsTo(models.AdminUser, { foreignKey: 'createdBy', as: 'creator' });
    UnconfirmedPayment.belongsTo(models.AdminUser, { foreignKey: 'confirmedBy', as: 'confirmer' });
    UnconfirmedPayment.belongsTo(models.AdminUser, { foreignKey: 'rejectedBy', as: 'rejecter' });
    UnconfirmedPayment.belongsTo(models.RepairLedger, { foreignKey: 'confirmedLedgerEntryId', as: 'confirmedEntry' });
  };

  return UnconfirmedPayment;
};
