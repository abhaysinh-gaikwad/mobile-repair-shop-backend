'use strict';

/**
 * The customer's name AS GIVEN for this specific repair.
 *
 * Customers are keyed by mobile number, so one number always resolves to one
 * `customers` row — but a single number is regularly shared (a family, a
 * shop's landline), and the person handing the phone over is not always the
 * person the number was first saved under. Reading the name live off
 * `customers` meant the second visitor's receipt silently printed the FIRST
 * person's name, and correcting it would have rewritten the older receipt too.
 *
 * Snapshotting the name onto the job fixes both: each receipt keeps the name
 * it was actually written for, permanently, even when reprinted years later.
 * Same reasoning as `repair_ledger.customer_name` — see that model.
 *
 * Backfilled from `customers.name` so every existing receipt reprints exactly
 * as it did before this column existed.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      { tableName: 'repair_jobs', schema: 'public' },
      'customer_name',
      { type: Sequelize.STRING(120), allowNull: true },
    );

    await queryInterface.sequelize.query(`
      UPDATE public.repair_jobs AS j
         SET customer_name = c.name
        FROM public.customers AS c
       WHERE c.id = j.customer_id
         AND j.customer_name IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn({ tableName: 'repair_jobs', schema: 'public' }, 'customer_name');
  },
};
