/**
 * One-off: replaces placeholder product images with real, keyword-matched
 * photos — searched on Wikimedia Commons (no API key needed), downloaded,
 * uploaded into THIS deployment's Cloudinary account (signed upload via the
 * same imageStorage service the API uses), and the Product documents in the
 * DB are repointed at the Cloudinary URLs.
 *
 *   node src/scripts/set-product-images.js            # fill products with no/picsum images
 *   node src/scripts/set-product-images.js --force    # redo every product
 */
const env = require('../config/env');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const imageStorage = require('../services/imageStorage');

/**
 * Some machines run a local DNS proxy that answers `nslookup` but refuses
 * Node's c-ares SRV queries, which breaks mongodb+srv:// URIs for node while
 * the developer's own tools work fine. When that happens, resolve the SRV
 * record via nslookup and connect directly to the listed hosts instead.
 */
function resolveDirectUri(uri) {
  const m = uri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@([^/?]+)(?:\/([^?]*))?/);
  if (!m) return uri;
  const [, user, pass, srvHost, dbName = 'shelflife'] = m;
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

const UA = { 'User-Agent': 'ShelfLifeImageSeeder/1.0 (portfolio project)' };

// Fictional seed brands carry no search signal — strip them.
const FICTIONAL_BRANDS = [
  'Nexon', 'Sonique', 'Voltix', 'Lumos', 'Keyforge', 'Visionary', 'Thronos',
  'Pulse', 'Carryon', 'Hydra', 'Ironforge', 'Zenflow', 'Brewlab', 'Hearth',
  'Restwell', 'Printopia', 'Databank', 'Stridex',
];

// Slugs whose best search terms differ from the raw name.
const KEYWORD_OVERRIDES = {
  'aurora-wireless-earbuds': 'wireless earbuds',
  'bass-cannon-over-ear-headphones': 'over-ear headphones',
  'bluetooth-party-speaker-40w': 'bluetooth loudspeaker',
  'studio-monitor-speakers-pair': 'studio monitor speaker',
  'usb-c-fast-charger-65w': 'usb-c charger',
  'titanium-power-bank-20000mah': 'power bank',
  'smart-led-bulb-4-pack': 'led bulb',
  'mechanical-keyboard-tkl': 'mechanical keyboard',
  '27-inch-144hz-gaming-monitor': 'computer monitor',
  'ergonomic-gaming-chair': 'office chair',
  'resistance-band-set': 'exercise band',
  'aromatherapy-diffuser': 'humidifier',
  'smart-fitness-watch-s2': 'smartwatch',
  'fitness-band-lite': 'fitness tracker',
  'wireless-charging-stand': 'wireless charger',
  'laptop-sleeve-15-6-inch': 'laptop sleeve',
  'canvas-backpack-25l': 'backpack',
  'leather-wallet-rfid': 'leather wallet',
  'noise-cancelling-earbuds-pro': 'earbuds',
  'stainless-steel-water-bottle-1l': 'steel water bottle',
  'adjustable-dumbbell-20kg': 'dumbbell',
  'yoga-mat-premium-6mm': 'yoga mat',
  'smart-body-composition-scale': 'bathroom scale',
  'espresso-machine-compact': 'espresso machine',
  'electric-kettle-17l': 'electric kettle',
  'air-fryer-4l': 'air fryer',
  'ceramic-dinner-set-16-pcs': 'dinnerware',
  'memory-foam-pillow-2-pack': 'pillow',
  'cotton-bedsheet-queen': 'bed sheet',
  'designing-data-intensive-applications': 'data center servers',
  'clean-architecture': 'software architecture diagram',
  'atomic-habits': 'habits book',
  'sapiens-a-brief-history-of-humankind': 'history book',
  'deep-work': 'desk workspace book',
  'webcam-1080p-with-mic': 'webcam',
  'portable-document-scanner': 'document scanner',
  'external-ssd-1tb': 'solid-state drive',
  'usb-c-hub-8-in-1': 'usb hub',
  'wireless-presentation-clicker': 'presentation clicker',
  'running-shoes-velocity': 'running shoes',
  'trail-backpack-30l': 'hiking backpack',
  'smart-led-bulb': 'led bulb',
};

function keywordsFor(product) {
  if (KEYWORD_OVERRIDES[product.slug]) return KEYWORD_OVERRIDES[product.slug];
  let name = product.name;
  for (const brand of FICTIONAL_BRANDS) name = name.replace(new RegExp(`\\b${brand}\\b`, 'gi'), '');
  return name.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Openverse (Creative-Commons search aggregator, no API key) — primary source.
 * Results are served from many provider CDNs (mostly Flickr's), which avoids
 * any single host rate-limiting a bulk run.
 */
async function openverseSearch(query) {
  const url =
    'https://api.openverse.org/v1/images/?q=' + encodeURIComponent(query) +
    '&page_size=10&filter_dead=false&license_type=all-cc';
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!res || !res.ok) return [];
  const json = await res.json().catch(() => null);
  return (json?.results || [])
    .filter((r) => r.provider !== 'wikimedia' && (r.width ?? 0) >= 500)
    .sort((a, b) => Math.abs(1000 - (a.width ?? 0)) - Math.abs(1000 - (b.width ?? 0)))
    .map((r) => r.url);
}

async function commonsSearch(query) {
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&generator=search' +
    `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + query)}` +
    '&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url%7Cmime%7Csize&format=json';
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return [];
  const json = await res.json().catch(() => null);
  const pages = json?.query?.pages ? Object.values(json.query.pages) : [];
  return pages
    .map((p) => p.imageinfo?.[0])
    .filter((i) => i && /jpeg|png/.test(i.mime || '') && (i.width ?? 0) >= 500 && (i.size ?? 0) < 8_000_000)
    .map((i) => i.url);
}

async function download(url, attempt = 0) {
  const res = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(30_000) }).catch(() => null);
  if (!res) return null;

  // 429/503: honor a short cooldown, then retry once or move on.
  if ((res.status === 429 || res.status === 503) && attempt < 2) {
    const wait = Math.min(Number(res.headers.get('retry-after')) * 1000 || 5000, 8000);
    await sleep(wait);
    return download(url, attempt + 1);
  }
  if (!res.ok) return null;

  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length > 15_000 ? buf : null; // skip icons/thumbnails/error pages
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const force = process.argv.includes('--force');
  if (!imageStorage.configured()) {
    console.error('CLOUDINARY_* vars not set — aborting');
    process.exit(1);
  }
  await mongoose.connect(resolveDirectUri(env.MONGODB_URI), {
    serverSelectionTimeoutMS: 15_000,
  });

  const products = await Product.find({});
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const product of products) {
    const needsImages =
      force || product.images.length === 0 || product.images.every((i) => i.includes('picsum'));
    if (!needsImages) {
      skipped++;
      continue;
    }

    const kw = keywordsFor(product);
    process.stdout.write(`${product.slug} [${kw}] … `);

    try {
      // Openverse (multi-provider CC search) first; Wikimedia as quality
      // backup when it's not throttling us; loremflickr as last resort.
      const images = [];
      const sources = [...(await openverseSearch(kw)), ...(await commonsSearch(kw))];
      for (const url of sources.slice(0, 4)) {
        if (images.length >= 2) break;
        const buf = await download(url);
        if (!buf) continue;
        images.push(await imageStorage.upload(buf, `${product.slug}-${images.length + 1}.jpg`));
        await sleep(800);
      }

      if (images.length === 0) {
        const buf = await download(`https://loremflickr.com/800/800/${encodeURIComponent(kw)}`);
        if (buf) images.push(await imageStorage.upload(buf, `${product.slug}-1.jpg`));
      }

      if (images.length === 0) {
        console.log('NO IMAGE FOUND');
        failed++;
        continue;
      }

      product.images = images;
      await product.save();
      console.log(`${images.length} image(s)`);
      updated++;
    } catch (err) {
      console.log(`ERROR ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. updated=${updated} skipped(already had images)=${skipped} failed=${failed}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
