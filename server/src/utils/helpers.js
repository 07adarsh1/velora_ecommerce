const crypto = require('crypto');

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Unique-enough slug: falls back to a short random suffix on collision. */
function slugifyUnique(text) {
  const base = slugify(text) || 'item';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

/**
 * Human-friendly order number, e.g. SL-2026-000123 (PRD §7.7). Seeded with a
 * random suffix so two orders created in the same millisecond never collide.
 */
function generateOrderNumber() {
  const year = new Date().getFullYear();
  const random = crypto.randomInt(0, 100000).toString().padStart(5, '0');
  const ms = Date.now() % 1000;
  return `SL-${year}-${random}${ms.toString().padStart(3, '0')}`;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

module.exports = { slugify, slugifyUnique, generateOrderNumber, round2 };
