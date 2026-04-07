import type { FastifyInstance } from 'fastify'
import { buildCampaignGraph } from '../lib/campaign-graph-builder.js'
import { formatDate } from '../lib/keitaro.js'
import type { GraphResponse } from '@aap/types'
import { cacheGet, cacheSet, redis } from '../lib/redis.js'

export async function campaignGraphRoutes(app: FastifyInstance) {
  // GET /api/graph/campaign/:id?from=YYYY-MM-DD&to=YYYY-MM-DD
  app.get('/:id', async (req, reply) => {
    const campaignId = parseInt((req.params as { id: string }).id, 10)
    if (isNaN(campaignId)) return reply.status(400).send({ error: 'Invalid campaign id' })

    const { from, to } = req.query as { from?: string; to?: string }
    const today    = new Date()
    const dateFrom = from || formatDate(new Date(today.getFullYear(), today.getMonth(), 1))
    const dateTo   = to   || formatDate(today)
    const cacheKey = `${campaignId}|${dateFrom}|${dateTo}`

    const cached = await cacheGet<GraphResponse>(`graph:campaign:${cacheKey}`)
    if (cached) return cached

    try {
      const data = await buildCampaignGraph(campaignId, dateFrom, dateTo)
      if (!data.error) await cacheSet(`graph:campaign:${cacheKey}`, data)
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[graph/campaign/${campaignId}]`, message)
      return reply.status(500).send({
        nodes: [], edges: [],
        period: { from: '', to: '' },
        lastUpdated: new Date().toISOString(),
        error: message,
      })
    }
  })

  // POST /api/graph/campaign/:id — bust cache for this campaign
  app.post('/:id', async (req) => {
    const campaignId = parseInt((req.params as { id: string }).id, 10)
    const keys = await redis.keys(`graph:campaign:${campaignId}|*`)
    if (keys.length) await redis.del(...keys)
    return { ok: true }
  })
}
