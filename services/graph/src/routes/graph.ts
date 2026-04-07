import type { FastifyInstance } from 'fastify'
import { buildGraphData, formatDate } from '../lib/graph-builder.js'
import { applyDagreLayout } from '../lib/layout.js'
import type { GraphResponse } from '@aap/types'
import { cacheGet, cacheSet, redis } from '../lib/redis.js'

export async function graphRoutes(app: FastifyInstance) {
  // GET /api/graph?from=YYYY-MM-DD&to=YYYY-MM-DD
  app.get('/', async (req, reply) => {
    const { from, to } = req.query as { from?: string; to?: string }
    const today = new Date()
    const dateFrom = from || formatDate(new Date(today.getFullYear(), today.getMonth(), 1))
    const dateTo   = to   || formatDate(today)
    const periodKey = `${dateFrom}|${dateTo}`

    const cached = await cacheGet<GraphResponse>(`graph:all:${periodKey}`)
    if (cached) return cached

    try {
      const raw = await buildGraphData(dateFrom, dateTo)
      if (raw.error) return raw

      const data: GraphResponse = { ...raw, nodes: applyDagreLayout(raw.nodes, raw.edges) }
      await cacheSet(`graph:all:${periodKey}`, data)
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[graph/route]', message)
      return reply.status(500).send({
        nodes: [], edges: [],
        period: { from: '', to: '' },
        lastUpdated: new Date().toISOString(),
        error: message,
      })
    }
  })

  // POST /api/graph — bust cache
  app.post('/', async () => {
    const keys = await redis.keys('graph:all:*')
    if (keys.length) await redis.del(...keys)
    return { ok: true }
  })
}
