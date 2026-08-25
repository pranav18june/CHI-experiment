import mongoose from 'mongoose'

/**
 * Global connection cache across Vercel Lambda invocations.
 * Prevents exhausting MongoDB Atlas connection limits under high concurrency (500+ users).
 */
let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

export async function connectToDatabase() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('Please define the MONGODB_URI environment variable inside Vercel Project Settings')
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      // Per-lambda pool. A 500-user burst spins up many instances, so the Atlas
      // tier must be sized for (instances x maxPoolSize) connections, not for
      // data volume. Tune with MONGODB_MAX_POOL_SIZE.
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 10),
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // Indexes are built once by scripts/bootstrap-indexes.js, never implicitly
      // on a cold start: hundreds of concurrent index builds during a burst is
      // wasted work, and a failed unique-index build would otherwise pass
      // silently and disable event de-duplication.
      autoIndex: process.env.NODE_ENV !== 'production',
    }

    cached.promise = mongoose.connect(uri, opts).then((m) => m)
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}
