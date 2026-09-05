'use strict';

const bcrypt = require('bcrypt');

/**
 * CRM leads + real telecaller accounts + RBAC + Round Robin state.
 *
 * Three things happen here, in order, and the order matters:
 *
 *  1. `admin_users` grows the columns RBAC needs, and the OLD role values are
 *     rewritten in place (OWNER -> SUPER_ADMIN, STAFF -> TELECALLER). Nobody
 *     gains or loses access: SUPER_ADMIN holds every permission exactly as
 *     OWNER did, and the only thing STAFF was ever denied (Rate Card writes)
 *     is still denied to TELECALLER by its default permissions.
 *
 *  2. Existing `lead_handlers` rows are turned into real login accounts. The
 *     table is NOT dropped — repair_jobs and customers still carry
 *     lead_handler_id foreign keys, and rewriting that history would be a
 *     much bigger and riskier change than this feature needs. Instead each
 *     new user records where it came from via `admin_users.lead_handler_id`,
 *     so old repair jobs and new leads can be reconciled to one person.
 *
 *  3. The CRM tables themselves.
 *
 * Migrated accounts get a random, unusable password: nobody can log in as
 * them until the Super Admin sets a real one from User Management. That is
 * deliberate — silently creating logins with a guessable shared password
 * would be a genuine security hole.
 */

const TABLE = (name) => ({ tableName: name, schema: 'public' });

const timestamps = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
  updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
});

const adminUserRef = (Sequelize, onDelete = 'SET NULL') => ({
  type: Sequelize.INTEGER,
  allowNull: true,
  references: { model: TABLE('admin_users'), key: 'id' },
  onUpdate: 'CASCADE',
  onDelete,
});

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;

    await sequelize.transaction(async (transaction) => {
      // ---------------------------------------------------------- 1. RBAC
      // STRING(10) could not hold 'SUPER_ADMIN' (11 chars) — widen BEFORE
      // writing any of the new values, or the UPDATE below fails.
      await queryInterface.changeColumn(
        TABLE('admin_users'),
        'role',
        { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'TELECALLER' },
        { transaction },
      );

      await sequelize.query(
        `UPDATE public.admin_users SET role = CASE role
           WHEN 'OWNER' THEN 'SUPER_ADMIN'
           WHEN 'STAFF' THEN 'TELECALLER'
           ELSE role END`,
        { transaction },
      );

      await queryInterface.addColumn(
        TABLE('admin_users'),
        'mobile',
        { type: Sequelize.STRING(20), allowNull: true },
        { transaction },
      );

      // Per-user overrides as { grant: [...], revoke: [...] }. JSONB (not a
      // join table) because this is a small, whole-value document that is
      // always read and written together, never queried across users.
      await queryInterface.addColumn(
        TABLE('admin_users'),
        'permissions',
        { type: Sequelize.JSONB, allowNull: false, defaultValue: { grant: [], revoke: [] } },
        { transaction },
      );

      // Round Robin eligibility — see STAFF_AVAILABILITY for why this is
      // separate from is_active.
      await queryInterface.addColumn(
        TABLE('admin_users'),
        'availability',
        { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'AVAILABLE' },
        { transaction },
      );

      await queryInterface.addColumn(
        TABLE('admin_users'),
        'lead_handler_id',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: TABLE('lead_handlers'), key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        { transaction },
      );

      // ------------------------------- 2. lead_handlers -> real user accounts
      const [handlers] = await sequelize.query(
        'SELECT id, name, mobile, is_active FROM public.lead_handlers ORDER BY id ASC',
        { transaction },
      );

      for (const handler of handlers) {
        // Random 32-byte password nobody knows or can guess — the account
        // exists and can be assigned leads, but cannot be signed into until
        // the Super Admin sets a real password.
        const unusablePassword = await bcrypt.hash(`${Date.now()}-${Math.random()}-${handler.id}`, 10);

        // Deterministic placeholder address so re-running against a partly
        // migrated database cannot create duplicates (the unique index on
        // email rejects the second attempt rather than silently doubling
        // somebody up).
        const email = `telecaller${handler.id}@sushantmobile.local`;

        await sequelize.query(
          `INSERT INTO public.admin_users
             (name, email, password, role, is_active, availability, permissions, mobile, lead_handler_id, created_at, updated_at)
           VALUES (:name, :email, :password, 'TELECALLER', :isActive, 'AVAILABLE', :permissions, :mobile, :leadHandlerId, NOW(), NOW())
           ON CONFLICT (email) DO NOTHING`,
          {
            transaction,
            replacements: {
              name: handler.name,
              email,
              password: unusablePassword,
              isActive: handler.is_active,
              permissions: JSON.stringify({ grant: [], revoke: [] }),
              mobile: handler.mobile,
              leadHandlerId: handler.id,
            },
          },
        );
      }

      // ------------------------------------------------------- 3. CRM tables
      await queryInterface.createTable(
        TABLE('leads'),
        {
          id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },

          customer_name: { type: Sequelize.STRING(120), allowNull: true },
          mobile: { type: Sequelize.STRING(20), allowNull: true },
          /**
           * Last 10 digits of `mobile`, written by the application.
           *
           * Duplicate detection matches on THIS, not the raw string: the same
           * person writes +91 98765 43210, 09876543210 and 9876543210, and all
           * three must resolve to one customer or Round Robin would hand the
           * same person to a different telecaller each time they message.
           */
          mobile_normalized: { type: Sequelize.STRING(10), allowNull: true },

          source: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'MANUAL' },
          enquiry: { type: Sequelize.TEXT, allowNull: true },
          brand: { type: Sequelize.STRING(60), allowNull: true },
          model_number: { type: Sequelize.STRING(80), allowNull: true },
          problem: { type: Sequelize.TEXT, allowNull: true },

          status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'NEW' },
          assigned_to: adminUserRef(Sequelize),

          // Set when the lead actually becomes a job at the counter, so the
          // CRM and the workshop are one system rather than two.
          repair_job_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: TABLE('repair_jobs'), key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          },

          notes: { type: Sequelize.TEXT, allowNull: true },
          // Bumped every time the same customer messages again, so a repeat
          // enquiry is visible without creating a second lead.
          last_contact_at: { type: Sequelize.DATE, allowNull: true },
          contact_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },

          created_by: adminUserRef(Sequelize),
          ...timestamps(Sequelize),
        },
        { transaction },
      );

      await queryInterface.addIndex(TABLE('leads'), ['mobile_normalized'], { transaction });
      await queryInterface.addIndex(TABLE('leads'), ['assigned_to'], { transaction });
      await queryInterface.addIndex(TABLE('leads'), ['status'], { transaction });
      await queryInterface.addIndex(TABLE('leads'), ['source'], { transaction });
      await queryInterface.addIndex(TABLE('leads'), ['created_at'], { transaction });

      // Append-only audit of every assignment and reassignment.
      await queryInterface.createTable(
        TABLE('lead_assignments'),
        {
          id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
          lead_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: TABLE('leads'), key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          from_admin_user_id: adminUserRef(Sequelize),
          to_admin_user_id: adminUserRef(Sequelize),
          // ROUND_ROBIN | STICKY | MANUAL — how this assignment was decided.
          reason: { type: Sequelize.STRING(20), allowNull: false },
          changed_by: adminUserRef(Sequelize),
          note: { type: Sequelize.TEXT, allowNull: true },
          ...timestamps(Sequelize),
        },
        { transaction },
      );

      await queryInterface.addIndex(TABLE('lead_assignments'), ['lead_id'], { transaction });

      /**
       * Round Robin cursor — exactly ONE row, id = 1.
       *
       * A table rather than an in-memory counter so the rotation survives
       * restarts and is shared by both backend containers. The assignment
       * service takes a row-level lock on it (SELECT ... FOR UPDATE) so two
       * simultaneous leads cannot read the same cursor and land on the same
       * telecaller.
       */
      await queryInterface.createTable(
        TABLE('round_robin_state'),
        {
          id: { type: Sequelize.INTEGER, primaryKey: true },
          last_assigned_admin_user_id: adminUserRef(Sequelize),
          ...timestamps(Sequelize),
        },
        { transaction },
      );

      await sequelize.query(
        `INSERT INTO public.round_robin_state (id, last_assigned_admin_user_id, created_at, updated_at)
         VALUES (1, NULL, NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
        { transaction },
      );
    });
  },

  async down(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;

    await sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable(TABLE('round_robin_state'), { transaction });
      await queryInterface.dropTable(TABLE('lead_assignments'), { transaction });
      await queryInterface.dropTable(TABLE('leads'), { transaction });

      // Only the accounts THIS migration created — a hand-made telecaller
      // must not be swept away by a rollback.
      await sequelize.query('DELETE FROM public.admin_users WHERE lead_handler_id IS NOT NULL', { transaction });

      for (const column of ['lead_handler_id', 'availability', 'permissions', 'mobile']) {
        await queryInterface.removeColumn(TABLE('admin_users'), column, { transaction });
      }

      await sequelize.query(
        `UPDATE public.admin_users SET role = CASE role
           WHEN 'SUPER_ADMIN' THEN 'OWNER'
           WHEN 'TELECALLER' THEN 'STAFF'
           ELSE 'OWNER' END`,
        { transaction },
      );

      await queryInterface.changeColumn(
        TABLE('admin_users'),
        'role',
        { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'OWNER' },
        { transaction },
      );
    });
  },
};
