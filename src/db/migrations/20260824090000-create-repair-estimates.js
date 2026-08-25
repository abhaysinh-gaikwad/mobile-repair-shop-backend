'use strict';

/**
 * A repair's quoted cost changes as diagnosis progresses — an initial
 * "around ₹500" often becomes "₹1,500, the battery needs replacing too"
 * once the engineer opens the phone. This table keeps every quote given,
 * append-only, instead of a single number that silently overwrites itself.
 *
 * `repair_jobs.estimated_cost` is kept as a denormalized "latest quote" for
 * cheap reads (receipt, WhatsApp message, list views) — this table is the
 * full history behind it.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') };

    await queryInterface.createTable(
      'repair_estimates',
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        repair_job_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'repair_jobs', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        note: { type: Sequelize.TEXT, allowNull: true },
        created_by: {
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

    await queryInterface.addIndex('repair_estimates', ['repair_job_id', 'created_at'], {
      name: 'repair_estimates_job_created_at_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable({ tableName: 'repair_estimates', schema: 'public' });
  },
};
