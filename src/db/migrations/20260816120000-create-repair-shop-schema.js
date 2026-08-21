'use strict';

/**
 * Initial schema for the Mobile Repair Shop Management System.
 *
 * Tables are created in FK-dependency order. Two Postgres SEQUENCES back the
 * two human-facing numbers (receipt numbers and cash-memo entry numbers) —
 * `nextval` is atomic, so concurrent inserts can never collide. A failed
 * insert burns a number, leaving a gap; that is the deliberate trade-off,
 * because a duplicated receipt number on a customer document is far worse
 * than a missing one.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') };
    const timestamps = { created_at: { ...now }, updated_at: { ...now } };

    // ---------------------------------------------------------------- admin
    await queryInterface.createTable(
      'admin_users',
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: Sequelize.STRING(120), allowNull: false },
        email: { type: Sequelize.STRING(160), allowNull: false, unique: true },
        password: { type: Sequelize.STRING(255), allowNull: false },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        last_login_at: { type: Sequelize.DATE, allowNull: true },
        ...timestamps,
      },
      { schema: 'public' },
    );

    // ------------------------------------------------------- staff / lookups
    await queryInterface.createTable(
      'engineers',
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: Sequelize.STRING(120), allowNull: false },
        mobile: { type: Sequelize.STRING(20), allowNull: true },
        specialization: { type: Sequelize.STRING(120), allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        ...timestamps,
      },
      { schema: 'public' },
    );
    await queryInterface.addIndex('engineers', ['is_active'], { name: 'engineers_is_active_idx' });

    await queryInterface.createTable(
      'lead_handlers',
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: Sequelize.STRING(120), allowNull: false },
        mobile: { type: Sequelize.STRING(20), allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        ...timestamps,
      },
      { schema: 'public' },
    );
    await queryInterface.addIndex('lead_handlers', ['is_active'], { name: 'lead_handlers_is_active_idx' });

    await queryInterface.createTable(
      'lead_sources',
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: Sequelize.STRING(60), allowNull: false, unique: true },
        display_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        ...timestamps,
      },
      { schema: 'public' },
    );
    await queryInterface.addIndex('lead_sources', ['is_active'], { name: 'lead_sources_is_active_idx' });

    // ------------------------------------------------------------ customers
    await queryInterface.createTable(
      'customers',
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: Sequelize.STRING(120), allowNull: false },
        mobile: { type: Sequelize.STRING(20), allowNull: false, unique: true },
        alternate_mobile: { type: Sequelize.STRING(20), allowNull: true },
        address: { type: Sequelize.TEXT, allowNull: true },
        lead_source: { type: Sequelize.STRING(60), allowNull: true },
        lead_handler_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'lead_handlers', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        first_visit_at: { type: Sequelize.DATE, allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        ...timestamps,
      },
      { schema: 'public' },
    );
    await queryInterface.addIndex('customers', ['mobile'], { name: 'customers_mobile_idx' });
    await queryInterface.addIndex('customers', ['name'], { name: 'customers_name_idx' });

    // ----------------------------------------------------------- repair jobs
    await queryInterface.createTable(
      'repair_jobs',
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        receipt_number: { type: Sequelize.STRING(20), allowNull: false, unique: true },
        customer_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'customers', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        engineer_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'engineers', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        lead_source: { type: Sequelize.STRING(60), allowNull: true },
        lead_handler_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'lead_handlers', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        lead_at: { type: Sequelize.DATE, allowNull: true },

        brand: { type: Sequelize.STRING(60), allowNull: false },
        model_number: { type: Sequelize.STRING(120), allowNull: false },
        imei: { type: Sequelize.STRING(30), allowNull: true },

        has_sim_card: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        has_memory_card: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        has_battery: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        has_charger: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        other_accessories: { type: Sequelize.STRING(255), allowNull: true },

        customer_complaint: { type: Sequelize.TEXT, allowNull: false },
        diagnosis: { type: Sequelize.TEXT, allowNull: true },
        repair_details: { type: Sequelize.TEXT, allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },

        status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'RECEIVED' },

        estimated_cost: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        labour_charge: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        total_amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },

        received_at: { ...now },
        delivered_at: { type: Sequelize.DATE, allowNull: true },

        created_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'admin_users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        ...timestamps,
      },
      { schema: 'public' },
    );
    await queryInterface.addIndex('repair_jobs', ['customer_id'], { name: 'repair_jobs_customer_id_idx' });
    await queryInterface.addIndex('repair_jobs', ['engineer_id'], { name: 'repair_jobs_engineer_id_idx' });
    await queryInterface.addIndex('repair_jobs', ['status'], { name: 'repair_jobs_status_idx' });
    await queryInterface.addIndex('repair_jobs', ['imei'], { name: 'repair_jobs_imei_idx' });
    await queryInterface.addIndex('repair_jobs', ['received_at'], { name: 'repair_jobs_received_at_idx' });
    await queryInterface.addIndex('repair_jobs', ['lead_source'], { name: 'repair_jobs_lead_source_idx' });

    // ----------------------------------------------------------------- parts
    await queryInterface.createTable(
      'repair_parts',
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        repair_job_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'repair_jobs', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        part_name: { type: Sequelize.STRING(160), allowNull: false },
        quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        unit_price: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        total_price: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        notes: { type: Sequelize.TEXT, allowNull: true },
        ...timestamps,
      },
      { schema: 'public' },
    );
    await queryInterface.addIndex('repair_parts', ['repair_job_id'], { name: 'repair_parts_repair_job_id_idx' });

    // ---------------------------------------------------------------- ledger
    // The money table. Append-only: no updated_at column, and no UPDATE or
    // DELETE route exists. Corrections are posted as REVERSAL rows carrying a
    // negative amount, so SUM(amount) is always the truth.
    await queryInterface.createTable(
      'repair_ledger',
      {
        id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
        entry_no: { type: Sequelize.STRING(20), allowNull: false, unique: true },
        repair_job_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'repair_jobs', key: 'id' },
          onUpdate: 'CASCADE',
          // A job that carries money can never be deleted.
          onDelete: 'RESTRICT',
        },
        receipt_number: { type: Sequelize.STRING(20), allowNull: false },
        customer_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'customers', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        customer_name: { type: Sequelize.STRING(120), allowNull: false },
        customer_mobile: { type: Sequelize.STRING(20), allowNull: true },

        entry_type: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'PAYMENT' },
        payment_type: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'ADVANCE' },
        payment_method: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'CASH' },

        amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        job_total_after: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        job_paid_after: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        job_balance_after: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },

        reverses_entry_id: {
          type: Sequelize.BIGINT,
          allowNull: true,
          references: { model: 'repair_ledger', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        reversal_reason: { type: Sequelize.TEXT, allowNull: true },
        note: { type: Sequelize.TEXT, allowNull: true },

        paid_at: { ...now },
        received_by: {
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
    await queryInterface.addIndex('repair_ledger', ['repair_job_id'], { name: 'repair_ledger_repair_job_id_idx' });
    await queryInterface.addIndex('repair_ledger', ['paid_at'], { name: 'repair_ledger_paid_at_idx' });
    await queryInterface.addIndex('repair_ledger', ['payment_method'], { name: 'repair_ledger_payment_method_idx' });
    await queryInterface.addIndex('repair_ledger', ['customer_id'], { name: 'repair_ledger_customer_id_idx' });
    await queryInterface.addIndex('repair_ledger', ['entry_type'], { name: 'repair_ledger_entry_type_idx' });

    // An entry may be reversed at most once. A partial unique index is the
    // database-level guarantee behind the service's already-reversed check.
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX repair_ledger_one_reversal_per_entry_idx
         ON public.repair_ledger (reverses_entry_id)
       WHERE reverses_entry_id IS NOT NULL;`,
    );

    // ------------------------------------------------------------- call logs
    await queryInterface.createTable(
      'repair_call_logs',
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        repair_job_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'repair_jobs', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        called_at: { ...now },
        called_by: { type: Sequelize.STRING(120), allowNull: false },
        communication: { type: Sequelize.TEXT, allowNull: false },
        next_action: { type: Sequelize.TEXT, allowNull: true },
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
    await queryInterface.addIndex('repair_call_logs', ['repair_job_id', 'called_at'], {
      name: 'repair_call_logs_job_called_at_idx',
    });

    // -------------------------------------------------------- status history
    await queryInterface.createTable(
      'repair_status_history',
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        repair_job_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'repair_jobs', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        from_status: { type: Sequelize.STRING(30), allowNull: true },
        to_status: { type: Sequelize.STRING(30), allowNull: false },
        note: { type: Sequelize.TEXT, allowNull: true },
        changed_by: {
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
    await queryInterface.addIndex('repair_status_history', ['repair_job_id'], {
      name: 'repair_status_history_repair_job_id_idx',
    });

    // -------------------------------------------------------------- settings
    await queryInterface.createTable(
      'shop_settings',
      {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        key: { type: Sequelize.STRING(150), allowNull: false, unique: true },
        value: { type: Sequelize.TEXT, allowNull: true },
        description: { type: Sequelize.STRING(255), allowNull: true },
        updated_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'admin_users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        ...timestamps,
      },
      { schema: 'public' },
    );

    // ------------------------------------------------------------- sequences
    // Receipt numbers start at 1 (R-00001) per the shop owner's decision.
    await queryInterface.sequelize.query(
      `CREATE SEQUENCE IF NOT EXISTS public.repair_receipt_number_seq START WITH 1 INCREMENT BY 1;`,
    );
    await queryInterface.sequelize.query(
      `CREATE SEQUENCE IF NOT EXISTS public.repair_ledger_entry_no_seq START WITH 1 INCREMENT BY 1;`,
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP SEQUENCE IF EXISTS public.repair_ledger_entry_no_seq;');
    await queryInterface.sequelize.query('DROP SEQUENCE IF EXISTS public.repair_receipt_number_seq;');

    // Reverse dependency order.
    await queryInterface.dropTable('shop_settings', { schema: 'public' });
    await queryInterface.dropTable('repair_status_history', { schema: 'public' });
    await queryInterface.dropTable('repair_call_logs', { schema: 'public' });
    await queryInterface.dropTable('repair_ledger', { schema: 'public' });
    await queryInterface.dropTable('repair_parts', { schema: 'public' });
    await queryInterface.dropTable('repair_jobs', { schema: 'public' });
    await queryInterface.dropTable('customers', { schema: 'public' });
    await queryInterface.dropTable('lead_sources', { schema: 'public' });
    await queryInterface.dropTable('lead_handlers', { schema: 'public' });
    await queryInterface.dropTable('engineers', { schema: 'public' });
    await queryInterface.dropTable('admin_users', { schema: 'public' });
  },
};
