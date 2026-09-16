'use strict';

/**
 * "New CRM" — a genuinely separate lead-tracking module for telecallers,
 * deliberately NOT built on top of the existing `leads`/CRM board tables so
 * that module can keep working completely unchanged. Its own table, its own
 * serial-number sequence, its own everything.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      { tableName: 'new_crm_leads', schema: 'public' },
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        // "NCL-000001" — printed/shown in the table, generated from
        // new_crm_lead_serial_seq, never reused.
        serial_no: { type: Sequelize.STRING(20), allowNull: false, unique: true },
        telecaller_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'admin_users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        lead_date: { type: Sequelize.DATEONLY, allowNull: false },
        customer_name: { type: Sequelize.STRING(120), allowNull: false },
        location: { type: Sequelize.STRING(120), allowNull: true },
        mobile_number: { type: Sequelize.STRING(20), allowNull: false },
        model_number: { type: Sequelize.STRING(120), allowNull: true },
        problem: { type: Sequelize.TEXT, allowNull: true },
        telecaller_rate: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        // Free-text on purpose (not an enum) — "Keep the status system
        // flexible so additional statuses can be added later" without a
        // migration. The frontend offers a fixed starter list.
        status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'NEW' },
        follow_up_date: { type: Sequelize.DATEONLY, allowNull: true },
        created_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'admin_users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      },
      { schema: 'public' },
    );

    await queryInterface.addIndex('new_crm_leads', ['telecaller_id'], { name: 'new_crm_leads_telecaller_id_idx' });
    await queryInterface.addIndex('new_crm_leads', ['status'], { name: 'new_crm_leads_status_idx' });
    await queryInterface.addIndex('new_crm_leads', ['lead_date'], { name: 'new_crm_leads_lead_date_idx' });

    await queryInterface.sequelize.query(
      'CREATE SEQUENCE IF NOT EXISTS public.new_crm_lead_serial_seq START WITH 1 INCREMENT BY 1;',
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP SEQUENCE IF EXISTS public.new_crm_lead_serial_seq;');
    await queryInterface.dropTable({ tableName: 'new_crm_leads', schema: 'public' });
  },
};
