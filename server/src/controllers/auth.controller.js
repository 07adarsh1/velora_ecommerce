const authService = require('../services/authService');
const userService = require('../services/userService');
const { sendSuccess } = require('../utils/ApiResponse');
const env = require('../config/env');
const { REFRESH_COOKIE_NAME } = require('../config/constants');

async function register(req, res) {
  const user = await authService.register(req.body);
  const { accessToken, refreshToken } = await authService.issueTokens(user);
  authService.setRefreshCookie(res, refreshToken);
  return sendSuccess(res, { status: 201, data: { user, accessToken }, message: 'Account created' });
}

async function login(req, res) {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
  authService.setRefreshCookie(res, refreshToken);
  return sendSuccess(res, { data: { user, accessToken }, message: 'Logged in' });
}

async function refresh(req, res) {
  const { user, accessToken, refreshToken } = await authService.refresh(req.cookies?.[REFRESH_COOKIE_NAME]);
  authService.setRefreshCookie(res, refreshToken);
  return sendSuccess(res, { data: { user, accessToken } });
}

async function logout(req, res) {
  await authService.logout(req.cookies?.[REFRESH_COOKIE_NAME]);
  authService.clearRefreshCookie(res);
  return sendSuccess(res, { message: 'Logged out' });
}

async function forgotPassword(req, res) {
  const { token } = await authService.forgotPassword(req.body.email);
  const data = {};
  // Without email infrastructure the raw token is returned in non-production
  // environments only, so the flow is testable locally (PRD §4.1).
  if (token && !env.isProd) data.resetToken = token;
  return sendSuccess(res, { data, message: 'If an account exists for that email, a reset link has been sent' });
}

async function resetPassword(req, res) {
  await authService.resetPassword(req.body.token, req.body.newPassword);
  return sendSuccess(res, { message: 'Password has been reset — please log in again' });
}

async function me(req, res) {
  const user = await userService.getProfile(req.user.id);
  return sendSuccess(res, { data: user });
}

module.exports = { register, login, refresh, logout, forgotPassword, resetPassword, me };
