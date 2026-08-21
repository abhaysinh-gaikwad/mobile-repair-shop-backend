'use strict';

/**
 * The shop's actual lead channels.
 *
 * Sources the shop does not use are DEACTIVATED rather than deleted: repair
 * jobs snapshot the source name as text, so removing rows here would not
 * corrupt history — but keeping them lets an old value still resolve in the
 * dropdown if it is ever re-enabled.
 */
const KEEP = ['Reels', 'Facebook', 'Telecaller', 'Walking'];

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    for (const [index, name] of KEEP.entries()) {
      await queryInterface.sequelize.query(
        `INSERT INTO public.lead_sources (name, display_order, is_active, created_at, updated_at)
         VALUES (:name, :order, true, :now, :now)
         ON CONFLICT (name) DO UPDATE SET is_active = true, display_order = :order, updated_at = :now;`,
        { replacements: { name, order: index, now } },
      );
    }

    // Everything else is hidden from the dropdown but left on record.
    await queryInterface.sequelize.query(
      `UPDATE public.lead_sources SET is_active = false, updated_at = :now WHERE name NOT IN (:keep);`,
      { replacements: { now, keep: KEEP } },
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('UPDATE public.lead_sources SET is_active = true;');
  },
};
