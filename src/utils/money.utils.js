/**
 * Money helpers.
 *
 * Amounts are DECIMAL(10,2) in Postgres, which the `pg` driver hands back as
 * STRINGS to avoid float precision loss. Every read path must therefore run
 * values through `toAmount()` rather than using them raw — `"600.00" + 250`
 * silently produces the string "600.00250" in JavaScript, which is exactly the
 * class of bug this module exists to prevent.
 *
 * All arithmetic is done in paise (integers) and converted back at the end.
 */

/** Parse a DECIMAL column (string | number | null) into a JS number. */
export const toAmount = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Round to 2dp via integer paise, avoiding float drift. */
export const round2 = (value) => Math.round((toAmount(value) + Number.EPSILON) * 100) / 100;

/** Sum any mix of strings/numbers safely. */
export const sumAmounts = (values = []) => round2(values.reduce((total, value) => total + toAmount(value), 0));

/** Multiply a unit price by a quantity safely (integer paise internally). */
export const multiplyAmount = (unitPrice, quantity) => round2((toAmount(unitPrice) * 100 * Number(quantity)) / 100);

/** a - b, rounded. */
export const subtractAmounts = (a, b) => round2(toAmount(a) - toAmount(b));

/** Format for display/logging, e.g. 1350 -> "₹1,350.00". */
export const formatRupees = (value) =>
  `₹${toAmount(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
