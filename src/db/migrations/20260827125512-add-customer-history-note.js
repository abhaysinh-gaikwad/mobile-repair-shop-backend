'use strict';

/**
 * What the CUSTOMER says about the phone's own history — e.g. "shown to 3
 * other shops, none were sure it could be fixed" — typed in by staff at
 * intake. Deliberately separate from `customer_complaint` (the technical
 * problem) and from the system's own auto-tracked repeat-visit history:
 * this is the customer's account of what happened elsewhere, which the shop
 * has no record of.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      { tableName: 'repair_jobs', schema: 'public' },
      'customer_history_note',
      { type: Sequelize.TEXT, allowNull: true },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn({ tableName: 'repair_jobs', schema: 'public' }, 'customer_history_note');
  },
};
