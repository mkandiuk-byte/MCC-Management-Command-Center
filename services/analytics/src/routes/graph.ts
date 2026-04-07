import type { FastifyInstance } from 'fastify'
import type { GraphNode, GraphEdge, GraphResponse } from '@aap/types'
import { sql } from '../lib/db.js'
import { detectCampaignType, normalizeSchema, parseOfferName, formatDate } from '../lib/helpers.js'
import { applyDagreLayout } from '../lib/layout.js'

const CACHE_TTL = 10 * 60 * 1000
let _cache: { data: GraphResponse; ts: number; key: string } | null = null

export async function graphRoutes(app: FastifyInstance) {
  // GET /api/analytics/graph?from=YYYY-MM-DD&to=YYYY-MM-DD
  app.get('/', async (req, reply) => {
    const q = req.query as Record<string, string>
    const today    = new Date()
    const dateFrom = q.from || formatDate(new Date(today.getFullYear(), today.getMonth(), 1))
    const dateTo   = q.to   || formatDate(today)
    const cacheKey = `${dateFrom}|${dateTo}`

    if (_cache && _cache.key === cacheKey && Date.now() - _cache.ts < CACHE_TTL) return _cache.data

    try {
      // ── Query 1: campaign × stream × offer stats ─────────────────────────
      const statsRows = await sql`
        SELECT
          e.campaign_id,
          e.stream_id,
          e.offer_id,
          COUNT(*)::int                                           AS clicks,
          SUM(CASE WHEN e.status = 'approved' THEN 1 ELSE 0 END)::int AS conversions,
          COALESCE(SUM(e.revenue), 0)::float                     AS revenue,
          COALESCE(SUM(e.cost), 0)::float                        AS cost
        FROM transform_events_cleaned e
        WHERE e.datetime >= ${dateFrom}::timestamptz
          AND e.datetime <  ${dateTo}::timestamptz + INTERVAL '1 day'
          AND e.campaign_id IS NOT NULL
          AND e.stream_id   IS NOT NULL
          AND e.offer_id    IS NOT NULL
        GROUP BY e.campaign_id, e.stream_id, e.offer_id
        ORDER BY clicks DESC
        LIMIT 10000
      `

      if (statsRows.length === 0) {
        return {
          nodes: [], edges: [],
          period: { from: dateFrom, to: dateTo },
          lastUpdated: new Date().toISOString(),
        }
      }

      // Collect unique IDs
      const campaignIds = [...new Set(statsRows.map(r => Number(r.campaign_id)))]
      const streamIds   = [...new Set(statsRows.map(r => Number(r.stream_id)))]
      const offerIds    = [...new Set(statsRows.map(r => Number(r.offer_id)))]

      // ── Query 2: metadata (3 parallel) ──────────────────────────────────
      const [campMeta, streamMeta, offerMeta] = await Promise.all([
        sql`
          SELECT id, name, alias, state, type
          FROM raw_keitaro_campaigns
          WHERE id = ANY(${campaignIds}::bigint[])
        `,
        sql`
          SELECT id, name, schema, type, weight, state, campaign_id
          FROM raw_keitaro_streams
          WHERE id = ANY(${streamIds}::bigint[])
        `,
        sql`
          SELECT id, name, country, payout_value::float, payout_type, payout_upsell
          FROM raw_keitaro_offers
          WHERE id = ANY(${offerIds}::bigint[])
        `,
      ])

      const campaignByIdMap  = new Map(campMeta.map(r => [Number(r.id), r]))
      const streamByIdMap    = new Map(streamMeta.map(r => [Number(r.id), r]))
      const offerByIdMap     = new Map(offerMeta.map(r => [Number(r.id), r]))

      // ── Accumulate stats per level ────────────────────────────────────────
      interface Accum { clicks: number; conversions: number; revenue: number; cost: number }
      const campaignAccum = new Map<number, Accum>()
      const streamAccum   = new Map<number, Accum>()
      const offerAccum    = new Map<number, Accum>()

      for (const r of statsRows) {
        const cid = Number(r.campaign_id)
        const sid = Number(r.stream_id)
        const oid = Number(r.offer_id)
        const row = { clicks: r.clicks, conversions: r.conversions, revenue: r.revenue, cost: r.cost }

        if (!campaignAccum.has(cid)) campaignAccum.set(cid, { clicks: 0, conversions: 0, revenue: 0, cost: 0 })
        if (!streamAccum.has(sid))   streamAccum.set(sid,   { clicks: 0, conversions: 0, revenue: 0, cost: 0 })
        if (!offerAccum.has(oid))    offerAccum.set(oid,    { clicks: 0, conversions: 0, revenue: 0, cost: 0 })

        for (const acc of [campaignAccum.get(cid)!, streamAccum.get(sid)!, offerAccum.get(oid)!]) {
          acc.clicks      += row.clicks
          acc.conversions += row.conversions
          acc.revenue     += row.revenue
          acc.cost        += row.cost
        }
      }

      function finalStats(a: Accum) {
        const profit = a.revenue - a.cost
        return {
          ...a,
          profit,
          roi: a.cost > 0 ? (profit / a.cost) * 100 : 0,
          cr:  a.clicks > 0 ? (a.conversions / a.clicks) * 100 : 0,
          cpa: a.conversions > 0 ? a.cost / a.conversions : 0,
        }
      }

      // ── Build React Flow nodes ────────────────────────────────────────────
      const nodes: GraphNode[] = []
      const edges: GraphEdge[] = []
      const streamNodeSeen  = new Set<number>()
      const offerNodeSeen   = new Set<number>()

      // group stat rows by campaign
      type StatsRow = (typeof statsRows)[number]
      const byCampaign = new Map<number, StatsRow[]>()
      for (const r of statsRows) {
        const cid = Number(r.campaign_id)
        if (!byCampaign.has(cid)) byCampaign.set(cid, [])
        byCampaign.get(cid)!.push(r)
      }

      for (const [cid, campRows] of byCampaign) {
        const meta = campaignByIdMap.get(cid)
        const campName = meta ? String(meta.name) : `Campaign ${cid}`
        const campNodeId = `campaign:${cid}`
        nodes.push({
          id:   campNodeId,
          type: 'campaign',
          position: { x: 0, y: 0 },
          data: {
            label:        campName,
            type:         'campaign',
            campaignType: detectCampaignType(campName),
            state:        meta ? String(meta.state) : 'unknown',
            ...finalStats(campaignAccum.get(cid) ?? { clicks: 0, conversions: 0, revenue: 0, cost: 0 }),
          },
        })

        const streamEdgesFromCamp = new Map<number, number>()

        for (const r of campRows) {
          const sid = Number(r.stream_id)
          const oid = Number(r.offer_id)
          const streamNodeId = `stream:${sid}`
          const offerNodeId  = `offer:${oid}`

          // Stream node
          if (!streamNodeSeen.has(sid)) {
            streamNodeSeen.add(sid)
            const sm = streamByIdMap.get(sid)
            nodes.push({
              id:   streamNodeId,
              type: 'stream',
              position: { x: 0, y: 0 },
              data: {
                label:        sm ? String(sm.name) : `Stream ${sid}`,
                type:         'stream',
                schema:       normalizeSchema(sm ? String(sm.schema ?? '') : ''),
                weight:       sm ? Number(sm.weight) : 100,
                streamStatus: sm ? String(sm.state) : 'active',
                campaignId:   cid,
                ...finalStats(streamAccum.get(sid) ?? { clicks: 0, conversions: 0, revenue: 0, cost: 0 }),
              },
            })
          }

          // Offer node
          if (!offerNodeSeen.has(oid)) {
            offerNodeSeen.add(oid)
            const om = offerByIdMap.get(oid)
            const offerName = om ? String(om.name) : `Offer ${oid}`
            const op = parseOfferName(offerName)
            nodes.push({
              id:   offerNodeId,
              type: 'offer',
              position: { x: 0, y: 0 },
              data: {
                label:            offerName,
                type:             'offer',
                offerBrand:       op.brand,
                offerGeo:         op.geo,
                offerSource:      op.source,
                offerLandingType: op.landingType,
                offerTier:        op.tier,
                offerConvAction:  op.convAction,
                offerNetwork:     op.network,
                ...finalStats(offerAccum.get(oid) ?? { clicks: 0, conversions: 0, revenue: 0, cost: 0 }),
              },
            })
          }

          // Campaign → Stream edge (accumulate clicks)
          streamEdgesFromCamp.set(sid, (streamEdgesFromCamp.get(sid) ?? 0) + r.clicks)

          // Stream → Offer edge
          const soEdgeId = `e:${streamNodeId}→${offerNodeId}`
          if (!edges.some(e => e.id === soEdgeId)) {
            const sa = streamAccum.get(sid) ?? { clicks: 0, conversions: 0, revenue: 0, cost: 0 }
            edges.push({
              id: soEdgeId, source: streamNodeId, target: offerNodeId,
              clicks: sa.clicks, conversions: sa.conversions,
            })
          }
        }

        // Campaign → Stream edges (one per stream, deduped)
        for (const [sid, clicks] of streamEdgesFromCamp) {
          const streamNodeId = `stream:${sid}`
          const csEdgeId = `e:${campNodeId}→${streamNodeId}`
          if (!edges.some(e => e.id === csEdgeId)) {
            edges.push({
              id: csEdgeId, source: campNodeId, target: streamNodeId,
              clicks,
              conversions: streamAccum.get(sid)?.conversions ?? 0,
            })
          }
        }
      }

      const positionedNodes = applyDagreLayout(nodes, edges)
      const data: GraphResponse = {
        nodes: positionedNodes,
        edges,
        period: { from: dateFrom, to: dateTo },
        lastUpdated: new Date().toISOString(),
        meta: {
          totalStreams: streamIds.length,
          totalOffers:  offerIds.length,
          shownStreams: streamNodeSeen.size,
          shownOffers:  offerNodeSeen.size,
        },
      }

      _cache = { data, ts: Date.now(), key: cacheKey }
      return data

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[analytics/graph]', message)
      return reply.status(500).send({
        nodes: [], edges: [],
        period: { from: dateFrom, to: dateTo },
        lastUpdated: new Date().toISOString(),
        error: message,
      })
    }
  })

  app.post('/', async () => { _cache = null; return { ok: true } })
}
