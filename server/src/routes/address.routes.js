const express = require('express');
const addressController = require('../controllers/address.controller');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const { createAddressSchema, updateAddressSchema, idParam } = require('../validators/address.validator');

const router = express.Router();

router.use(authenticate);

router.get('/', asyncHandler(addressController.list));
router.post('/', validate(createAddressSchema), asyncHandler(addressController.create));
router.patch('/:id', validate(updateAddressSchema), asyncHandler(addressController.update));
router.delete('/:id', validate(idParam), asyncHandler(addressController.remove));

module.exports = router;
