/**
 * Shared pagination/filter/sort parsing consumed by every list endpoint so the
 * `?page=&limit=&sort=` contract is identical everywhere (PRD §6.2).
 */
function parsePagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const rawLimit = parseInt(query.limit, 10) || defaultLimit;
  const limit = Math.min(Math.max(1, rawLimit), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Parses a `sort` query param like `-createdAt,price` into a Mongo sort object
 * (`{ createdAt: -1, price: 1 }`). Only whitelisted fields are accepted —
 * callers pass the allowed set, so clients can't sort on unindexed/sensitive
 * fields.
 */
function parseSort(sortParam, allowedFields, fallback = { createdAt: -1 }) {
  if (!sortParam) return fallback;
  const sort = {};
  for (const part of String(sortParam).split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const desc = trimmed.startsWith('-');
    const field = desc ? trimmed.slice(1) : trimmed;
    if (!allowedFields.includes(field)) continue;
    sort[field] = desc ? -1 : 1;
  }
  return Object.keys(sort).length ? sort : fallback;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { parsePagination, parseSort, escapeRegex };
