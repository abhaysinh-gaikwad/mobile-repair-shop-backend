'use strict';

/**
 * Audit trail for outbound WhatsApp messages.
 *
 * One row per send attempt, so every message can be traced back to exactly
 * the repair/customer it was about, and every failure is diagnosable without
 * digging through logs. Append-style: a retry creates a NEW row rather than
 * mutating the old one, so the history of attempts is never lost.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      'whatsapp_notifications',
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },

        repair_job_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'repair_jobs', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        customer_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'customers', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },

        // E.164-ish, whatever was actually dialled (with country code).
        phone_number: { type: Sequelize.STRING(20), allowNull: false },

        message_type: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'RECEIPT' },
        template_name: { type: Sequelize.STRING(120), allowNull: true },

        // Meta's own identifiers/state — kept verbatim so support tickets with
        // Meta can reference the exact wamid.
        whatsapp_message_id: { type: Sequelize.STRING(120), allowNull: true },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'PENDING' },
        error_code: { type: Sequelize.STRING(20), allowNull: true },
        error_message: { type: Sequelize.TEXT, allowNull: true },

        sent_at: { type: Sequelize.DATE, allowNull: true },
        sent_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'admin_users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      },
      { schema: 'public' },
    );

    await queryInterface.addIndex('whatsapp_notifications', ['repair_job_id'], {
      name: 'whatsapp_notifications_repair_job_id_idx',
    });
    await queryInterface.addIndex('whatsapp_notifications', ['customer_id'], {
      name: 'whatsapp_notifications_customer_id_idx',
    });
    await queryInterface.addIndex('whatsapp_notifications', ['status'], {
      name: 'whatsapp_notifications_status_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('whatsapp_notifications', { schema: 'public' });
  },
};
