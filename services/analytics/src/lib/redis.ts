import Redis from 'ioredis'

const DEFAULT_TTL = 300 // seconds

let client: Redis | null = null

function getClient(): Redis | null {
  if (client) return client
  const url = process.env.REDIS_URL
  if (!url) return null
  try {
    client = new Redis(url, { lazyConnect: true, enableOfflineQueue: false })
    client.on('error', () => { /* suppress — cache is best-effort */ })
    return client
  } catch {
    return null
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getClient()
  if (!redis) return null
  try {
    const raw = await redis.get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: unknown, ttl: number = DEFAULT_TTL): Promise<void> {
  const redis = getClient()
  if (!redis) return
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttl)
  } catch {
    // cache is best-effort — ignore errors
  }
}
