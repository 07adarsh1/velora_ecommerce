const express = require('express');
const wishlistController = require('../controllers/wishlist.controller');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const z = require('zod');
const { mongoId } = require('../validators/common');
const { moveToCartSchema, productIdParam } = require('../validators/cart.validator');

const addItemSchema = z.object({ body: z.object({ productId: mongoId }) });

const router = express.Router();

router.use(authenticate);

router.get('/', asyncHandler(wishlistController.getWishlist));
router.post('/items', validate(addItemSchema), asyncHandler(wishlistController.addItem));
router.delete('/items/:productId', validate(productIdParam), asyncHandler(wishlistController.removeItem));
router.post('/items/:productId/move-to-cart', validate(moveToCartSchema), asyncHandler(wishlistController.moveToCart));

module.exports = router;
