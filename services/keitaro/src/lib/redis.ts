import Redis from 'ioredis'

export const redis = new Redis({
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  connectTimeout: 2000,
})

redis.on('error', (err) => {
  // Silent — fallback to in-memory happens in each route
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[redis] connection error:', err.message)
  }
})

export const CACHE_TTL_SEC = 90 * 24 * 60 * 60  // 3 months

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: unknown, ttlSec = CACHE_TTL_SEC): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSec)
  } catch {
    // ignore — Redis unavailable, no caching
  }
}
