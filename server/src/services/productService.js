const Product = require('../models/Product');
const Category = require('../models/Category');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../config/constants');
const { parsePagination } = require('../utils/queryBuilder');
const { slugify } = require('../utils/helpers');

// Statuses whose items count toward "units sold" popularity.
const SOLD_STATUSES = ['PAYMENT_CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

const SORT_OPTIONS = {
  newest: { createdAt: -1 },
  price: { basePrice: 1 },
  '-price': { basePrice: -1 },
  rating: { averageRating: -1, numReviews: -1 },
};

async function listProducts(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { isPublished: true };

  if (query.search) {
    // MongoDB text index over name+description (PRD §4.2).
    filter.$text = { $search: query.search };
  }
  if (query.category) {
    const cat = await Category.findOne(query.category.match(/^[0-9a-fA-F]{24}$/) ? { _id: query.category } : { slug: query.category });
    if (!cat) return { products: [], total: 0, page, limit };
    filter.category = cat._id;
  }
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.basePrice = {};
    if (query.minPrice !== undefined) filter.basePrice.$gte = query.minPrice;
    if (query.maxPrice !== undefined) filter.basePrice.$lte = query.maxPrice;
  }
  if (query.rating !== undefined) {
    filter.averageRating = { $gte: query.rating };
  }
  if (query.inStock === true || query.inStock === 'true') {
    // A variant product is "in stock" when any variant has stock.
    filter.$or = [
      { variants: { $elemMatch: { stock: { $gt: 0 } } } },
      { $and: [{ variants: { $size: 0 } }, { stock: { $gt: 0 } }] },
    ];
  }

  if (query.sort === 'popularity') {
    return listByPopularity(filter, { page, limit, skip });
  }

  // Fixed sort-name → Mongo sort map (fields must match the schema — the
  // user-facing sort name 'price' maps to basePrice).
  const sort = query.search && !query.sort
    ? { score: { $meta: 'textScore' } }
    : SORT_OPTIONS[query.sort] || SORT_OPTIONS.newest;

  // $meta textScore projection is only legal alongside a $text query.
  const projection = query.search ? { score: { $meta: 'textScore' } } : {};

  const [products, total] = await Promise.all([
    Product.find(filter, projection).sort(sort).skip(skip).limit(limit).populate('category', 'name slug').lean(),
    Product.countDocuments(filter),
  ]);
  return { products, total, page, limit };
}

/** Popularity = units sold across non-failed orders (PRD §4.2 sort list). */
async function listByPopularity(filter, { page, limit, skip }) {
  const [products, total] = await Promise.all([
    Product.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'orders',
          let: { pid: '$_id' },
          pipeline: [
            { $match: { status: { $in: SOLD_STATUSES } } },
            { $unwind: '$items' },
            { $match: { $expr: { $eq: ['$items.product', '$$pid'] } } },
            { $group: { _id: '$$pid', unitsSold: { $sum: '$items.quantity' } } },
          ],
          as: 'sales',
        },
      },
      { $addFields: { unitsSold: { $ifNull: [{ $first: '$sales.unitsSold' }, 0] } } },
      { $sort: { unitsSold: -1, numReviews: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'category' },
      },
      { $addFields: { category: { $first: '$category' } } },
      { $project: { sales: 0, 'category.createdAt': 0, 'category.updatedAt': 0, 'category.__v': 0 } },
    ]),
    Product.countDocuments(filter),
  ]);
  return { products, total, page, limit };
}

async function getBySlug(slug, { allowUnpublished = false } = {}) {
  const product = await Product.findOne({ slug }).populate('category', 'name slug');
  if (!product || (!allowUnpublished && !product.isPublished)) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Product not found');
  }
  return product;
}

async function getRelated(productId) {
  const product = await Product.findById(productId).lean();
  if (!product) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Product not found');
  return Product.find({ category: product.category, _id: { $ne: product._id }, isPublished: true })
    .sort({ averageRating: -1 })
    .limit(8)
    .populate('category', 'name slug')
    .lean();
}

async function createProduct(body) {
  const category = await Category.findById(body.category);
  if (!category) throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Category does not exist');

  const product = new Product({ ...body, slug: body.slug || slugify(body.name) });
  await product.save();
  return product;
}

const UPDATABLE_FIELDS = [
  'name', 'description', 'brand', 'category', 'images', 'basePrice',
  'discountPercent', 'variants', 'stock', 'isPublished',
];

async function updateProduct(id, body) {
  const product = await Product.findById(id);
  if (!product) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Product not found');
  if (body.category) {
    const category = await Category.findById(body.category);
    if (!category) throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Category does not exist');
  }
  // Whitelisted fields only — mass-assignment guard (PRD §17).
  for (const field of UPDATABLE_FIELDS) {
    if (body[field] !== undefined) product[field] = body[field];
  }
  await product.save();
  return product;
}

/**
 * Soft delete: unpublished products disappear from the shop but remain in the
 * DB so historical order snapshots keep a valid reference (PRD §12.3).
 */
async function deleteProduct(id) {
  const product = await Product.findByIdAndUpdate(id, { isPublished: false }, { new: true });
  if (!product) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Product not found');
  return product;
}

async function addImages(id, urls) {
  const product = await Product.findById(id);
  if (!product) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Product not found');
  product.images.push(...urls);
  await product.save();
  return product;
}

module.exports = {
  listProducts,
  getBySlug,
  getRelated,
  createProduct,
  updateProduct,
  deleteProduct,
  addImages,
};
