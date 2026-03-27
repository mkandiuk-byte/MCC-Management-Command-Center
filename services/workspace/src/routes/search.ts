import type { FastifyInstance } from 'fastify'
import { getStore } from '../lib/search-store.js'

export async function searchRoutes(app: FastifyInstance) {
  // GET /api/search?q=...
  app.get('/', async (req, reply) => {
    const { q } = req.query as { q?: string }
    const query = q?.trim()
    if (!query) return { results: [] }

    try {
      const store = await getStore()
      const results = await store.searchLex(query, { limit: 30 })
      return { results }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('no such table') || msg.includes('empty')) {
        return { results: [], needsIndex: true }
      }
      return reply.status(500).send({ error: msg })
    }
  })

  // POST /api/search — trigger reindex
  app.post('/', async (req, reply) => {
    try {
      const store = await getStore()
      let indexed = 0
      await store.update({
        onProgress: ({ current }: { current: number }) => { indexed = current },
      })
      return { ok: true, indexed }
    } catch (e: unknown) {
      return reply.status(500).send({ error: e instanceof Error ? e.message : String(e) })
    }
  })
}
