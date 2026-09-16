'use strict';

/**
 * A plain staff-set flag: "this customer has been here before", independent
 * of the existing `previousRepairJobId`/`repeatOfReceipt` link.
 *
 * That existing pair means something more specific — THIS repair is
 * genuinely a re-opened case of one particular earlier job, picked from a
 * dropdown. This flag is looser: staff ticking a box at intake because they
 * recognise a returning customer, whether or not they bother to (or even
 * can) look up which exact earlier job it was. Kept deliberately separate
 * rather than reusing the existing link, so ticking this box never implies
 * — or requires — a specific prior receipt.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      { tableName: 'repair_jobs', schema: 'public' },
      'is_repeat_customer',
      { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn({ tableName: 'repair_jobs', schema: 'public' }, 'is_repeat_customer');
  },
};
