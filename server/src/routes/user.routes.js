const express = require('express');
const userController = require('../controllers/user.controller');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const asyncHandler = require('../utils/asyncHandler');
const {
  changePasswordSchema,
  updateProfileSchema,
} = require('../validators/auth.validator');
const {
  listUsersQuery,
  userIdParam,
  updateStatusSchema,
  updateRoleSchema,
} = require('../validators/user.validator');

const router = express.Router();

router.patch('/me', authenticate, validate(updateProfileSchema), asyncHandler(userController.updateMe));
router.patch(
  '/me/password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(userController.changeMyPassword)
);

router.get('/', authenticate, authorize('admin'), validate(listUsersQuery), asyncHandler(userController.listUsers));
router.get('/:id', authenticate, authorize('admin'), validate(userIdParam), asyncHandler(userController.getUser));
router.patch(
  '/:id/status',
  authenticate,
  authorize('admin'),
  validate(userIdParam),
  validate(updateStatusSchema),
  asyncHandler(userController.updateUserStatus)
);
router.patch(
  '/:id/role',
  authenticate,
  authorize('admin'),
  validate(userIdParam),
  validate(updateRoleSchema),
  asyncHandler(userController.updateUserRole)
);

module.exports = router;
