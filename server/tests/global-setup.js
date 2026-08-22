const fs = require('fs');
const path = require('path');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

/**
 * Jest globalSetup: one shared in-memory replica set for the whole run.
 * A replica set (not a plain standalone) is required because payment
 * confirmation uses multi-document transactions (PRD §11.3).
 */
module.exports = async () => {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri('shelflife_test');
  global.__MONGOD_REPLSET__ = replSet;
  fs.writeFileSync(path.join(__dirname, '.mongo-uri.json'), JSON.stringify({ uri }));
};
