import type { GraphNode, GraphEdge, GraphResponse } from '@aap/types'
import { keitaroRequest, detectCampaignType, formatDate } from './keitaro.js'

interface RawCampaign {
  id: number | string
  name: string
  state?: string
}

interface ReportRow {
  campaign?: unknown
  stream?: unknown
  offer?: unknown
  clicks?: unknown
  conversions?: unknown
  revenue?: unknown
  profit?: unknown
  roi?: unknown
  cr?: unknown
  cpa?: unknown
  cost?: unknown
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

interface StreamSetup {
  id: number
  schema: string
  weight: number
  streamType: string
  streamStatus: string
  offerNames: string[]
}

interface AccumStats {
  clicks: number
  conversions: number
  revenue: number
  profit: number
  cost: number
}

function zeroAccum(): AccumStats {
  return { clicks: 0, conversions: 0, revenue: 0, profit: 0, cost: 0 }
}

function addStats(acc: AccumStats, row: ReportRow): void {
  acc.clicks     += Number(row.clicks     ?? 0)
  acc.conversions+= Number(row.conversions?? 0)
  acc.revenue    += Number(row.revenue    ?? 0)
  acc.profit     += Number(row.profit     ?? 0)
  acc.cost       += Number(row.cost       ?? 0)
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
  if (s === 'landings')              return 'landing'
  if (s === 'prelandings')           return 'prelanding'
  if (s === 'prelanding_landings')   return 'prelanding+landing'
  return s || 'direct'
}

export async function buildGraphData(dateFrom: string, dateTo: string): Promise<GraphResponse> {
  const KEITARO_URL = process.env.KEITARO_URL ?? ''
  const KEITARO_API_KEY = process.env.KEITARO_API_KEY ?? ''

  if (!KEITARO_URL || !KEITARO_API_KEY) {
    return {
      nodes: [], edges: [],
      period: { from: dateFrom, to: dateTo },
      lastUpdated: new Date().toISOString(),
      error: 'KEITARO_URL or KEITARO_API_KEY not configured',
    }
  }

  // ── 1. Campaigns list + offers list (for IDs and offer name mapping) ─────────
  const [campaignsRaw, offersListRaw] = await Promise.all([
    keitaroRequest(KEITARO_URL, KEITARO_API_KEY, 'GET', '/campaigns') as Promise<RawCampaign[]>,
    keitaroRequest(KEITARO_URL, KEITARO_API_KEY, 'GET', '/offers') as Promise<Array<Record<string, unknown>>>,
  ])

  const campaignById  = new Map<string, number>()   // name → id
  const campaignState = new Map<string, string>()   // name → state
  for (const c of campaignsRaw ?? []) {
    campaignById.set(String(c.name ?? ''), Number(c.id))
    campaignState.set(String(c.name ?? ''), String(c.state ?? 'active'))
  }

  // Build offer id → name map (Keitaro streams return offer_id, not offer_name)
  const offerIdToName = new Map<number, string>()
  for (const o of offersListRaw ?? []) {
    offerIdToName.set(Number(o['id']), String(o['name'] ?? '').trim())
  }

  // ── 2. Three-dimensional report: campaign × stream × offer ─────────────────
  const reportRaw = await keitaroRequest(KEITARO_URL, KEITARO_API_KEY, 'POST', '/report/build', {
    range: { from: dateFrom, to: dateTo, timezone: 'Europe/Kyiv' },
    dimensions: ['campaign', 'stream', 'offer'],
    measures: ['clicks', 'conversions', 'revenue', 'profit', 'roi', 'cr', 'cpa', 'cost'],
    sort: [{ name: 'clicks', order: 'DESC' }],
    limit: 5000,
  }) as { rows: ReportRow[] }

  // ── 3. Aggregate stats per level ───────────────────────────────────────────
  const campaignAccum = new Map<string, AccumStats>()           // campaignName
  const streamAccum   = new Map<string, Map<string, AccumStats>>() // campaignName → streamName
  const offerAccum    = new Map<string, AccumStats>()            // offerName

  for (const row of reportRaw.rows ?? []) {
    const cn = String(row.campaign ?? '').trim()
    const sn = String(row.stream   ?? '').trim()
    const on = String(row.offer    ?? '').trim()
    if (!cn || !sn || !on) continue

    if (!campaignAccum.has(cn)) campaignAccum.set(cn, zeroAccum())
    addStats(campaignAccum.get(cn)!, row)

    if (!streamAccum.has(cn)) streamAccum.set(cn, new Map())
    const sm = streamAccum.get(cn)!
    if (!sm.has(sn)) sm.set(sn, zeroAccum())
    addStats(sm.get(sn)!, row)

    if (!offerAccum.has(on)) offerAccum.set(on, zeroAccum())
    addStats(offerAccum.get(on)!, row)
  }

  // ── 4. Fetch stream IDs for each active campaign (batch 50) ───────────────
  const activeCampaigns = [...campaignAccum.keys()]
    .map(name => ({ name, id: campaignById.get(name) }))
    .filter((c): c is { name: string; id: number } => !!c.id)

  const streamSetupMap = new Map<string, Map<string, StreamSetup>>()

  const CONCURRENCY = 50
  for (let i = 0; i < activeCampaigns.length; i += CONCURRENCY) {
    const batch = activeCampaigns.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(({ name, id }) =>
        keitaroRequest(KEITARO_URL, KEITARO_API_KEY, 'GET', `/campaigns/${id}/streams`)
          .then(raw => ({ name, raw: raw as RawStream[] }))
      )
    )
    for (const result of results) {
      if (result.status !== 'fulfilled') continue
      const { name, raw } = result.value
      const setupMap = new Map<string, StreamSetup>()
      for (const s of raw ?? []) {
        const streamName = String(s.name ?? '').trim() || `Stream ${s.id}`
        const offerNames = (s.offers ?? [])
          .map(o => {
            if (o.offer_id) {
              const byId = offerIdToName.get(Number(o.offer_id))
              if (byId) return byId
            }
            return String(o.offer_name ?? o.name ?? '').trim()
          })
          .filter(Boolean)
        setupMap.set(streamName, {
          id:           Number(s.id),
          schema:       normalizeSchema(String(s.schema ?? '')),
          weight:       Number(s.weight ?? 100),
          streamType:   String(s.type ?? 'position').trim() || 'position',
          streamStatus: String(s.status ?? 'active'),
          offerNames,
        })
      }
      streamSetupMap.set(name, setupMap)
    }
  }

  // ── 5. Build nodes and edges ───────────────────────────────────────────────
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const offerNodeId = new Map<string, string>()    // offerName → nodeId
  const streamNodeSeen = new Set<string>()          // avoid duplicate stream nodes

  for (const [campaignName, campAccum] of campaignAccum) {
    const campaignId = campaignById.get(campaignName)
    if (!campaignId) continue

    const campaignNodeId = `campaign:${campaignId}`
    nodes.push({
      id: campaignNodeId,
      type: 'campaign',
      position: { x: 0, y: 0 },
      data: {
        label: campaignName,
        type: 'campaign',
        campaignType: detectCampaignType(campaignName),
        state: campaignState.get(campaignName) ?? 'active',
        ...finalStats(campAccum),
      },
    })

    const setupMap = streamSetupMap.get(campaignName)
    if (!setupMap) continue

    for (const [streamName, setup] of setupMap) {
      const streamNodeId = `stream:${setup.id}`
      const streamStats = finalStats(streamAccum.get(campaignName)?.get(streamName) ?? zeroAccum())

      if (!streamNodeSeen.has(streamNodeId)) {
        streamNodeSeen.add(streamNodeId)
        nodes.push({
          id: streamNodeId,
          type: 'stream',
          position: { x: 0, y: 0 },
          data: {
            label: streamName,
            type: 'stream',
            schema:       setup.schema,
            weight:       setup.weight,
            streamStatus: setup.streamStatus,
            campaignId,
            ...streamStats,
          },
        })
      }

      // Campaign → Stream
      edges.push({
        id:     `e:${campaignNodeId}→${streamNodeId}`,
        source: campaignNodeId,
        target: streamNodeId,
        clicks:      streamStats.clicks,
        conversions: streamStats.conversions,
      })

      // Stream → Offer
      for (const offerName of setup.offerNames) {
        let oid = offerNodeId.get(offerName)
        if (!oid) {
          oid = `offer:${encodeURIComponent(offerName)}`
          offerNodeId.set(offerName, oid)
          const offerStats = finalStats(offerAccum.get(offerName) ?? zeroAccum())
          nodes.push({
            id:   oid,
            type: 'offer',
            position: { x: 0, y: 0 },
            data: { label: offerName, type: 'offer', ...offerStats },
          })
        }

        const edgeId = `e:${streamNodeId}→${oid}`
        if (!edges.some(e => e.id === edgeId)) {
          const offerStats = offerAccum.get(offerName) ?? zeroAccum()
          edges.push({
            id:     edgeId,
            source: streamNodeId,
            target: oid,
            clicks:      offerStats.clicks,
            conversions: offerStats.conversions,
          })
        }
      }
    }
  }

  return {
    nodes, edges,
    period: { from: dateFrom, to: dateTo },
    lastUpdated: new Date().toISOString(),
  }
}

export { formatDate }
