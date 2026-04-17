import mongoose from 'mongoose';
import { env } from '../config/env';
import { logger } from '../utils/logger';

mongoose.set('strictQuery', true);

export async function connectMongo(uri: string = env.MONGO_URI): Promise<typeof mongoose> {
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10_000,
    });
    logger.info({ host: conn.connection.host, db: conn.connection.name }, 'MongoDB connected');
    return conn;
  } catch (err) {
    logger.error({ err }, 'MongoDB connection failed');
    throw err;
  }
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}

export { mongoose };
