import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

mongoose.set('strictQuery', true);
// Indexes are built explicitly (`npm run db:indexes` / seed) in production, never on app boot.
mongoose.set('autoIndex', !env.isProd);

export async function connectDB(uri = env.MONGODB_URI): Promise<typeof mongoose> {
  const conn = await mongoose.connect(uri, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10_000,
  });
  logger.info({ db: conn.connection.name }, 'MongoDB connected');
  return conn;
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
