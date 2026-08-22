const { MongoMemoryReplSet } = require('mongodb-memory-server');

/**
 * Local development without MongoDB: boots a single-node in-memory replica
 * set (a replica set is required for the multi-document transactions used by
 * payment confirmation — same guarantee Atlas provides) and starts the API
 * against it. Data does not survive restarts.
 *
 * env.js snapshots process.env at require time, so MONGODB_URI must be set
 * before any module that (transitively) loads the logger or config.
 */
async function main() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri('shelflife');
  process.env.MONGODB_URI = uri;

  const { connectDB } = require('../config/db');
  await connectDB(uri);

  const logger = require('../utils/logger');
  logger.info({ uri }, 'In-memory replica set ready');

  const seed = require('./seed');
  await seed({ fresh: true });
  logger.info('Database seeded successfully with initial products, categories, coupons & admin user');

  const app = require('../app');
  const port = parseInt(process.env.PORT, 10) || 5000;
  app.listen(port, () => logger.info({ port }, `ShelfLife API (dev:memory) listening on http://localhost:${port}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
