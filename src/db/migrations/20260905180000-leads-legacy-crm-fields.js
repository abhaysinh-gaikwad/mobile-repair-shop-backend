'use strict';

/**
 * The columns the shop's own CRM spreadsheet actually keeps, which the first
 * leads table did not have.
 *
 * Taken from the real sheet (3,421 enquiries, Feb–Sep 2026) rather than
 * guessed: LOCATION and T. RATE are filled in on thousands of rows and are
 * what the telecallers sort and quote by, so leaving them out would have meant
 * importing the data into a shape that lost half its meaning.
 */
const TABLE = { tableName: 'leads', schema: 'public' };

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;

    await sequelize.transaction(async (transaction) => {
      // Where the customer is. Thousands of rows carry it, and "is this
      // person even near the shop" is the first thing a telecaller checks —
      // hence their OUT_OF_LOCATION status.
      await queryInterface.addColumn(
        TABLE,
        'location',
        { type: Sequelize.STRING(120), allowNull: true },
        { transaction },
      );

      /**
       * The price quoted, as TEXT.
       *
       * Deliberately not numeric. Real values look like "6500/-/ 9200" and
       * "1050/- / 2500/-" — two prices for two grades of part, which is how
       * this shop quotes. Forcing that into DECIMAL would destroy the second
       * number and silently misstate what the customer was told.
       */
      await queryInterface.addColumn(
        TABLE,
        'quoted_rate',
        { type: Sequelize.STRING(120), allowNull: true },
        { transaction },
      );

      // When the enquiry came in, and when it was last called. Distinct from
      // created_at, which for imported rows is simply when the import ran.
      await queryInterface.addColumn(TABLE, 'enquiry_date', { type: Sequelize.DATEONLY, allowNull: true }, { transaction });
      await queryInterface.addColumn(TABLE, 'last_call_date', { type: Sequelize.DATEONLY, allowNull: true }, { transaction });

      // The telecaller's own "call them again on" date — the closest thing
      // the sheet has to a task list.
      await queryInterface.addColumn(TABLE, 'next_action_date', { type: Sequelize.DATEONLY, allowNull: true }, { transaction });

      /**
       * Which ROW of the shop's spreadsheet this lead came from.
       *
       * The row number, not their SR.NO column: SR.NO is filled in on only 6
       * of 3,421 rows, so it cannot identify a row on re-import. The row
       * number is always present and unique, which is what makes the import
       * idempotent — re-running it updates rather than duplicating.
       */
      await queryInterface.addColumn(TABLE, 'legacy_row_no', { type: Sequelize.INTEGER, allowNull: true }, { transaction });

      await queryInterface.addIndex(TABLE, ['legacy_row_no'], { transaction });
      await queryInterface.addIndex(TABLE, ['next_action_date'], { transaction });
      await queryInterface.addIndex(TABLE, ['enquiry_date'], { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      for (const column of ['legacy_row_no', 'next_action_date', 'last_call_date', 'enquiry_date', 'quoted_rate', 'location']) {
        await queryInterface.removeColumn(TABLE, column, { transaction });
      }
    });
  },
};
