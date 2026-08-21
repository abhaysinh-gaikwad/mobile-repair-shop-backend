import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

/**
 * The shop is in India and the owner thinks in local time — a "today's
 * collection" figure must mean today in Asia/Kolkata, not UTC.
 */
export const SHOP_TIMEZONE = 'Asia/Kolkata';

/** Current time in the shop's timezone. */
export const shopNow = () => dayjs().tz(SHOP_TIMEZONE);

/** Start/end of a given day (or today) in the shop's timezone, as UTC Dates. */
export const shopDayRange = (date) => {
  const day = date ? dayjs.tz(date, SHOP_TIMEZONE) : shopNow();
  return {
    start: day.startOf('day').toDate(),
    end: day.endOf('day').toDate(),
  };
};

/**
 * Named date ranges for the Reports screen.
 *
 * All boundaries are computed in the SHOP's timezone and returned as UTC
 * Dates, so "This Month" means the shop's calendar month rather than UTC's.
 */
export const DATE_PRESETS = Object.freeze({
  TODAY: 'TODAY',
  YESTERDAY: 'YESTERDAY',
  THIS_WEEK: 'THIS_WEEK',
  LAST_WEEK: 'LAST_WEEK',
  THIS_MONTH: 'THIS_MONTH',
  LAST_MONTH: 'LAST_MONTH',
  THIS_YEAR: 'THIS_YEAR',
  LAST_YEAR: 'LAST_YEAR',
  ALL_TIME: 'ALL_TIME',
  CUSTOM: 'CUSTOM',
});

/**
 * Resolve a preset (or an explicit from/to pair) into { start, end }.
 * Returns nulls for ALL_TIME so callers can skip date filtering entirely.
 */
export function resolveDateRange({ preset, dateFrom, dateTo } = {}) {
  const now = shopNow();

  const range = (from, to) => ({ start: from.startOf('day').toDate(), end: to.endOf('day').toDate() });

  switch (preset) {
    case DATE_PRESETS.TODAY:
      return range(now, now);
    case DATE_PRESETS.YESTERDAY: {
      const yesterday = now.subtract(1, 'day');
      return range(yesterday, yesterday);
    }
    case DATE_PRESETS.THIS_WEEK:
      return range(now.startOf('week'), now.endOf('week'));
    case DATE_PRESETS.LAST_WEEK: {
      const lastWeek = now.subtract(1, 'week');
      return range(lastWeek.startOf('week'), lastWeek.endOf('week'));
    }
    case DATE_PRESETS.THIS_MONTH:
      return range(now.startOf('month'), now.endOf('month'));
    case DATE_PRESETS.LAST_MONTH: {
      const lastMonth = now.subtract(1, 'month');
      return range(lastMonth.startOf('month'), lastMonth.endOf('month'));
    }
    case DATE_PRESETS.THIS_YEAR:
      return range(now.startOf('year'), now.endOf('year'));
    case DATE_PRESETS.LAST_YEAR: {
      const lastYear = now.subtract(1, 'year');
      return range(lastYear.startOf('year'), lastYear.endOf('year'));
    }
    case DATE_PRESETS.ALL_TIME:
      return { start: null, end: null };
    default: {
      // CUSTOM, or no preset at all: use whatever explicit dates were given.
      if (!dateFrom && !dateTo) return { start: null, end: null };
      const from = dateFrom ? dayjs.tz(dateFrom, SHOP_TIMEZONE) : null;
      const to = dateTo ? dayjs.tz(dateTo, SHOP_TIMEZONE) : null;
      return {
        start: from ? from.startOf('day').toDate() : null,
        end: to ? to.endOf('day').toDate() : null,
      };
    }
  }
}

export { dayjs };
export default dayjs;
