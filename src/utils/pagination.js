/**
 * Pagination utilities
 * Enforces safe limit and offset handling for query params.
 */

const parsePagination = (req, defaultLimit = 20, maxLimit = 100) => {
  const page = Number.isNaN(parseInt(req.query.page, 10)) ? 1 : parseInt(req.query.page, 10);
  const offset = Number.isNaN(parseInt(req.query.offset, 10)) ? 0 : parseInt(req.query.offset, 10);
  let limit = Number.isNaN(parseInt(req.query.limit, 10)) ? defaultLimit : parseInt(req.query.limit, 10);

  const safePage = page > 0 ? page : 1;
  const safeOffset = offset >= 0 ? offset : 0;
  limit = limit > 0 ? limit : defaultLimit;
  limit = Math.min(limit, maxLimit);

  return {
    limit,
    offset: safeOffset,
    page: safePage,
  };
};

module.exports = {
  parsePagination,
};
