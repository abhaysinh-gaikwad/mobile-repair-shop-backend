'use strict';

/**
 * Category = RETURN (money handed back to a customer) can be recorded with
 * NO receipt number — a return doesn't always trace back to a specific
 * repair job in the system, but the shop still wants to know WHO the money
 * went to. `customer_name` is that fallback, used only when there is no
 * `receipt_number` to identify them by instead.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      { tableName: 'shop_expenses', schema: 'public' },
      'customer_name',
      { type: Sequelize.STRING(120), allowNull: true },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn({ tableName: 'shop_expenses', schema: 'public' }, 'customer_name');
  },
};
