import { Op } from 'sequelize';

/**
 * Apply an inclusive date range to a `where` clause.
 * Mutates and returns `where` for convenient chaining.
 */
export function applyDateRangeFilter(where, field, from, to) {
  if (!from && !to) return where;

  if (from && to) {
    where[field] = { [Op.between]: [new Date(from), new Date(to)] };
  } else if (from) {
    where[field] = { [Op.gte]: new Date(from) };
  } else {
    where[field] = { [Op.lte]: new Date(to) };
  }

  return where;
}

/** Case-insensitive partial match across several columns. */
export function buildSearchClause(fields, term) {
  if (!term) return null;
  const like = { [Op.iLike]: `%${term.trim()}%` };
  return { [Op.or]: fields.map((field) => ({ [field]: like })) };
}
