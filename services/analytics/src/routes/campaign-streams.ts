import type { FastifyInstance } from 'fastify'
import { sql } from '../lib/db.js'
import { normalizeSchema } from '../lib/helpers.js'

const CACHE_TTL = 5 * 60 * 1000
const _cache = new Map<string, { data: unknown; ts: number }>()

export async function campaignStreamsRoutes(app: FastifyInstance) {
  // GET /api/analytics/campaigns/:id/streams
  app.get('/:id/streams', async (req, reply) => {
    const campaignId = parseInt((req.params as { id: string }).id, 10)
    if (isNaN(campaignId)) return reply.status(400).send({ streams: [], error: 'Invalid campaign id' })

    const cacheKey = `streams:${campaignId}`
    const cached = _cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

    try {
      const rows = await sql`
        SELECT id, name, schema, type, state, position, weight
        FROM raw_keitaro_streams
        WHERE campaign_id = ${campaignId}
        ORDER BY position ASC
      `

      const streams = rows.map(s => ({
        id:        Number(s.id),
        name:      String(s.name ?? '').trim() || `Stream ${s.id}`,
        schema:    normalizeSchema(String(s.schema ?? '')),
        status:    String(s.state ?? 'active'),
        position:  Number(s.position ?? 0),
        weight:    Number(s.weight ?? 100),
        offerNames: [] as string[],
      }))

      const data = { streams }
      _cache.set(cacheKey, { data, ts: Date.now() })
      return data

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[analytics/campaigns/${campaignId}/streams]`, message)
      return reply.status(500).send({ streams: [], error: message })
    }
  })
}
