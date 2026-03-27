import type { FastifyInstance } from 'fastify'
import { keitaroRequest, formatDate, extractGeo } from '../lib/keitaro.js'

interface GeoBenchmark { geo: string; count: number; avgCpa: number; minCpa: number; maxCpa: number }
interface GeoBenchmarksResponse { benchmarks: GeoBenchmark[]; period: { from: string; to: string }; lastUpdated: string; error?: string }

let _cache: { data: GeoBenchmarksResponse; ts: number } | null = null
const CACHE_TTL = 60 * 60 * 1000
const MIN_COST_FOR_SUCCESS = 150
const MIN_CLICKS_FOR_SUCCESS = 100

export async function geoBenchmarksRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    if (_cache && Date.now() - _cache.ts < CACHE_TTL) return _cache.data

    const KEITARO_URL = process.env.KEITARO_URL || ''
    const KEITARO_API_KEY = process.env.KEITARO_API_KEY || ''
    if (!KEITARO_URL || !KEITARO_API_KEY) return { benchmarks: [], period: { from: '', to: '' }, lastUpdated: new Date().toISOString(), error: 'KEITARO_URL or KEITARO_API_KEY not configured' }

    try {
      const today = new Date()
      const yearAgo = new Date(today); yearAgo.setFullYear(yearAgo.getFullYear() - 1)
      const dateFrom = formatDate(yearAgo); const dateTo = formatDate(today)

      const reportRaw = await keitaroRequest(KEITARO_URL, KEITARO_API_KEY, 'POST', '/report/build', {
        range: { from: dateFrom, to: dateTo, timezone: 'Europe/Kyiv' },
        dimensions: ['campaign'],
        measures: ['clicks', 'conversions', 'revenue', 'profit', 'roi', 'cpa', 'cost'],
        sort: [{ name: 'cost', order: 'DESC' }],
      }) as { rows: Record<string, unknown>[] }

      const geoMap = new Map<string, { cpas: number[] }>()
      for (const row of (reportRaw.rows ?? [])) {
        const campaignName = String(row['campaign'] ?? '')
        const cost = Number(row['cost'] ?? 0); const clicks = Number(row['clicks'] ?? 0)
        const conversions = Number(row['conversions'] ?? 0); const roi = Number(row['roi'] ?? 0)
        const cpa = Number(row['cpa'] ?? 0)
        if (cost < MIN_COST_FOR_SUCCESS || clicks < MIN_CLICKS_FOR_SUCCESS || conversions === 0 || roi < 0 || cpa <= 0) continue
        const geo = extractGeo(campaignName)
        const entry = geoMap.get(geo) ?? { cpas: [] }
        entry.cpas.push(cpa); geoMap.set(geo, entry)
      }

      const benchmarks: GeoBenchmark[] = Array.from(geoMap.entries()).map(([geo, { cpas }]) => ({
        geo, count: cpas.length, avgCpa: cpas.reduce((a, b) => a + b, 0) / cpas.length,
        minCpa: Math.min(...cpas), maxCpa: Math.max(...cpas),
      })).sort((a, b) => b.count - a.count)

      const result: GeoBenchmarksResponse = { benchmarks, period: { from: dateFrom, to: dateTo }, lastUpdated: new Date().toISOString() }
      _cache = { data: result, ts: Date.now() }
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[keitaro/geo-benchmarks]', message)
      return reply.status(500).send({ benchmarks: [], period: { from: '', to: '' }, lastUpdated: new Date().toISOString(), error: message })
    }
  })
}
