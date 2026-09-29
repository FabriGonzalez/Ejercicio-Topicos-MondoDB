import mongoose from 'mongoose';
import { env } from '../config/env.js';

mongoose.set('strictQuery', true);

export async function connectDatabase(uri = env.mongoUri) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
  });

  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

mongoose.connection.on('error', (error) => {
  console.error('[mongo] error de conexión:', error.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('[mongo] conexión perdida');
});
