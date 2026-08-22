// One thin client function per backend endpoint (PRD §13.1) — every HTTP
// call in the app goes through this file.
import { api, qs } from './client';

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (body) => api('/api/auth/register', { method: 'POST', body }),
  login: (body) => api('/api/auth/login', { method: 'POST', body }),
  logout: () => api('/api/auth/logout', { method: 'POST' }),
  me: () => api('/api/auth/me'),
  forgotPassword: (email) => api('/api/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (body) => api('/api/auth/reset-password', { method: 'POST', body }),
  changePassword: (body) => api('/api/users/me/password', { method: 'PATCH', body }),
  updateProfile: (body) => api('/api/users/me', { method: 'PATCH', body }),
};

// ─── Catalog ─────────────────────────────────────────────────────────────────
export const productApi = {
  list: (params) => api(`/api/products${qs(params)}`),
  bySlug: (slug) => api(`/api/products/${slug}`),
  related: (id) => api(`/api/products/${id}/related`),
  reviews: (id, page = 1, limit = 10) => api(`/api/products/${id}/reviews${qs({ page, limit })}`),
  createReview: (id, body) => api(`/api/products/${id}/reviews`, { method: 'POST', body }),
  updateReview: (id, body) => api(`/api/reviews/${id}`, { method: 'PATCH', body }),
  deleteReview: (id) => api(`/api/reviews/${id}`, { method: 'DELETE' }),
};

export const categoryApi = {
  list: () => api('/api/categories'),
  create: (body) => api('/api/categories', { method: 'POST', body }),
  update: (id, body) => api(`/api/categories/${id}`, { method: 'PATCH', body }),
  remove: (id) => api(`/api/categories/${id}`, { method: 'DELETE' }),
};

// ─── Cart & wishlist ─────────────────────────────────────────────────────────
export const cartApi = {
  get: () => api('/api/cart'),
  addItem: (body) => api('/api/cart/items', { method: 'POST', body }),
  updateItem: (productId, body) => api(`/api/cart/items/${productId}`, { method: 'PATCH', body }),
  removeItem: (productId, variantSku) =>
    api(`/api/cart/items/${productId}${qs({ variantSku: variantSku ?? undefined })}`, { method: 'DELETE' }),
  merge: (items) => api('/api/cart/merge', { method: 'POST', body: { items } }),
  applyCoupon: (code) => api('/api/cart/coupon', { method: 'POST', body: { code } }),
  removeCoupon: () => api('/api/cart/coupon', { method: 'DELETE' }),
};

export const wishlistApi = {
  get: () => api('/api/wishlist'),
  add: (productId) => api('/api/wishlist/items', { method: 'POST', body: { productId } }),
  remove: (productId) => api(`/api/wishlist/items/${productId}`, { method: 'DELETE' }),
  moveToCart: (productId, quantity = 1) =>
    api(`/api/wishlist/items/${productId}/move-to-cart`, { method: 'POST', body: { quantity } }),
};

// ─── Addresses ───────────────────────────────────────────────────────────────
export const addressApi = {
  list: () => api('/api/addresses'),
  create: (body) => api('/api/addresses', { method: 'POST', body }),
  update: (id, body) => api(`/api/addresses/${id}`, { method: 'PATCH', body }),
  remove: (id) => api(`/api/addresses/${id}`, { method: 'DELETE' }),
};

// ─── Orders & payments ───────────────────────────────────────────────────────
export const orderApi = {
  create: (body) => api('/api/orders', { method: 'POST', body }),
  mine: (params) => api(`/api/orders${qs(params)}`),
  byId: (id) => api(`/api/orders/${id}`),
  cancel: (id, reason) => api(`/api/orders/${id}/cancel`, { method: 'POST', body: { reason } }),
  requestReturn: (id, reason) => api(`/api/orders/${id}/return`, { method: 'POST', body: { reason } }),
};

export const paymentApi = {
  createOrder: (orderId) => api('/api/payments/create-order', { method: 'POST', body: { orderId } }),
  verify: (body) => api('/api/payments/verify', { method: 'POST', body }),
  mockPay: (gatewayOrderId, succeed = true) =>
    api('/api/payments/mock-pay', { method: 'POST', body: { gatewayOrderId, succeed } }),
};

// ─── Admin ───────────────────────────────────────────────────────────────────
export const adminApi = {
  users: (params) => api(`/api/users${qs(params)}`),
  userById: (id) => api(`/api/users/${id}`),
  setUserStatus: (id, isActive) => api(`/api/users/${id}/status`, { method: 'PATCH', body: { isActive } }),
  setUserRole: (id, role) => api(`/api/users/${id}/role`, { method: 'PATCH', body: { role } }),

  createProduct: (body) => api('/api/products', { method: 'POST', body }),
  updateProduct: (id, body) => api(`/api/products/${id}`, { method: 'PATCH', body }),
  deleteProduct: (id) => api(`/api/products/${id}`, { method: 'DELETE' }),
  adjustStock: (id, body) => api(`/api/products/${id}/stock`, { method: 'PATCH', body }),

  orders: (params) => api(`/api/admin/orders${qs(params)}`),
  updateOrderStatus: (id, status, note) => api(`/api/admin/orders/${id}/status`, { method: 'PATCH', body: { status, note } }),
  updateShipment: (id, body) => api(`/api/admin/orders/${id}/shipment`, { method: 'PATCH', body }),
  approveReturn: (id) => api(`/api/admin/orders/${id}/return/approve`, { method: 'POST' }),
  rejectReturn: (id, note) => api(`/api/admin/orders/${id}/return/reject`, { method: 'POST', body: { note } }),

  inventory: (params) => api(`/api/admin/inventory${qs(params)}`),
  inventoryHistory: (productId) => api(`/api/admin/inventory/${productId}/history`),

  coupons: (page = 1) => api(`/api/admin/coupons${qs({ page })}`),
  createCoupon: (body) => api('/api/admin/coupons', { method: 'POST', body }),
  updateCoupon: (id, body) => api(`/api/admin/coupons/${id}`, { method: 'PATCH', body }),
  deleteCoupon: (id) => api(`/api/admin/coupons/${id}`, { method: 'DELETE' }),

  analyticsSummary: () => api('/api/admin/analytics/summary'),
  salesTrend: (from, to) => api(`/api/admin/analytics/sales-trend${qs({ from, to })}`),
  topProducts: (from, to) => api(`/api/admin/analytics/top-products${qs({ from, to })}`),
  revenueByCategory: (from, to) => api(`/api/admin/analytics/revenue-by-category${qs({ from, to })}`),
};

// Legal order transitions mirrored client-side so the admin UI only offers
// valid next statuses (the API remains the enforcement point — PRD §5.4).
export const ORDER_TRANSITIONS = {
  PENDING_PAYMENT: ['PAYMENT_CONFIRMED', 'PAYMENT_FAILED', 'CANCELLED'],
  PAYMENT_CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['REFUNDED', 'DELIVERED'],
  PAYMENT_FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
};
