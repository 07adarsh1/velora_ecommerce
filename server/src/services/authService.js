const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { REFRESH_COOKIE_NAME } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../config/constants');
const logger = require('../utils/logger');
const User = require('../models/User');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// ─── Token issuance (PRD §8.3) ───────────────────────────────────────────────

function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.ACCESS_TOKEN_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
    algorithm: 'HS256',
  });
}

function newRefreshTokenExpiry() {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

async function issueTokens(user, { session = null } = {}) {
  const accessToken = signAccessToken(user);
  const refreshToken = crypto.randomBytes(48).toString('hex');

  // Persist the hash, never the raw token: a DB read alone can't impersonate a user.
  user.refreshTokenHashes.push({
    hash: sha256(refreshToken),
    expiresAt: newRefreshTokenExpiry(),
  });
  await user.save({ session });

  return { accessToken, refreshToken };
}

// ─── Cookie helpers ──────────────────────────────────────────────────────────

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    path: '/',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    path: '/',
  });
}

// ─── Registration / login ────────────────────────────────────────────────────

async function register({ name, email, password }) {
  const existing = await User.findOne({ email }).lean();
  if (existing) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'An account with this email already exists');
  }
  // The pre-save hook hashes passwordHash; assignment of the raw value here is
  // the single controlled entry point for setting a password.
  const user = new User({ name, email, passwordHash: password });
  await user.save();
  return user;
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash +refreshTokenHashes');
  // Identical generic message for unknown email and wrong password — prevents
  // user enumeration (PRD §17).
  if (!user) throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid email or password');

  const ok = await user.comparePassword(password);
  if (!ok) throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid email or password');

  if (!user.isActive) {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'This account has been disabled');
  }

  const tokens = await issueTokens(user);
  return { user, ...tokens };
}

// ─── Refresh rotation (PRD §8.4) ─────────────────────────────────────────────

async function refresh(rawRefreshToken) {
  if (!rawRefreshToken) {
    throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Refresh token missing');
  }
  const hash = sha256(rawRefreshToken);
  const user = await User.findOne({ 'refreshTokenHashes.hash': hash }).select('+refreshTokenHashes');
  if (!user) {
    throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid refresh token');
  }

  const now = new Date();
  // Opportunistic purge of expired entries keeps the array bounded.
  user.refreshTokenHashes = user.refreshTokenHashes.filter((e) => e.expiresAt > now);

  const entry = user.refreshTokenHashes.find((e) => e.hash === hash);

  if (entry && entry.revoked) {
    // Reuse of a rotated-out token is treated as theft: revoke everything.
    logger.warn({ userId: user._id.toString() }, 'Refresh token reuse detected — revoking all sessions');
    user.refreshTokenHashes = [];
    await user.save();
    throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Refresh token no longer valid');
  }

  if (!entry || !user.isActive) {
    throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid or expired refresh token');
  }

  // Rotation in two conditional steps (Mongo forbids $set on the array's
  // positional path and $push on the same array in one update). Step 1 is the
  // race gate: two concurrent refreshes with the same token — the loser's
  // `revoked: false` filter no longer matches and it gets a clean 401.
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const retired = await User.findOneAndUpdate(
    { _id: user._id, 'refreshTokenHashes.hash': hash, 'refreshTokenHashes.revoked': false },
    { $set: { 'refreshTokenHashes.$.revoked': true, 'refreshTokenHashes.$.revokedAt': now } },
    { new: true }
  );
  if (!retired) {
    throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Refresh token no longer valid');
  }
  await User.updateOne(
    { _id: user._id },
    { $push: { refreshTokenHashes: { hash: sha256(refreshToken), expiresAt: newRefreshTokenExpiry() } } }
  );

  const accessToken = signAccessToken(retired);
  return { user: retired, accessToken, refreshToken };
}

// ─── Logout (PRD §8.5) ───────────────────────────────────────────────────────

async function logout(rawRefreshToken) {
  if (!rawRefreshToken) return;
  // Atomic pull — no version collision with a concurrent refresh rotation.
  await User.updateOne(
    { 'refreshTokenHashes.hash': sha256(rawRefreshToken) },
    { $pull: { refreshTokenHashes: { hash: sha256(rawRefreshToken) } } }
  );
}

async function logoutAll(userId) {
  await User.updateOne({ _id: userId }, { $set: { refreshTokenHashes: [] } });
}

// ─── Password reset (PRD §8.7) ───────────────────────────────────────────────

async function forgotPassword(email) {
  const user = await User.findOne({ email }).select('+passwordResetTokenHash +passwordResetExpires');
  if (!user) return { token: null }; // caller always responds generically

  const token = crypto.randomBytes(32).toString('hex');
  user.passwordResetTokenHash = sha256(token);
  user.passwordResetExpires = new Date(Date.now() + env.PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000);
  await user.save();

  logger.info(
    { email, resetUrl: `/reset-password?token=${token}` },
    'Password reset requested (no email infra — token available in dev response only)'
  );
  return { token };
}

async function resetPassword(token, newPassword) {
  const user = await User.findOne({
    passwordResetTokenHash: sha256(token),
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpires +refreshTokenHashes');
  if (!user) {
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Reset token is invalid or has expired');
  }

  user.passwordHash = newPassword; // hashed by the pre-save hook
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokenHashes = []; // force re-login everywhere
  await user.save();
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId).select('+passwordHash +refreshTokenHashes');
  if (!user) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'User not found');

  const ok = await user.comparePassword(currentPassword);
  if (!ok) throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Current password is incorrect');

  user.passwordHash = newPassword;
  user.refreshTokenHashes = []; // password change revokes all sessions
  await user.save();
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  issueTokens,
  forgotPassword,
  resetPassword,
  changePassword,
  setRefreshCookie,
  clearRefreshCookie,
  sha256,
};
