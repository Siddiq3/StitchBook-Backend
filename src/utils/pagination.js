/**
 * Pagination utilities
 * Enforces safe page/limit/offset handling for query params.
 */

const parsePagination = (req, defaultLimit = 20, maxLimit = 100) => {
  const rawPage = parseInt(req.query.page, 10);
  const rawLimit = parseInt(req.query.limit, 10);
  const rawOffset = parseInt(req.query.offset, 10);

  const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  let limit = Number.isNaN(rawLimit) || rawLimit < 1 ? defaultLimit : rawLimit;
  limit = Math.min(limit, maxLimit);

  const hasExplicitOffset = req.query.offset !== undefined && !Number.isNaN(rawOffset);
  const offset = hasExplicitOffset ? Math.max(0, rawOffset) : (page - 1) * limit;

  return { page, limit, offset };
};

module.exports = { parsePagination };
