/**
 * Consistent success envelope (PRD §6.4):
 *   { success: true, data, message?, pagination? }
 */
function sendSuccess(res, { status = 200, data = null, message = undefined, pagination = undefined } = {}) {
  const body = { success: true, data };
  if (message !== undefined) body.message = message;
  if (pagination !== undefined) body.pagination = pagination;
  return res.status(status).json(body);
}

function buildPagination({ page, limit, total }) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

module.exports = { sendSuccess, buildPagination };
