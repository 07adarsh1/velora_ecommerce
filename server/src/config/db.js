const dns = require('dns');
const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

// Set reliable public DNS resolvers to prevent Windows SRV ECONNREFUSED issues with MongoDB Atlas
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {
  // Ignore if not supported in environment
}

mongoose.set('strictQuery', true);

mongoose.connection.on('connected', () =>
  logger.info({ host: mongoose.connection.host, db: mongoose.connection.name }, 'MongoDB connected')
);
mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB connection error'));
mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

async function connectDB(uri = env.MONGODB_URI) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    // Pooled connection shared by the whole process — never connect per request (PRD §19).
    maxPoolSize: 10,
  });
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
