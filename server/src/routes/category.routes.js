const express = require('express');
const categoryController = require('../controllers/category.controller');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const asyncHandler = require('../utils/asyncHandler');
const { createCategorySchema, updateCategorySchema, idParam } = require('../validators/category.validator');

const router = express.Router();

router.get('/', asyncHandler(categoryController.list));
router.post('/', authenticate, authorize('admin'), validate(createCategorySchema), asyncHandler(categoryController.create));
router.patch('/:id', authenticate, authorize('admin'), validate(idParam), validate(updateCategorySchema), asyncHandler(categoryController.update));
router.delete('/:id', authenticate, authorize('admin'), validate(idParam), asyncHandler(categoryController.remove));

module.exports = router;
