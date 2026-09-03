'use strict';

/**
 * Minimal role split — OWNER (full access, the existing behaviour) vs STAFF
 * (a telecaller account, restricted only where the app explicitly checks
 * for it: Rate Card management). Every other route stays open to any
 * logged-in admin, unchanged.
 *
 * STRING, not a Postgres ENUM — same reasoning as repair_jobs.status:
 * Postgres cannot drop an enum value, and this list may grow.
 *
 * Every EXISTING account defaults to OWNER, so this migration cannot lock
 * anyone out of anything they could already do.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      { tableName: 'admin_users', schema: 'public' },
      'role',
      { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'OWNER' },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn({ tableName: 'admin_users', schema: 'public' }, 'role');
  },
};
