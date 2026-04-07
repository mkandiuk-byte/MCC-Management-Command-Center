import type { FastifyInstance } from 'fastify'
import { sql } from '../lib/db.js'
import { detectCampaignType, detectNetwork, NETWORK_COLOR, formatDate } from '../lib/helpers.js'

const CACHE_TTL = 5 * 60 * 1000
const _cache = new Map<string, { data: unknown; ts: number }>()

// Collector campaigns: named like "[GEO] OFFERS [NETWORK]" — they aggregate/redirect traffic.
// The meaningful middle node is cloak_campaign_id, not campaign_id.
function isCollectorCampaign(name: string): boolean {
  return /\bOFFERS\b/i.test(name)
}

function extractGeo(name: string): string {
  return name.match(/^[\[{(]?([A-Z]{2,3})[\]})\s_|-]/)?.[1] ?? ''
}

export async function chainRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const q = req.query as Record<string, string>
    const today       = new Date()
    const defaultFrom = formatDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000))
    const dateFrom    = q.from || defaultFrom
    const dateTo      = q.to   || formatDate(today)
    const cacheKey    = `chain:${dateFrom}|${dateTo}`

    const cached = _cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

    try {
      // Single GROUP BY replaces all Keitaro API calls
      const rows = await sql`
        SELECT
          a.ad_campaign_id,
          a.campaign_id,
          a.cloak_campaign_id,
          a.offer_id,
          c.name                                       AS campaign_name,
          c.alias,
          c.state,
          c.type                                       AS campaign_type_raw,
          COALESCE(o.name, a.offer_name, 'Unknown')    AS offer_name,
          COUNT(*)::int                                AS clicks,
          (SUM(a.is_sale::int) + SUM(a.is_lead::int))::int AS conversions,
          COALESCE(SUM(a.revenue), 0)::float           AS revenue,
          COALESCE(SUM(a.cost), 0)::float              AS cost
        FROM agg_clicks a
        LEFT JOIN raw_keitaro_campaigns c ON c.id = a.campaign_id
        LEFT JOIN raw_keitaro_offers    o ON o.id = a.offer_id
        WHERE a.datetime >= ${dateFrom}::timestamptz
          AND a.datetime <  ${dateTo}::timestamptz + INTERVAL '1 day'
          AND a.ad_campaign_id IS NOT NULL
          AND a.ad_campaign_id != ''
        GROUP BY
          a.ad_campaign_id, a.campaign_id, a.cloak_campaign_id, a.offer_id,
          c.name, c.alias, c.state, c.type,
          COALESCE(o.name, a.offer_name, 'Unknown')
        ORDER BY clicks DESC
        LIMIT 5000
      `

      // ── Node types ─────────────────────────────────────────────────────────────
      type AdNode = {
        id: string; adId: string; network: string; networkColor: string
        clicks: number; conversions: number
      }
      type CampNode = {
        id: string; name: string; keitaroId: number; alias: string
        campaignType: string; state: string
        clicks: number; conversions: number; revenue: number; cost: number; cr: number
      }
      type CloakNode = {
        id: string; cloakId: string; campName: string; geo: string
        clicks: number; conversions: number; revenue: number; cost: number; cr: number
      }
      type OfferNode = {
        id: string; name: string; offerId: number
        clicks: number; conversions: number; revenue: number; cost: number; cr: number
      }

      const adNodes    = new Map<string, AdNode>()
      const campNodes  = new Map<string, CampNode>()
      const cloakNodes = new Map<string, CloakNode>()
      const offerNodes = new Map<string, OfferNode>()

      // Edge weight maps (sourceId→targetId → clicks)
      const adToCamp     = new Map<string, number>()
      const adToCloak    = new Map<string, number>()
      const campToOffer  = new Map<string, number>()
      const cloakToOffer = new Map<string, number>()

      // Drilldown link maps
      const adOfferRaw = new Map<string, Set<string>>()
      const adCampRaw  = new Map<string, Set<string>>()

      for (const row of rows) {
        const adId      = String(row.ad_campaign_id ?? '').trim()
        const campName  = String(row.campaign_name  ?? '').trim()
        const offerName = String(row.offer_name     ?? '').trim()
        const clicks    = Number(row.clicks)
        const conv      = Number(row.conversions)
        const revenue   = Number(row.revenue)
        const cost      = Number(row.cost)

        if (!adId) continue

        const adNid    = `ad::${adId}`
        const offerNid = offerName ? `offer::${offerName}` : null

        // ── Ad node ──────────────────────────────────────────────────────────────
        if (!adNodes.has(adNid)) {
          const net = detectNetwork(adId)
          adNodes.set(adNid, {
            id: adNid, adId, network: net, networkColor: NETWORK_COLOR[net],
            clicks: 0, conversions: 0,
          })
        }
        const an = adNodes.get(adNid)!
        an.clicks      += clicks
        an.conversions += conv

        // ── Middle node: collector → cloakCampaign node, regular → campaign node ─
        if (isCollectorCampaign(campName)) {
          const cloakId = String(row.cloak_campaign_id ?? '').trim()
          if (cloakId) {
            const cloakNid = `cloak::${cloakId}`
            if (!cloakNodes.has(cloakNid)) {
              cloakNodes.set(cloakNid, {
                id: cloakNid, cloakId, campName, geo: extractGeo(campName),
                clicks: 0, conversions: 0, revenue: 0, cost: 0, cr: 0,
              })
            }
            const cn = cloakNodes.get(cloakNid)!
            cn.clicks      += clicks
            cn.conversions += conv
            cn.revenue     += revenue
            cn.cost        += cost

            const ac = `${adNid}→${cloakNid}`
            adToCloak.set(ac, (adToCloak.get(ac) ?? 0) + clicks)

            if (!adCampRaw.has(adNid)) adCampRaw.set(adNid, new Set())
            adCampRaw.get(adNid)!.add(cloakNid)

            if (offerNid) {
              const co = `${cloakNid}→${offerNid}`
              cloakToOffer.set(co, (cloakToOffer.get(co) ?? 0) + clicks)
            }
          }
        } else {
          const campNid = campName ? `camp::${campName}` : null
          if (campNid) {
            if (!campNodes.has(campNid)) {
              campNodes.set(campNid, {
                id: campNid, name: campName,
                keitaroId: Number(row.campaign_id ?? 0),
                alias:     String(row.alias ?? ''),
                campaignType: detectCampaignType(campName),
                state: String(row.state ?? 'unknown'),
                clicks: 0, conversions: 0, revenue: 0, cost: 0, cr: 0,
              })
            }
            const cn = campNodes.get(campNid)!
            cn.clicks      += clicks
            cn.conversions += conv
            cn.revenue     += revenue
            cn.cost        += cost

            const ac = `${adNid}→${campNid}`
            adToCamp.set(ac, (adToCamp.get(ac) ?? 0) + clicks)

            if (!adCampRaw.has(adNid)) adCampRaw.set(adNid, new Set())
            adCampRaw.get(adNid)!.add(campNid)

            if (offerNid) {
              const co = `${campNid}→${offerNid}`
              campToOffer.set(co, (campToOffer.get(co) ?? 0) + clicks)
            }
          }
        }

        // ── Offer node (both paths) ──────────────────────────────────────────────
        if (offerNid) {
          if (!offerNodes.has(offerNid)) {
            offerNodes.set(offerNid, {
              id: offerNid, name: offerName,
              offerId: Number(row.offer_id ?? 0),
              clicks: 0, conversions: 0, revenue: 0, cost: 0, cr: 0,
            })
          }
          const on = offerNodes.get(offerNid)!
          on.clicks      += clicks
          on.conversions += conv
          on.revenue     += revenue
          on.cost        += cost

          if (!adOfferRaw.has(adNid)) adOfferRaw.set(adNid, new Set())
          adOfferRaw.get(adNid)!.add(offerNid)
        }
      }

      // ── Finalise cr ───────────────────────────────────────────────────────────
      for (const n of campNodes.values())  if (n.clicks > 0) n.cr = (n.conversions / n.clicks) * 100
      for (const n of cloakNodes.values()) if (n.clicks > 0) n.cr = (n.conversions / n.clicks) * 100
      for (const n of offerNodes.values()) if (n.clicks > 0) n.cr = (n.conversions / n.clicks) * 100

      // ── Layout: 3 columns ─────────────────────────────────────────────────────
      const H = 130; const GAP = 16; const COL_W = 300; const COL_GAP = 100
      const adList    = [...adNodes.values()].sort((a, b) => b.clicks - a.clicks)
      const campList  = [...campNodes.values()].sort((a, b) => b.clicks - a.clicks)
      const cloakList = [...cloakNodes.values()].sort((a, b) => b.clicks - a.clicks)
      const offerList = [...offerNodes.values()].sort((a, b) => b.clicks - a.clicks)

      // Campaign + cloak nodes share the middle column, merged and sorted by clicks
      const middleList = [...campList, ...cloakList].sort((a, b) => b.clicks - a.clicks)
      const colX = [0, COL_W + COL_GAP, (COL_W + COL_GAP) * 2]
      const adPos     = new Map(adList.map((n, i)      => [n.id, { x: colX[0], y: i * (H + GAP) }]))
      const middlePos = new Map(middleList.map((n, i)  => [n.id, { x: colX[1], y: i * (H + GAP) }]))
      const offerPos  = new Map(offerList.map((n, i)   => [n.id, { x: colX[2], y: i * (H + GAP) }]))

      // ── React Flow nodes ──────────────────────────────────────────────────────
      const nodes = [
        ...adList.map(n => ({
          id: n.id, type: 'adCampaign',
          position: adPos.get(n.id)!,
          data: {
            adId: n.adId, network: n.network, networkColor: n.networkColor,
            clicks: n.clicks, conversions: n.conversions,
            cr: n.clicks > 0 ? (n.conversions / n.clicks) * 100 : 0,
          },
        })),
        ...campList.map(n => ({
          id: n.id, type: 'campaign',
          position: middlePos.get(n.id)!,
          data: {
            name: n.name, keitaroId: n.keitaroId, alias: n.alias,
            campaignType: n.campaignType, state: n.state,
            clicks: n.clicks, conversions: n.conversions, cr: n.cr, revenue: n.revenue,
          },
        })),
        ...cloakList.map(n => ({
          id: n.id, type: 'cloakCampaign',
          position: middlePos.get(n.id)!,
          data: {
            cloakId: n.cloakId, campName: n.campName, geo: n.geo,
            clicks: n.clicks, conversions: n.conversions, cr: n.cr,
            revenue: n.revenue, cost: n.cost,
          },
        })),
        ...offerList.map(n => ({
          id: n.id, type: 'offer',
          position: offerPos.get(n.id)!,
          data: {
            name: n.name, offerId: n.offerId,
            clicks: n.clicks, conversions: n.conversions, cr: n.cr,
            revenue: n.revenue,
          },
        })),
      ]

      // ── Edges ─────────────────────────────────────────────────────────────────
      const allWeights = [
        ...adToCamp.values(), ...adToCloak.values(),
        ...campToOffer.values(), ...cloakToOffer.values(), 1,
      ]
      const maxClicks = Math.max(...allWeights)
      let ei = 0
      const w = (c: number) => Math.max(1, Math.round((c / maxClicks) * 5))

      const edgesAC  = [...adToCamp.entries()].map(([key, c]) => {
        const [source, target] = key.split('→')
        return { id: `e${ei++}`, source, target, data: { clicks: c },
          style: { strokeWidth: w(c), stroke: '#818cf8' } }
      })
      const edgesACl = [...adToCloak.entries()].map(([key, c]) => {
        const [source, target] = key.split('→')
        return { id: `e${ei++}`, source, target, data: { clicks: c },
          style: { strokeWidth: w(c), stroke: '#f97316' } }
      })
      const edgesCO  = [...campToOffer.entries()].map(([key, c]) => {
        const [source, target] = key.split('→')
        return { id: `e${ei++}`, source, target, data: { clicks: c },
          style: { strokeWidth: w(c), stroke: '#4ade80' } }
      })
      const edgesClO = [...cloakToOffer.entries()].map(([key, c]) => {
        const [source, target] = key.split('→')
        return { id: `e${ei++}`, source, target, data: { clicks: c },
          style: { strokeWidth: w(c), stroke: '#fb923c' } }
      })

      // ── Drilldown link maps ────────────────────────────────────────────────────
      const adOfferLinks: Record<string, string[]> = {}
      for (const [adNid, s] of adOfferRaw) adOfferLinks[adNid] = [...s]

      const adCampLinks: Record<string, string[]> = {}
      for (const [adNid, s] of adCampRaw) adCampLinks[adNid] = [...s]

      const data = {
        nodes,
        edges: [...edgesAC, ...edgesACl, ...edgesCO, ...edgesClO],
        adOfferLinks,
        adCampLinks,
        stats: {
          adCampaignCount: adNodes.size,
          campaignCount:   campNodes.size,
          collectorCount:  cloakNodes.size,
          offerCount:      offerNodes.size,
          totalClicks:     adList.reduce((s, n) => s + n.clicks, 0),
          totalConversions: offerList.reduce((s, n) => s + n.conversions, 0),
          totalRevenue:    offerList.reduce((s, n) => s + n.revenue, 0),
        },
        period: { from: dateFrom, to: dateTo },
      }

      _cache.set(cacheKey, { data, ts: Date.now() })
      return data

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[analytics/chain]', message)
      return reply.status(500).send({ nodes: [], edges: [], error: message })
    }
  })
}
