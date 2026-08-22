const Category = require('../models/Category');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../config/constants');
const { slugify } = require('../utils/helpers');

async function list() {
  return Category.find().sort({ name: 1 }).lean();
}

async function create({ name, parent = null }) {
  if (parent) {
    const parentCat = await Category.findById(parent);
    if (!parentCat) throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Parent category does not exist');
  }
  const category = new Category({ name, slug: slugify(name), parent });
  await category.save();
  return category;
}

async function update(id, { name }) {
  const category = await Category.findById(id);
  if (!category) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Category not found');
  if (name) {
    category.name = name;
    category.slug = slugify(name);
  }
  await category.save();
  return category;
}

async function remove(id) {
  const referenced = await Product.countDocuments({ category: id });
  if (referenced > 0) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, `Cannot delete: ${referenced} product(s) still reference this category`);
  }
  const category = await Category.findByIdAndDelete(id);
  if (!category) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Category not found');
  return category;
}

module.exports = { list, create, update, remove };
