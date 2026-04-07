import Redis from 'ioredis'

const DEFAULT_TTL = 300 // seconds

let _client: Redis | null = null

function getClient(): Redis | null {
  if (_client) return _client
  const url = process.env.REDIS_URL
  if (!url) return null
  try {
    _client = new Redis(url, { lazyConnect: true, enableOfflineQueue: false })
    _client.on('error', () => { /* suppress — cache is best-effort */ })
    return _client
  } catch {
    return null
  }
}

// Exported for direct key operations (e.g. cache invalidation)
export const redis = {
  keys: async (pattern: string): Promise<string[]> => {
    const c = getClient()
    if (!c) return []
    try { return await c.keys(pattern) } catch { return [] }
  },
  del: async (...keys: string[]): Promise<void> => {
    const c = getClient()
    if (!c || keys.length === 0) return
    try { await c.del(...keys) } catch { /* best-effort */ }
  },
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const c = getClient()
  if (!c) return null
  try {
    const raw = await c.get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: unknown, ttl: number = DEFAULT_TTL): Promise<void> {
  const c = getClient()
  if (!c) return
  try {
    await c.set(key, JSON.stringify(value), 'EX', ttl)
  } catch {
    // cache is best-effort — ignore errors
  }
}
