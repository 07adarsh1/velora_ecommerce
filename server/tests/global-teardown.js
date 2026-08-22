const fs = require('fs');
const path = require('path');

module.exports = async () => {
  if (global.__MONGOD_REPLSET__) {
    await global.__MONGOD_REPLSET__.stop();
  }
  const uriFile = path.join(__dirname, '.mongo-uri.json');
  if (fs.existsSync(uriFile)) fs.unlinkSync(uriFile);
};
