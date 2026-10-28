'use strict';

const mongoose = require('mongoose');
const config = require('./env');
const { AppError } = require('../utils/errors');

// Cache the connection promise on `global` so serverless invocations (Vercel)
// reuse one connection instead of opening a new one per request.
let cached = global.__khqrMongo;
if (!cached) cached = global.__khqrMongo = { conn: null, promise: null };

mongoose.set('strictQuery', true);

async function connectDB() {
  if (!config.mongodbUri) {
    throw new AppError(503, 'DB_NOT_CONFIGURED', 'មិនទាន់កំណត់ MONGODB_URI', {});
  }
  if (cached.conn && mongoose.connection.readyState === 1) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(config.mongodbUri, {
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 10,
        bufferCommands: false,
      })
      .then((m) => m)
      .catch((err) => {
        cached.promise = null; // allow retry on the next request
        throw err;
      });
  }
  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.conn = null;
    throw new AppError(503, 'DB_UNAVAILABLE', 'មិនអាចភ្ជាប់មូលដ្ឋានទិន្នន័យបាន សូមព្យាយាមម្ដងទៀត', {
      cause: String(err && err.message),
    });
  }
  return cached.conn;
}

function dbState() {
  return ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown';
}

module.exports = { connectDB, dbState };
