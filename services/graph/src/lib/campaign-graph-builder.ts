import type { GraphNode, GraphEdge, GraphResponse } from '@aap/types'
import { keitaroRequest } from './keitaro.js'
import { applyDagreLayout } from './layout.js'

// Inline offer name parser
function stripLeading(s: string): string { return s.replace(/^[^A-Za-z0-9(]+/, '').trim() }
function parseOfferName(name: string) {
  const segs = name.split('|').map(stripLeading).filter(Boolean)
  const tierSeg = segs[3] ?? ''
  const m = tierSeg.match(/^(\S+)\s+T(\d+)([A-Z]+\d+)?$/i)
  return {
    brand: segs[0] ?? '', geo: segs[1] ?? '', source: segs[2] ?? '',
    landingType: (m ? m[1] : tierSeg.split(/\s+/)[0] ?? '').toUpperCase(),
    tier: m ? `T${m[2]}` : '', variant: m ? (m[3] ?? '') : '',
    convAction: segs[4] ?? '', network: segs[5] ?? '',
  }
}

interface RawStream {
  id: number | string
  name?: string
  schema?: string
  type?: string
  weight?: number
  status?: string
  offers?: Array<{ offer_id?: number; offer_name?: string; name?: string }>
}

interface AccumStats {
  clicks: number; conversions: number; revenue: number; profit: number; cost: number
}

function zeroAccum(): AccumStats {
  return { clicks: 0, conversions: 0, revenue: 0, profit: 0, cost: 0 }
}

function addRow(acc: AccumStats, row: Record<string, unknown>): void {
  acc.clicks      += Number(row['clicks']      ?? 0)
  acc.conversions += Number(row['conversions'] ?? 0)
  acc.revenue     += Number(row['revenue']     ?? 0)
  acc.profit      += Number(row['profit']      ?? 0)
  acc.cost        += Number(row['cost']        ?? 0)
}

function finalStats(acc: AccumStats) {
  return {
    ...acc,
    roi: acc.cost > 0 ? (acc.profit / acc.cost) * 100 : 0,
    cr:  acc.clicks > 0 ? (acc.conversions / acc.clicks) * 100 : 0,
    cpa: acc.conversions > 0 ? acc.cost / acc.conversions : 0,
  }
}

function normalizeSchema(raw: string): string {
  const s = raw.trim().toLowerCase()
  if (s === 'landings')            return 'landing'
  if (s === 'prelandings')         return 'prelanding'
  if (s === 'prelanding_landings') return 'prelanding+landing'
  return s || 'direct'
}

/**
 * Builds a small bipartite graph for a single campaign:
 * Stream nodes (left) → Offer nodes (right).
 * Positions are computed with a simple 2-column layout — no Dagre needed.
 */
export async function buildCampaignGraph(
  campaignId: number,
  dateFrom: string,
  dateTo: string,
): Promise<GraphResponse> {
  const KEITARO_URL = process.env.KEITARO_URL ?? ''
  const KEITARO_API_KEY = process.env.KEITARO_API_KEY ?? ''

  if (!KEITARO_URL || !KEITARO_API_KEY) {
    return { nodes: [], edges: [], period: { from: dateFrom, to: dateTo }, lastUpdated: new Date().toISOString(), error: 'env not configured' }
  }

  // ── Parallel fetch: streams, offers id→name map ──────────────────────────
  const [streamsRaw, offersListRaw] = await Promise.all([
    keitaroRequest(KEITARO_URL, KEITARO_API_KEY, 'GET', `/campaigns/${campaignId}/streams`) as Promise<RawStream[]>,
    keitaroRequest(KEITARO_URL, KEITARO_API_KEY, 'GET', '/offers')                          as Promise<Array<Record<string, unknown>>>,
  ])

  const offerIdToName = new Map<number, string>()
  interface OfferNodeMeta { bonus: string; country: string[]; network: string; payoutUpsell: boolean }
  const offerNodeMetaByName = new Map<string, OfferNodeMeta>()
  for (const o of offersListRaw ?? []) {
    const oname = String(o['name'] ?? '').trim()
    if (!oname) continue
    offerIdToName.set(Number(o['id']), oname)
    const values = (o['values'] as Array<{ name: string; value: string }>) ?? []
    offerNodeMetaByName.set(oname, {
      bonus: values.find(v => v.name === 'bonus')?.value ?? '',
      country: (o['country'] as string[]) ?? [],
      network: stripLeading(String(o['affiliate_network'] ?? '')),
      payoutUpsell: Boolean(o['payout_upsell']),
    })
  }

  // ── Stats report filtered to this campaign ────────────────────────────────
  const reportRaw = await keitaroRequest(KEITARO_URL, KEITARO_API_KEY, 'POST', '/report/build', {
    range: { from: dateFrom, to: dateTo, timezone: 'Europe/Kyiv' },
    dimensions: ['stream', 'offer'],
    filters: [{ name: 'campaign_id', operator: 'EQUALS', expression: String(campaignId) }],
    measures: ['clicks', 'conversions', 'revenue', 'profit', 'roi', 'cr', 'cpa', 'cost'],
    sort: [{ name: 'clicks', order: 'DESC' }],
    limit: 1000,
  }) as { rows: Array<Record<string, unknown>> }

  const streamStatsMap = new Map<string, AccumStats>()
  const offerStatsMap  = new Map<string, AccumStats>()

  for (const row of reportRaw.rows ?? []) {
    const sn = String(row['stream'] ?? '').trim()
    const on = String(row['offer']  ?? '').trim()
    if (!sn) continue
    if (!streamStatsMap.has(sn)) streamStatsMap.set(sn, zeroAccum())
    addRow(streamStatsMap.get(sn)!, row)
    if (on) {
      if (!offerStatsMap.has(on)) offerStatsMap.set(on, zeroAccum())
      addRow(offerStatsMap.get(on)!, row)
    }
  }

  // ── Limit to top 40 streams and top 40 offers by clicks ─────────────────
  const TOP_N = 10
  const topStreamSet = new Set(
    [...streamStatsMap.entries()].sort((a, b) => b[1].clicks - a[1].clicks).slice(0, TOP_N).map(([n]) => n)
  )
  const topOfferSet = new Set(
    [...offerStatsMap.entries()].sort((a, b) => b[1].clicks - a[1].clicks).slice(0, TOP_N).map(([n]) => n)
  )

  // ── Build a name→stream metadata lookup (first match wins) ──────────────
  const streamMetaByName = new Map<string, RawStream>()
  for (const s of streamsRaw ?? []) {
    const n = String(s.name ?? '').trim()
    if (n && !streamMetaByName.has(n)) streamMetaByName.set(n, s)
  }

  // ── Build nodes & edges from report rows (one node per unique name) ───────
  const streamNodes:  GraphNode[] = []
  const offerNodes:   GraphNode[] = []
  const edges:        GraphEdge[] = []
  const streamNodeId  = new Map<string, string>()   // name → nodeId
  const offerNodeId   = new Map<string, string>()   // name → nodeId
  let   streamCounter = 0

  // Stream nodes — top 40 streams by clicks
  for (const [streamName, acc] of streamStatsMap.entries()) {
    if (!topStreamSet.has(streamName)) continue
    const meta   = streamMetaByName.get(streamName)
    const nodeId = meta ? `stream:${meta.id}` : `stream:name:${streamCounter++}`
    streamNodeId.set(streamName, nodeId)
    streamNodes.push({
      id: nodeId, type: 'stream', position: { x: 0, y: 0 },
      data: {
        label: streamName, type: 'stream',
        schema:       normalizeSchema(String(meta?.schema ?? '')),
        weight:       Number(meta?.weight ?? 0),
        streamStatus: String(meta?.status ?? 'active'),
        campaignId,
        ...finalStats(acc),
      },
    })
  }

  // Offer nodes + edges — top 40 offers, edge per (stream,offer) pair in report
  for (const row of reportRaw.rows ?? []) {
    const sn = String(row['stream'] ?? '').trim()
    const on = String(row['offer']  ?? '').trim()
    if (!sn || !on) continue
    if (!topOfferSet.has(on)) continue

    let oid = offerNodeId.get(on)
    if (!oid) {
      oid = `offer:${encodeURIComponent(on)}`
      offerNodeId.set(on, oid)
      const parsed  = parseOfferName(on)
      const nodeMeta = offerNodeMetaByName.get(on)
      offerNodes.push({
        id: oid, type: 'offer', position: { x: 0, y: 0 },
        data: {
          label: on, type: 'offer',
          ...finalStats(offerStatsMap.get(on) ?? zeroAccum()),
          offerBrand:       parsed.brand,
          offerGeo:         parsed.geo,
          offerSource:      parsed.source,
          offerLandingType: parsed.landingType,
          offerTier:        parsed.tier,
          offerConvAction:  parsed.convAction,
          offerNetwork:     nodeMeta?.network || parsed.network,
          offerBonus:       nodeMeta?.bonus ?? '',
          offerCountry:     nodeMeta?.country ?? [],
          offerPayoutUpsell: nodeMeta?.payoutUpsell ?? false,
        },
      })
    }

    const sid    = streamNodeId.get(sn)
    if (!sid) continue
    const edgeId = `e:${sid}→${oid}`
    if (!edges.some(e => e.id === edgeId)) {
      edges.push({ id: edgeId, source: sid, target: oid,
        clicks: Number(row['clicks'] ?? 0), conversions: Number(row['conversions'] ?? 0) })
    }
  }

  // ── Dagre TB layout (streams top row, offers bottom row) ─────────────────
  const allNodes = [...streamNodes, ...offerNodes]
  const nodes    = applyDagreLayout(allNodes, edges, { rankdir: 'TB', nodesep: 20, ranksep: 180 })

  return {
    nodes, edges,
    period: { from: dateFrom, to: dateTo },
    lastUpdated: new Date().toISOString(),
    meta: {
      totalStreams: streamStatsMap.size,
      totalOffers: offerStatsMap.size,
      shownStreams: streamNodes.length,
      shownOffers: offerNodes.length,
    },
  }
}
