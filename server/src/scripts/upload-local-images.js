/**
 * Uploads local images matching product names to Cloudinary
 * and replaces the old images in MongoDB with the single new image.
 *
 * Folder: server/product-images/
 * Usage: node src/scripts/upload-local-images.js
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const env = require('../config/env');
const Product = require('../models/Product');
const imageStorage = require('../services/imageStorage');

// Helper to normalize strings for flexible matching (e.g., "smart-led-bulb-(4-pack)" -> "smartledbulb4pack")
function normalize(str) {
  return str
    .toLowerCase()
    .replace(/\.[^/.]+$/, '') // remove file extension
    .replace(/[^a-z0-9]/g, ''); // remove non-alphanumeric chars
}

function resolveDirectUri(uri) {
  const m = uri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@([^/?]+)(?:\/([^?]*))?/);
  if (!m) return uri;
  const [, user, pass, srvHost, dbName = 'velora'] = m;
  try {
    const { execSync } = require('child_process');
    const out = execSync(`nslookup -type=SRV _mongodb._tcp.${srvHost}`, { encoding: 'utf8' });
    const hosts = [...out.matchAll(/svr hostname\s*=\s*(\S+)/g)].map((x) => x[1]);
    if (hosts.length === 0) return uri;
    return `mongodb://${user}:${pass}@${hosts.map((h) => `${h}:27017`).join(',')}/${dbName}?ssl=true&authSource=admin`;
  } catch {
    return uri;
  }
}

async function main() {
  const imageDir = path.resolve(__dirname, '../../product-images');

  if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir, { recursive: true });
    console.log(`\nCreated folder: ${imageDir}`);
    console.log('Please put your product images inside this folder and run the script again.\n');
    return;
  }

  const files = fs.readdirSync(imageDir).filter((file) => {
    return /\.(jpe?g|png|webp|avif|gif)$/i.test(file);
  });

  if (files.length === 0) {
    console.log(`\nNo image files found in ${imageDir}`);
    console.log('Supported formats: .jpg, .jpeg, .png, .webp, .avif\n');
    return;
  }

  if (!imageStorage.configured()) {
    console.error('\nCloudinary credentials (CLOUDINARY_*) are not configured in server/.env — aborting.');
    process.exit(1);
  }

  console.log(`Found ${files.length} image file(s) in product-images/\nConnecting to database...`);
  await mongoose.connect(resolveDirectUri(env.MONGODB_URI), {
    serverSelectionTimeoutMS: 15_000,
  });

  const products = await Product.find({});
  let updatedCount = 0;
  let unmatchedFiles = [...files];

  for (const product of products) {
    const normName = normalize(product.name);
    const normSlug = normalize(product.slug);

    // Find matching local file
    const matchedFile = files.find((f) => {
      const normFile = normalize(f);
      return normFile === normName || normFile === normSlug;
    });

    if (!matchedFile) {
      console.log(`[-] No matching image found for: "${product.name}"`);
      continue;
    }

    // Remove from unmatched list
    unmatchedFiles = unmatchedFiles.filter((f) => f !== matchedFile);

    const filePath = path.join(imageDir, matchedFile);
    const fileBuffer = fs.readFileSync(filePath);

    process.stdout.write(`[+] Uploading for "${product.name}" (${matchedFile}) ... `);

    try {
      const cloudinaryUrl = await imageStorage.upload(fileBuffer, matchedFile);
      
      // Replace old images with the single new image
      product.images = [cloudinaryUrl];
      await product.save();
      
      console.log('DONE');
      updatedCount++;
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }

  console.log(`\nSummary:`);
  console.log(`- Successfully updated: ${updatedCount} products`);
  if (unmatchedFiles.length > 0) {
    console.log(`- Unmatched image files (${unmatchedFiles.length}):`);
    unmatchedFiles.forEach((f) => console.log(`    ${f}`));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Execution error:', err);
  process.exit(1);
});
