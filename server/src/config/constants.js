const ROLES = Object.freeze({ CUSTOMER: 'customer', ADMIN: 'admin' });

const ORDER_STATUS = Object.freeze({
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  RETURN_REQUESTED: 'RETURN_REQUESTED',
  REFUNDED: 'REFUNDED',
});

const PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
});

// Legal order status transitions — the single adjacency map enforced by
// orderService.transition (PRD §10.2). Everything not listed here is illegal.
const ORDER_TRANSITIONS = Object.freeze({
  PENDING_PAYMENT: ['PAYMENT_CONFIRMED', 'PAYMENT_FAILED', 'CANCELLED'],
  PAYMENT_CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['REFUNDED', 'DELIVERED'],
  // §9.5 retry: a failed order re-opens when the customer starts a new
  // payment attempt. This is the one deliberate addition to §10.2's table —
  // without it, "retry payment against the same order" would be impossible
  // since PAYMENT_FAILED is otherwise terminal.
  PAYMENT_FAILED: [ORDER_STATUS.PENDING_PAYMENT],
  CANCELLED: [],
  REFUNDED: [],
});

// Statuses from which a customer (or admin) may cancel an order.
const CANCELLABLE_STATUSES = Object.freeze([
  ORDER_STATUS.PENDING_PAYMENT,
  ORDER_STATUS.PAYMENT_CONFIRMED,
  ORDER_STATUS.PROCESSING,
]);

const GATEWAYS = Object.freeze({ RAZORPAY: 'razorpay', MOCK: 'mock' });

const PAYMENT_ENTITY_STATUS = Object.freeze({
  CREATED: 'CREATED',
  AUTHORIZED: 'AUTHORIZED',
  CAPTURED: 'CAPTURED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
});

const INVENTORY_REASONS = Object.freeze({
  ORDER: 'order',
  CANCELLATION: 'cancellation',
  RETURN: 'return',
  MANUAL_ADJUSTMENT: 'manual_adjustment',
});

const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});

const REFRESH_COOKIE_NAME = 'refreshToken';

module.exports = {
  ROLES,
  ORDER_STATUS,
  PAYMENT_STATUS,
  ORDER_TRANSITIONS,
  CANCELLABLE_STATUSES,
  GATEWAYS,
  PAYMENT_ENTITY_STATUS,
  INVENTORY_REASONS,
  ERROR_CODES,
  REFRESH_COOKIE_NAME,
};
