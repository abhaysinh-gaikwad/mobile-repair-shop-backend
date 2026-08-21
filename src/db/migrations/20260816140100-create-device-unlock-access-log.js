'use strict';

/**
 * Audit trail for device unlock credential reveals.
 *
 * A customer's phone PIN is the most sensitive thing this system holds, so
 * every decryption is recorded: who looked, at which repair, when, and from
 * where. This lives in its own table rather than in `repair_status_history`,
 * which belongs to the repair workflow the shop actually reads day to day.
 *
 * Append-only — there is no update or delete path.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      'device_unlock_access_logs',
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        repair_job_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'repair_jobs', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        admin_user_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'admin_users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        ip_address: { type: Sequelize.STRING(64), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      },
      { schema: 'public' },
    );

    await queryInterface.addIndex('device_unlock_access_logs', ['repair_job_id'], {
      name: 'device_unlock_access_logs_repair_job_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('device_unlock_access_logs', { schema: 'public' });
  },
};
