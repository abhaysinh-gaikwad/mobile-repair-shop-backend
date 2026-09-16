'use strict';

/**
 * Replaces the separate `unconfirmed_payments` staging-table flow with a
 * plain boolean, toggleable in place, directly on the two money tables —
 * at the shop's explicit request: no popup, no separate Confirm/Discard
 * actions, just a checkbox on the entry itself that can be ticked and
 * unticked as many times as needed.
 *
 * `is_confirmed` defaults to TRUE on both tables. That default is doing two
 * jobs at once: every row that already exists is real, already-happened
 * money and must stay counted (a silent backfill to FALSE would zero out
 * the shop's own historical totals); and every NEW row created through the
 * normal "record a payment" / "record an expense" flow starts out counted,
 * exactly as it always has — the checkbox exists to let staff CORRECT a
 * mistake afterwards, not to make them stop and decide at entry time.
 *
 * `unconfirmed_payments` is left in place, unused, rather than dropped.
 * Checked before writing this migration: 0 PENDING rows exist anywhere
 * (Test or Prod) — CONFIRMED ones already have a real repair_ledger row,
 * REJECTED ones correctly never got one — so there is nothing to migrate.
 * Keeping the table costs nothing and preserves that history if it's ever
 * needed; the application code simply stops reading or writing it.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      { tableName: 'repair_ledger', schema: 'public' },
      'is_confirmed',
      { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    );
    await queryInterface.addColumn(
      { tableName: 'shop_expenses', schema: 'public' },
      'is_confirmed',
      { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    );

    await queryInterface.addIndex(
      { tableName: 'repair_ledger', schema: 'public' },
      ['is_confirmed'],
      { name: 'repair_ledger_is_confirmed_idx' },
    );
    await queryInterface.addIndex(
      { tableName: 'shop_expenses', schema: 'public' },
      ['is_confirmed'],
      { name: 'shop_expenses_is_confirmed_idx' },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex({ tableName: 'repair_ledger', schema: 'public' }, 'repair_ledger_is_confirmed_idx');
    await queryInterface.removeIndex({ tableName: 'shop_expenses', schema: 'public' }, 'shop_expenses_is_confirmed_idx');
    await queryInterface.removeColumn({ tableName: 'repair_ledger', schema: 'public' }, 'is_confirmed');
    await queryInterface.removeColumn({ tableName: 'shop_expenses', schema: 'public' }, 'is_confirmed');
  },
};
