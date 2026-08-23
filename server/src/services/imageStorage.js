/**
 * Product image storage (PRD §14.4): uploads go to Cloudinary — never to
 * MongoDB blobs or the server's local disk (ephemeral on Render/Railway).
 *
 * Implemented against Cloudinary's signed REST upload endpoint so no extra
 * SDK dependency is needed. Configure via CLOUDINARY_CLOUD_NAME /
 * CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET env vars.
 */
const crypto = require('crypto');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../config/constants');

const configured = () => Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

async function upload(buffer, originalName) {
  if (!configured()) {
    throw new ApiError(
      503,
      ERROR_CODES.INTERNAL_ERROR,
      'Image upload is not configured — set CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET, or add image URLs directly'
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'velora/products';
  const signature = crypto
    .createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`)
    .digest('hex');

  const form = new FormData();
  form.append('file', new Blob([buffer]), originalName || 'upload.jpg');
  form.append('api_key', env.CLOUDINARY_API_KEY);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  form.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    throw new ApiError(502, ERROR_CODES.INTERNAL_ERROR, `Image upload failed (${response.status})`);
  }
  const json = await response.json();
  return json.secure_url;
}

module.exports = { upload, configured };
