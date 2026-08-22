const userService = require('../services/userService');
const authService = require('../services/authService');
const { sendSuccess, buildPagination } = require('../utils/ApiResponse');

async function updateMe(req, res) {
  const user = await userService.updateProfile(req.user.id, req.body);
  return sendSuccess(res, { data: user, message: 'Profile updated' });
}

async function changeMyPassword(req, res) {
  await userService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
  // All sessions were revoked by the password change; the client re-logs in.
  authService.clearRefreshCookie(res);
  return sendSuccess(res, { message: 'Password changed — please log in again' });
}

async function listUsers(req, res) {
  const { search, page, limit } = req.query;
  const { users, total } = await userService.listCustomers({ search, page, limit });
  return sendSuccess(res, { data: users, pagination: buildPagination({ page, limit, total }) });
}

async function getUser(req, res) {
  const { user, orderSummary } = await userService.getCustomerWithOrderSummary(req.params.id);
  return sendSuccess(res, { data: { user, orderSummary } });
}

async function updateUserStatus(req, res) {
  const user = await userService.setStatus(req.params.id, req.body.isActive, req.user.id);
  return sendSuccess(res, { data: user, message: `Account ${req.body.isActive ? 'enabled' : 'disabled'}` });
}

async function updateUserRole(req, res) {
  const user = await userService.setRole(req.params.id, req.body.role, req.user.id);
  return sendSuccess(res, { data: user, message: 'Role updated' });
}

module.exports = { updateMe, changeMyPassword, listUsers, getUser, updateUserStatus, updateUserRole };
