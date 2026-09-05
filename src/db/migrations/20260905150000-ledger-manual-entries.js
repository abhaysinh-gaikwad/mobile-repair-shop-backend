'use strict';

/**
 * Let the Cash Memo hold money that is NOT tied to a repair receipt.
 *
 * Two real cases the shop has: a customer pays for something with no repair
 * job behind it, and the pile of older paper records from before this
 * software existed — many of which have no receipt number at all.
 *
 * The important decision here is that these are ordinary `repair_ledger`
 * rows, NOT a second table. The Cash Memo, the daily collection, the cash
 * drawer and every report are pure `SUM(amount)` queries over this one table,
 * so a manual entry is counted correctly everywhere the moment it is written,
 * with no reporting code changed and no risk of two sets of books disagreeing.
 * `shop_expenses` (money OUT) already works exactly this way — its
 * `repair_job_id` has always been nullable — so this makes money IN
 * consistent with money OUT rather than inventing a new pattern.
 *
 * Append-only is UNCHANGED: manual entries have no UPDATE and no DELETE
 * either, and are corrected by the same negative-amount reversal.
 */
const TABLE = { tableName: 'repair_ledger', schema: 'public' };

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;

    await sequelize.transaction(async (transaction) => {
      // Discriminator. Added FIRST and with a default, so every existing row
      // is correctly labelled REPAIR_JOB before anything is relaxed below —
      // there is no window in which a row's kind is ambiguous.
      await queryInterface.addColumn(
        TABLE,
        'source',
        { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'REPAIR_JOB' },
        { transaction },
      );

      // What the money was for, when there is no repair job to explain it.
      await queryInterface.addColumn(TABLE, 'description', { type: Sequelize.TEXT, allowNull: true }, { transaction });

      // The shop's own paper receipt number / bill number / any other pointer
      // to the original record. Deliberately NOT `receipt_number`: that column
      // means "a receipt number this system generated", and conflating a
      // handwritten reference with a real receipt would break the link between
      // the ledger and repair_jobs.
      await queryInterface.addColumn(
        TABLE,
        'reference',
        { type: Sequelize.STRING(60), allowNull: true },
        { transaction },
      );

      // ---- Relax the columns that assumed every payment has a job ----
      //
      // Raw ALTER, not queryInterface.changeColumn(). changeColumn() on a
      // column that carries a `references` option does NOT emit DROP NOT NULL
      // on Postgres — it silently leaves the constraint in place, which was
      // caught here only because the CHECK-constraint test then failed with
      // "null value in column repair_job_id violates not-null constraint".
      // A plain ALTER does exactly one thing and leaves the existing foreign
      // key untouched, which is what we actually want.
      await sequelize.query(
        `ALTER TABLE public.repair_ledger
           ALTER COLUMN repair_job_id DROP NOT NULL,
           ALTER COLUMN receipt_number DROP NOT NULL,
           -- An old paper record often has no name recorded at all.
           ALTER COLUMN customer_name DROP NOT NULL`,
        { transaction },
      );

      /**
       * The database, not the application, is what guarantees the two kinds of
       * row can never blur into each other:
       *
       *   REPAIR_JOB — must carry BOTH a job id and a receipt number, exactly
       *                as every existing row does today.
       *   MANUAL     — must carry NEITHER. A manual entry that quietly picked
       *                up a job id would corrupt that job's balance, since
       *                getRepairMoneySummary() sums by repair_job_id.
       *
       * Written as one CHECK so relaxing allowNull above cannot accidentally
       * let a malformed row in through some future code path.
       */
      await sequelize.query(
        `ALTER TABLE public.repair_ledger
           ADD CONSTRAINT repair_ledger_source_shape_chk CHECK (
             (source = 'REPAIR_JOB' AND repair_job_id IS NOT NULL AND receipt_number IS NOT NULL)
             OR
             (source = 'MANUAL' AND repair_job_id IS NULL AND receipt_number IS NULL)
           )`,
        { transaction },
      );

      await queryInterface.addIndex(TABLE, ['source'], { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;

    await sequelize.transaction(async (transaction) => {
      // Manual entries cannot exist under the old shape — they have no job to
      // point at. Removing them is the only possible rollback, so it is done
      // explicitly and loudly rather than letting the NOT NULL restore fail.
      await sequelize.query("DELETE FROM public.repair_ledger WHERE source = 'MANUAL'", { transaction });

      await sequelize.query(
        'ALTER TABLE public.repair_ledger DROP CONSTRAINT IF EXISTS repair_ledger_source_shape_chk',
        { transaction },
      );

      await queryInterface.removeIndex(TABLE, ['source'], { transaction });

      // Raw ALTER for the same reason as up().
      await sequelize.query(
        `ALTER TABLE public.repair_ledger
           ALTER COLUMN customer_name SET NOT NULL,
           ALTER COLUMN receipt_number SET NOT NULL,
           ALTER COLUMN repair_job_id SET NOT NULL`,
        { transaction },
      );

      for (const column of ['reference', 'description', 'source']) {
        await queryInterface.removeColumn(TABLE, column, { transaction });
      }
    });
  },
};
