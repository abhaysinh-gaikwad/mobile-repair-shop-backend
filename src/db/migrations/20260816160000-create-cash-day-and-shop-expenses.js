'use strict';

/**
 * Daily cash-drawer management.
 *
 *  1. `cash_days`      — one row per shop day: the opening balance the admin
 *                        counts into the drawer each morning, and the closing
 *                        snapshot taken when the day is closed.
 *
 *  2. `shop_expenses`  — money OUT: a part fetched from a supplier. Kept in its
 *                        own table rather than as a negative `repair_ledger`
 *                        row, because the ledger is the record of what
 *                        CUSTOMERS paid. Mixing an expense in there would
 *                        silently reduce reported collections and corrupt every
 *                        existing revenue figure.
 *
 * Closing balance = opening + customer collections − shop expenses (cash only
 * affects the physical drawer; digital methods are reported separately).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') };

    await queryInterface.createTable(
      'cash_days',
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        // The shop's local calendar date. UNIQUE: one drawer per day.
        business_date: { type: Sequelize.DATEONLY, allowNull: false, unique: true },
        opening_balance: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'OPEN' },

        // Filled in only when the day is closed — a frozen snapshot so a later
        // back-dated entry can never rewrite a day the owner already signed off.
        closing_balance: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        closing_collections: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        closing_expenses: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        closed_at: { type: Sequelize.DATE, allowNull: true },
        closed_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'admin_users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },

        notes: { type: Sequelize.TEXT, allowNull: true },
        opened_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'admin_users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        created_at: { ...now },
        updated_at: { ...now },
      },
      { schema: 'public' },
    );

    await queryInterface.createTable(
      'shop_expenses',
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        entry_no: { type: Sequelize.STRING(20), allowNull: false, unique: true },
        amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        description: { type: Sequelize.STRING(255), allowNull: false },
        payment_method: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'CASH' },

        // Optional link: a part bought FOR a specific repair. Nullable because
        // the shop also buys general stock.
        repair_job_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'repair_jobs', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        receipt_number: { type: Sequelize.STRING(20), allowNull: true },
        vendor: { type: Sequelize.STRING(120), allowNull: true },
        // Who fetched the part.
        brought_by: { type: Sequelize.STRING(120), allowNull: true },

        spent_at: { ...now },
        recorded_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'admin_users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        created_at: { ...now },
      },
      { schema: 'public' },
    );

    await queryInterface.addIndex('shop_expenses', ['spent_at'], { name: 'shop_expenses_spent_at_idx' });
    await queryInterface.addIndex('shop_expenses', ['repair_job_id'], { name: 'shop_expenses_repair_job_id_idx' });
    await queryInterface.addIndex('shop_expenses', ['payment_method'], { name: 'shop_expenses_payment_method_idx' });

    // Own numbering series, like the ledger's L- numbers.
    await queryInterface.sequelize.query(
      'CREATE SEQUENCE IF NOT EXISTS public.shop_expense_entry_no_seq START WITH 1 INCREMENT BY 1;',
    );

    // The repair's FINAL amount is distinct from the intake ESTIMATE. The
    // estimate is a quotation given at the counter; the final amount is what
    // the customer actually owes once the work is done.
    await queryInterface.addColumn(
      { tableName: 'repair_jobs', schema: 'public' },
      'final_amount',
      { type: Sequelize.DECIMAL(10, 2), allowNull: true },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn({ tableName: 'repair_jobs', schema: 'public' }, 'final_amount');
    await queryInterface.sequelize.query('DROP SEQUENCE IF EXISTS public.shop_expense_entry_no_seq;');
    await queryInterface.dropTable('shop_expenses', { schema: 'public' });
    await queryInterface.dropTable('cash_days', { schema: 'public' });
  },
};
