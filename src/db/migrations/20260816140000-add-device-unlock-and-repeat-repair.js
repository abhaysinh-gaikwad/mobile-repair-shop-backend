'use strict';

/**
 * Adds:
 *  1. Device unlock credential (PIN / password / pattern) captured at intake
 *     so the engineer can actually test the phone after repair.
 *
 *     SENSITIVE. Stored encrypted at rest (AES-256-GCM, see
 *     src/utils/crypto.utils.js) and never returned by list endpoints, never
 *     printed on the receipt, never logged. Only an explicit, authenticated
 *     "reveal" call decrypts it.
 *
 *  2. Repeat-repair linkage. When a delivered phone comes back, the shop
 *     creates a BRAND NEW repair job with its own receipt number — the old job
 *     is never reopened. `previous_repair_job_id` records that lineage, and
 *     `repeat_of_receipt` keeps the old receipt number readable even if the
 *     original row is ever archived.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      { tableName: 'repair_jobs', schema: 'public' },
      'device_unlock_type',
      { type: Sequelize.STRING(20), allowNull: true },
    );

    // Ciphertext, not the credential itself — long enough for the
    // iv:authTag:payload envelope.
    await queryInterface.addColumn(
      { tableName: 'repair_jobs', schema: 'public' },
      'device_unlock_secret',
      { type: Sequelize.TEXT, allowNull: true },
    );

    await queryInterface.addColumn(
      { tableName: 'repair_jobs', schema: 'public' },
      'previous_repair_job_id',
      {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'repair_jobs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
    );

    await queryInterface.addColumn(
      { tableName: 'repair_jobs', schema: 'public' },
      'repeat_of_receipt',
      { type: Sequelize.STRING(20), allowNull: true },
    );

    await queryInterface.addIndex('repair_jobs', ['previous_repair_job_id'], {
      name: 'repair_jobs_previous_repair_job_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('repair_jobs', 'repair_jobs_previous_repair_job_id_idx');
    await queryInterface.removeColumn({ tableName: 'repair_jobs', schema: 'public' }, 'repeat_of_receipt');
    await queryInterface.removeColumn({ tableName: 'repair_jobs', schema: 'public' }, 'previous_repair_job_id');
    await queryInterface.removeColumn({ tableName: 'repair_jobs', schema: 'public' }, 'device_unlock_secret');
    await queryInterface.removeColumn({ tableName: 'repair_jobs', schema: 'public' }, 'device_unlock_type');
  },
};
