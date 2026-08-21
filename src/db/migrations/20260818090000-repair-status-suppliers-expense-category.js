'use strict';

/**
 * Three independent changes bundled into one migration since they ship
 * together:
 *
 *  1. Repair status pipeline replaced with the shop's actual workflow
 *     (PENDING → QUOTATION_GIVEN → CUSTOMER_APPROVAL → OUTDOOR_OUT/IN →
 *     IN_REPAIR → JOB_DONE → DELIVERED). Existing rows are remapped to the
 *     closest new status — never dropped or left dangling.
 *
 *  2. `shop_expenses` gains `category` (Material / Loss / Other, for the
 *     Reports filter) and `supplier_id` (optional link to a registered
 *     supplier).
 *
 *  3. New `suppliers` table — simple registry, no procurement/inventory
 *     system: just who the shop buys parts from.
 *
 * @type {import('sequelize-cli').Migration}
 */

// Old status -> new status. Every old value must appear exactly once.
const STATUS_REMAP = {
  RECEIVED: 'PENDING',
  ASSIGNED: 'PENDING',
  DIAGNOSING: 'PENDING',
  WAITING_FOR_APPROVAL: 'CUSTOMER_APPROVAL',
  WAITING_FOR_PART: 'OUTDOOR_OUT',
  IN_REPAIR: 'IN_REPAIR',
  READY_FOR_PICKUP: 'JOB_DONE',
  DELIVERED: 'DELIVERED',
  // No equivalent in the new pipeline. Folded into PENDING rather than left
  // as an orphaned value the UI can no longer select or display meaningfully.
  CANCELLED: 'PENDING',
};

module.exports = {
  async up(queryInterface, Sequelize) {
    // ---- 1. Repair status remap ----
    for (const [oldStatus, newStatus] of Object.entries(STATUS_REMAP)) {
      await queryInterface.sequelize.query(
        'UPDATE public.repair_jobs SET status = :newStatus WHERE status = :oldStatus',
        { replacements: { oldStatus, newStatus } },
      );
      await queryInterface.sequelize.query(
        'UPDATE public.repair_status_history SET to_status = :newStatus WHERE to_status = :oldStatus',
        { replacements: { oldStatus, newStatus } },
      );
      await queryInterface.sequelize.query(
        'UPDATE public.repair_status_history SET from_status = :newStatus WHERE from_status = :oldStatus',
        { replacements: { oldStatus, newStatus } },
      );
    }

    await queryInterface.changeColumn(
      { tableName: 'repair_jobs', schema: 'public' },
      'status',
      { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'PENDING' },
    );

    // ---- 2. Suppliers ----
    await queryInterface.createTable(
      'suppliers',
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: Sequelize.STRING(120), allowNull: false, unique: true },
        mobile: { type: Sequelize.STRING(20), allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      },
      { schema: 'public' },
    );
    await queryInterface.addIndex('suppliers', ['is_active'], { name: 'suppliers_is_active_idx' });

    // ---- 3. shop_expenses: category + supplier link ----
    await queryInterface.addColumn(
      { tableName: 'shop_expenses', schema: 'public' },
      'category',
      { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'MATERIAL' },
    );
    await queryInterface.addColumn(
      { tableName: 'shop_expenses', schema: 'public' },
      'supplier_id',
      {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'suppliers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
    );
    await queryInterface.addIndex('shop_expenses', ['category'], { name: 'shop_expenses_category_idx' });
    await queryInterface.addIndex('shop_expenses', ['supplier_id'], { name: 'shop_expenses_supplier_id_idx' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('shop_expenses', 'shop_expenses_supplier_id_idx');
    await queryInterface.removeIndex('shop_expenses', 'shop_expenses_category_idx');
    await queryInterface.removeColumn({ tableName: 'shop_expenses', schema: 'public' }, 'supplier_id');
    await queryInterface.removeColumn({ tableName: 'shop_expenses', schema: 'public' }, 'category');

    await queryInterface.dropTable('suppliers', { schema: 'public' });

    await queryInterface.changeColumn(
      { tableName: 'repair_jobs', schema: 'public' },
      'status',
      { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'RECEIVED' },
    );

    // Best-effort reverse remap (lossy: several old statuses collapsed onto
    // PENDING and cannot be told apart again — restores DELIVERED/IN_REPAIR/
    // CUSTOMER_APPROVAL/JOB_DONE precisely, everything else becomes RECEIVED).
    const REVERSE = {
      CUSTOMER_APPROVAL: 'WAITING_FOR_APPROVAL',
      OUTDOOR_OUT: 'WAITING_FOR_PART',
      OUTDOOR_IN: 'WAITING_FOR_PART',
      IN_REPAIR: 'IN_REPAIR',
      JOB_DONE: 'READY_FOR_PICKUP',
      DELIVERED: 'DELIVERED',
      QUOTATION_GIVEN: 'RECEIVED',
      PENDING: 'RECEIVED',
    };
    for (const [newStatus, oldStatus] of Object.entries(REVERSE)) {
      await queryInterface.sequelize.query(
        'UPDATE public.repair_jobs SET status = :oldStatus WHERE status = :newStatus',
        { replacements: { oldStatus, newStatus } },
      );
    }
  },
};
