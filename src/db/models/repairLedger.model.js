'use strict';

const {
  LEDGER_ENTRY_TYPE,
  LEDGER_SOURCE,
  PAYMENT_METHOD,
  PAYMENT_TYPE,
} = require('@src/utils/constants/public.constants');

/**
 * THE MONEY TABLE — the shop's cash-memo notebook in digital form.
 *
 * This is the ONLY place money is recorded. There is no separate payments
 * table, so there are never two sets of books that can disagree.
 *
 * The FINANCIAL FACTS on a row are IMMUTABLE AND APPEND-ONLY:
 *   - no endpoint edits amount, method, type, receipt, or customer
 *   - a mistake in any of those is corrected by posting a REVERSAL row
 *     carrying a NEGATIVE amount, a link to the original, and a mandatory
 *     reason — never by changing the original row
 *
 * `isConfirmed` is the ONE deliberate, narrow exception — a plain toggle, at
 * the shop's explicit request: staff sometimes enter a payment that was
 * never actually received, or need to un-tick one entered by mistake, as
 * many times as it takes to get right. Every SUM that means "money actually
 * in hand" (a job's balance, the Cash Drawer, daily/collection reports) must
 * filter `isConfirmed: true` — see getRepairMoneySummary() and the Cash Memo
 * services for the full list. New rows default to `true`: the checkbox
 * exists to correct a mistake after the fact, not to make staff stop and
 * decide at entry time.
 *
 * Because reversals are negative, `SUM(amount)` (among CONFIRMED rows) is
 * always the correct answer for a job, a day, or all time.
 *
 * The customer/receipt columns are SNAPSHOTS taken at the moment money changed
 * hands: correcting a customer's name next month must not silently rewrite
 * what last month's cash memo said.
 */
module.exports = function (sequelize, DataTypes) {
  const RepairLedger = sequelize.define(
    'RepairLedger',
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },

      // Cash-memo line number, from a Postgres SEQUENCE. e.g. "L-000001"
      entryNo: { type: DataTypes.STRING(20), allowNull: false, unique: true, field: 'entry_no' },

      /**
       * NULL for a MANUAL entry — money with no repair job behind it (an
       * ad-hoc payment, or an old paper record). A database CHECK constraint
       * guarantees REPAIR_JOB rows always have one and MANUAL rows never do,
       * which is what stops a manual entry from silently altering some job's
       * balance (getRepairMoneySummary sums by this column).
       */
      repairJobId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'repair_job_id',
        references: { model: 'repair_jobs', key: 'id' },
        // RESTRICT, not CASCADE: a job carrying money can never be deleted.
        onDelete: 'RESTRICT',
      },

      /** REPAIR_JOB or MANUAL — see LEDGER_SOURCE. */
      source: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: LEDGER_SOURCE.REPAIR_JOB,
      },

      // ---- Snapshots, so the cash memo reads standalone ----
      /** NULL on MANUAL entries: an old paper record often has no receipt number. */
      receiptNumber: { type: DataTypes.STRING(20), allowNull: true, field: 'receipt_number' },
      customerId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'customer_id',
        references: { model: 'customers', key: 'id' },
      },
      customerName: { type: DataTypes.STRING(120), allowNull: true, field: 'customer_name' },
      customerMobile: { type: DataTypes.STRING(20), allowNull: true, field: 'customer_mobile' },

      entryType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: LEDGER_ENTRY_TYPE.PAYMENT,
        field: 'entry_type',
      },
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

      // POSITIVE for PAYMENT, NEGATIVE for REVERSAL.
      amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },

      // Running state of the job at the moment of this entry, so any single
      // row can be read and understood on its own.
      jobTotalAfter: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0, field: 'job_total_after' },
      jobPaidAfter: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0, field: 'job_paid_after' },
      jobBalanceAfter: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'job_balance_after',
      },

      // Set on REVERSAL rows only.
      reversesEntryId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'reverses_entry_id',
        references: { model: 'repair_ledger', key: 'id' },
      },
      reversalReason: { type: DataTypes.TEXT, allowNull: true, field: 'reversal_reason' },

      /** What the money was for, when there is no repair job to explain it. */
      description: { type: DataTypes.TEXT, allowNull: true },

      /**
       * The shop's own paper receipt/bill number for an old record.
       * Deliberately separate from `receiptNumber`, which means "a receipt
       * number THIS system generated" and is what links a row to repair_jobs.
       */
      reference: { type: DataTypes.STRING(60), allowNull: true },

      note: { type: DataTypes.TEXT, allowNull: true },

      // When money actually changed hands (may differ from created_at).
      paidAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'paid_at' },

      receivedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'received_by',
        references: { model: 'admin_users', key: 'id' },
      },

      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },

      /**
       * The confirmation checkbox. TRUE = counted as real, in-hand money in
       * every total; FALSE = entered, but not (or no longer) treated as
       * collected. See the class doc above — this is the one field on this
       * table that is ever updated after creation.
       */
      isConfirmed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_confirmed' },
    },
    {
      tableName: 'repair_ledger',
      schema: 'public',
      underscored: true,
      // Append-only: created_at only, no updated_at.
      timestamps: false,
      indexes: [
        { fields: ['repair_job_id'] },
        { fields: ['paid_at'] },
        { fields: ['payment_method'] },
        { fields: ['customer_id'] },
        { fields: ['entry_type'] },
        { fields: ['source'] },
      ],
    },
  );

  RepairLedger.associate = function (models) {
    RepairLedger.belongsTo(models.RepairJob, { foreignKey: 'repairJobId', as: 'repairJob' });
    RepairLedger.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
    RepairLedger.belongsTo(models.AdminUser, { foreignKey: 'receivedBy', as: 'receiver' });
    RepairLedger.belongsTo(models.RepairLedger, { foreignKey: 'reversesEntryId', as: 'reversedEntry' });
    RepairLedger.hasOne(models.RepairLedger, { foreignKey: 'reversesEntryId', as: 'reversalEntry' });
  };

  return RepairLedger;
};
