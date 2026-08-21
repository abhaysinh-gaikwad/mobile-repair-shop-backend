import _ from 'lodash';

import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';

/**
 * Send a successful response in the shared envelope.
 *
 * NOTE: an empty/falsy `data` is treated as a bug, not as success — every
 * service must return something, at minimum `getSuccessResponse('...')`.
 */
export const sendResponse = ({ res, next }, data) => {
  if (data && !_.isEmpty(data)) {
    res.status(200).json({ data, errors: [] });
  } else {
    next(new AppError(Errors.INTERNAL_ERROR));
  }
};

export const getSuccessResponse = (message) => ({ message, status: true });

export const getPagination = (page = 1, limit = 20) => ({
  page,
  limit,
  offset: (page - 1) * limit,
});

export function getPaginationResponse({ totalCount, page, limit, count }) {
  return {
    count,
    totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit) || 0,
    hasPreviousPage: page > 1 && (totalCount > 0 || count > 0),
    hasNextPage: totalCount > page * limit,
  };
}
