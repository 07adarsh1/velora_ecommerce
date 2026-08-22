/**
 * Runs in every Jest worker BEFORE any module is loaded. env.js snapshots
 * process.env at require time, so all test overrides must happen here.
 */
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.MOCK_PAYMENTS = 'true';
process.env.TAX_RATE_PERCENT = '18';
process.env.SHIPPING_FLAT_RATE = '49';
process.env.LOW_STOCK_THRESHOLD = '5';
process.env.RETURN_WINDOW_DAYS = '7';
process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'a'.repeat(48);
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'b'.repeat(48);
process.env.LOG_LEVEL = 'fatal';

const uriFile = path.join(__dirname, '.mongo-uri.json');
if (fs.existsSync(uriFile)) {
  process.env.MONGODB_URI = JSON.parse(fs.readFileSync(uriFile, 'utf8')).uri;
}
