import mongoose from 'mongoose';

let pending: Promise<typeof mongoose> | null = null;

/**
 * Connect once per process and reuse the connection. Passenger may spin
 * workers up and down, so keep the pool small for shared hosting.
 */
export function connectDb(uri = process.env.MONGODB_URI): Promise<typeof mongoose> {
  if (!uri) throw new Error('MONGODB_URI is not set');
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose);
  if (!pending) {
    mongoose.set('strictQuery', true);
    pending = mongoose
      .connect(uri, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 10_000,
        autoIndex: process.env.NODE_ENV !== 'production',
      })
      .catch((err) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}

export async function disconnectDb() {
  pending = null;
  await mongoose.disconnect();
}

/** Raw driver handle (used by Better Auth's MongoDB adapter). */
export function nativeDb() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected yet: call connectDb() first');
  return db;
}

export { mongoose };
