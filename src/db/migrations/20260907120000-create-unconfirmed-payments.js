'use strict';

/**
 * "Payment Received" confirmation.
 *
 * A cash entry made at the counter is sometimes wrong — entered by mistake,
 * or the money genuinely has not changed hands yet (a customer says "I'll
 * pay when I collect" and staff starts typing anyway). Recording that
 * straight into `repair_ledger` would be wrong: EVERY total in this app —
 * the Cash Memo, the daily collection tiles, the cash drawer, the collection
 * report, a job's own balance — is a plain SUM(amount) over that one table
 * (see billing.service.js, cashDay.service.js, repair.helpers.js). An
 * unconfirmed rupee sitting in there would inflate every one of those the
 * instant it was typed, before anyone had actually checked the drawer.
 *
 * So an unconfirmed entry is kept OUT of repair_ledger entirely, in this
 * separate staging table, until a person explicitly confirms it. That is
 * also why every existing SUM/report query needed NO changes at all to stay
 * correct — they were never told about this table, so they can't accidentally
 * include something in it.
 *
 * Unlike repair_ledger this table is NOT append-only: it is a workflow record
 * (pending -> confirmed/rejected), not itself a piece of the shop's financial
 * history. The financial history is created the moment it is confirmed, as a
 * completely ordinary repair_ledger row indistinguishable from one entered
 * with the box ticked from the start.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      { tableName: 'unconfirmed_payments', schema: 'public' },
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },

        repair_job_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: { tableName: 'repair_jobs', schema: 'public' }, key: 'id' },
          onUpdate: 'CASCADE',
          // A job with an unconfirmed payment sitting against it can't be deleted.
          onDelete: 'RESTRICT',
        },

        // Snapshots, same reasoning as repair_ledger: this must read
        // standalone even if the customer record changes later.
        receipt_number: { type: Sequelize.STRING(20), allowNull: false },
        customer_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: { tableName: 'customers', schema: 'public' }, key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        customer_name: { type: Sequelize.STRING(120), allowNull: true },
        customer_mobile: { type: Sequelize.STRING(20), allowNull: true },

        amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        payment_type: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'ADVANCE' },
        payment_method: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'CASH' },
        note: { type: Sequelize.TEXT, allowNull: true },

        // PENDING | CONFIRMED | REJECTED. STRING, not an ENUM — same reasoning
        // as repair_jobs.status: this list may need a value added later and
        // Postgres cannot drop an enum value.
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'PENDING' },

        // When the money was SAID to be taken, which is what the eventual
        // ledger entry is backdated to on confirm.
        paid_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },

        created_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: { tableName: 'admin_users', schema: 'public' }, key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },

        // Set once, on confirm — the real ledger row this staging row became.
        confirmed_ledger_entry_id: {
          type: Sequelize.BIGINT,
          allowNull: true,
          references: { model: { tableName: 'repair_ledger', schema: 'public' }, key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        confirmed_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: { tableName: 'admin_users', schema: 'public' }, key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        confirmed_at: { type: Sequelize.DATE, allowNull: true },

        rejected_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: { tableName: 'admin_users', schema: 'public' }, key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        rejected_at: { type: Sequelize.DATE, allowNull: true },
        rejection_reason: { type: Sequelize.TEXT, allowNull: true },

        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      },
    );

    await queryInterface.addIndex(
      { tableName: 'unconfirmed_payments', schema: 'public' },
      ['repair_job_id'],
      { name: 'unconfirmed_payments_repair_job_id_idx' },
    );
    await queryInterface.addIndex(
      { tableName: 'unconfirmed_payments', schema: 'public' },
      ['status'],
      { name: 'unconfirmed_payments_status_idx' },
    );
    await queryInterface.addIndex(
      { tableName: 'unconfirmed_payments', schema: 'public' },
      ['paid_at'],
      { name: 'unconfirmed_payments_paid_at_idx' },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable({ tableName: 'unconfirmed_payments', schema: 'public' });
  },
};
