"use client"

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { RefreshCw, X, ChevronRight, BarChart3, Search, ArrowLeft } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { Node, Edge } from '@xyflow/react'

const ChainCanvas = dynamic(() => import('./chain-canvas'), { ssr: false })

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChainStats {
  adCampaignCount: number
  campaignCount: number
  collectorCount: number
  offerCount: number
  totalClicks: number
  totalConversions: number
  totalRevenue: number
}

interface ChainData {
  nodes: Node[]
  edges: Edge[]
  adOfferLinks?: Record<string, string[]>   // "ad::id" → ["offer::name", ...]
  adCampLinks?: Record<string, string[]>    // "ad::id" → ["camp::name", ...] (scoped, from 3-way report)
  stats: ChainStats
  period: { from: string; to: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return String(v)
}
function fmtMoney(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`
  return `$${v.toFixed(0)}`
}
function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

type Preset = '7d' | '30d' | '90d'
const PRESETS: { key: Preset; label: string }[] = [
  { key: '7d', label: '7d' }, { key: '30d', label: '30d' }, { key: '90d', label: '90d' },
]
function getRange(p: Preset): { from: string; to: string } {
  const today = new Date()
  const days = p === '7d' ? 7 : p === '30d' ? 30 : 90
  return { from: fmtDate(new Date(today.getTime() - days * 86400000)), to: fmtDate(today) }
}

type SortKey = 'clicks' | 'conversions' | 'cr'
type NetworkFilter = 'all' | 'Meta' | 'Google' | 'TikTok' | 'Other'

const NETWORK_META: Record<NetworkFilter, { color: string; bg: string; border: string }> = {
  all:    { color: 'text-muted-foreground', bg: 'bg-accent', border: 'border-foreground/40' },
  Meta:   { color: 'text-[#1877f2]', bg: 'bg-blue-500/10', border: 'border-blue-500/40' },
  Google: { color: 'text-[#4285f4]', bg: 'bg-blue-400/10', border: 'border-blue-400/40' },
  TikTok: { color: 'text-white', bg: 'bg-zinc-700', border: 'border-zinc-500' },
  Other:  { color: 'text-muted-foreground', bg: 'bg-zinc-500/10', border: 'border-zinc-500/40' },
}

// ─── Detail Panel (node click) ────────────────────────────────────────────────

function DetailPanel({ node, onClose }: { node: Node; onClose: () => void }) {
  const d = node.data as Record<string, unknown>
  const type = node.type
  return (
    <div className="absolute top-4 right-4 z-10 w-72 rounded-xl border border-border bg-card/95 backdrop-blur-sm shadow-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {type === 'campaign' ? 'Campaign' : type === 'cloakCampaign' ? 'Collector' : 'Offer'}
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      {type === 'campaign' && (
        <div className="space-y-2.5">
          <div className="text-sm font-semibold leading-tight">{String(d.name ?? '')}</div>
          <div className="space-y-1">
            <div className="text-[10px]">
              <div className="text-muted-foreground mb-0.5">campaign_id</div>
              <div className="font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded">{String(d.keitaroId ?? '—')}</div>
            </div>
            <div className="text-[10px]">
              <div className="text-muted-foreground mb-0.5">cloak_id (alias)</div>
              <div className="font-mono font-bold text-yellow-300 bg-yellow-500/10 px-2 py-0.5 rounded truncate">{String(d.alias ?? '—')}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            <DRow label="Clicks" value={fmt(Number(d.clicks ?? 0))} cls="text-indigo-300" />
            <DRow label="Conv" value={fmt(Number(d.conversions ?? 0))} cls="text-green-400" />
            <DRow label="CR" value={`${Number(d.cr ?? 0).toFixed(2)}%`} cls="text-amber-400" />
            <DRow label="Revenue" value={fmtMoney(Number(d.revenue ?? 0))} cls="text-blue-400" />
          </div>
        </div>
      )}
      {type === 'cloakCampaign' && (
        <div className="space-y-2.5">
          <div className="text-xs text-muted-foreground truncate">{String(d.campName ?? '')}</div>
          <div className="text-[10px]">
            <div className="text-muted-foreground mb-0.5">cloak_id</div>
            <div className="font-mono font-bold text-orange-300 bg-orange-500/10 px-2 py-0.5 rounded truncate">{String(d.cloakId ?? '—')}</div>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            <DRow label="Clicks" value={fmt(Number(d.clicks ?? 0))} cls="text-indigo-300" />
            <DRow label="Conv" value={fmt(Number(d.conversions ?? 0))} cls="text-green-400" />
            <DRow label="CR" value={`${Number(d.cr ?? 0).toFixed(2)}%`} cls="text-amber-400" />
            <DRow label="Revenue" value={fmtMoney(Number(d.revenue ?? 0))} cls="text-orange-300" />
            <DRow label="Cost" value={fmtMoney(Number(d.cost ?? 0))} cls="text-red-400" />
            <DRow label="ROI" value={`${Number(d.cost ?? 0) > 0 ? ((Number(d.revenue ?? 0) - Number(d.cost ?? 0)) / Number(d.cost ?? 0) * 100).toFixed(0) : '—'}%`} cls="text-green-400" />
          </div>
        </div>
      )}
      {type === 'offer' && (
        <div className="space-y-2.5">
          <div className="text-sm font-semibold leading-tight">{String(d.name ?? '')}</div>
          <div className="text-[10px]">
            <div className="text-muted-foreground mb-0.5">offer_id</div>
            <div className="font-mono font-bold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded">{String(d.offerId ?? '—')}</div>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            <DRow label="Conv" value={fmt(Number(d.conversions ?? 0))} cls="text-green-400" />
            <DRow label="Leads" value={fmt(Number(d.leads ?? 0))} cls="text-blue-400" />
            <DRow label="Sales" value={fmt(Number(d.sales ?? 0))} cls="text-violet-400" />
            <DRow label="CR" value={`${Number(d.cr ?? 0).toFixed(2)}%`} cls="text-amber-400" />
            <DRow label="Revenue" value={fmtMoney(Number(d.revenue ?? 0))} cls="text-blue-400" />
            <DRow label="Clicks" value={fmt(Number(d.clicks ?? 0))} cls="text-muted-foreground" />
          </div>
        </div>
      )}
    </div>
  )
}

function DRow({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${cls}`}>{value}</span>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function DrilldownLegend() {
  return (
    <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1.5 rounded-lg border border-border/50 bg-card/80 backdrop-blur-sm px-3 py-2">
      <div className="flex gap-3 flex-wrap">
        {[
          { color: 'bg-yellow-400',  label: 'cloak / app / manager' },
          { color: 'bg-orange-400',  label: 'collector (cloak_id)' },
          { color: 'bg-green-400',   label: 'offer campaign' },
          { color: 'bg-emerald-400', label: 'offer_id' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <div className="flex items-center gap-1.5">
          <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#6b7280" strokeWidth="1.5" strokeDasharray="5 3"/></svg>
          <span className="text-[9px] text-muted-foreground/70">routing inferred</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#4ade80" strokeWidth="2"/></svg>
          <span className="text-[9px] text-muted-foreground/70">measured (Keitaro)</span>
        </div>
      </div>
    </div>
  )
}

// ─── Ad Campaign Card (Level 1) ───────────────────────────────────────────────

function AdCampaignCard({
  node, campCount, onSelect,
}: {
  node: Node
  campCount: number
  onSelect: () => void
}) {
  const d = node.data as Record<string, unknown>
  const network = String(d.network ?? 'Other')
  const adId = String(d.adId ?? '')
  const clicks = Number(d.clicks ?? 0)
  const conversions = Number(d.conversions ?? 0)
  const cr = Number(d.cr ?? 0)
  const networkColor = String(d.networkColor ?? '#6b7280')

  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded-xl border-2 border-border bg-card hover:border-indigo-400/60 hover:bg-accent/40 transition-all p-3.5 space-y-2.5 group"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: networkColor }}>
          {network}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
      <div className="font-mono text-[11px] font-semibold bg-muted/40 px-2 py-1 rounded truncate text-foreground" title={adId}>
        {adId}
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
        <div className="text-center">
          <div className="font-semibold text-indigo-300">{fmt(clicks)}</div>
          <div className="text-muted-foreground">clicks</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-green-400">{fmt(conversions)}</div>
          <div className="text-muted-foreground">conv</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-amber-400">{cr.toFixed(1)}%</div>
          <div className="text-muted-foreground">CR</div>
        </div>
      </div>
      {campCount > 0 && (
        <div className="text-[10px] text-muted-foreground">
          <span className="font-medium text-yellow-300">{campCount}</span> campaigns →
        </div>
      )}
    </button>
  )
}

// ─── Level 1: Ad Campaign List View ──────────────────────────────────────────

function AdCampaignListView({
  data, onSelect,
}: {
  data: ChainData
  onSelect: (adId: string) => void
}) {
  const [networkFilter, setNetworkFilter] = useState<NetworkFilter>('all')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('clicks')

  const adNodes = data.nodes.filter(n => n.type === 'adCampaign')

  // Count campaigns per ad_campaign
  const campCount = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of data.edges) {
      if (String(e.source).startsWith('ad::')) {
        map.set(String(e.source), (map.get(String(e.source)) ?? 0) + 1)
      }
    }
    return map
  }, [data.edges])

  // Network counts
  const networkCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const n of adNodes) {
      const net = String((n.data as Record<string, unknown>).network ?? 'Other')
      c[net] = (c[net] ?? 0) + 1
    }
    return c
  }, [adNodes])

  const filtered = useMemo(() => {
    let list = adNodes
    if (networkFilter !== 'all') {
      list = list.filter(n => String((n.data as Record<string, unknown>).network ?? 'Other') === networkFilter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(n => String((n.data as Record<string, unknown>).adId ?? '').toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      const da = a.data as Record<string, unknown>
      const db = b.data as Record<string, unknown>
      if (sortKey === 'clicks') return Number(db.clicks ?? 0) - Number(da.clicks ?? 0)
      if (sortKey === 'conversions') return Number(db.conversions ?? 0) - Number(da.conversions ?? 0)
      return Number(db.cr ?? 0) - Number(da.cr ?? 0)
    })
  }, [adNodes, networkFilter, search, sortKey])

  const { stats } = data

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Top stats */}
      <div className="flex gap-2 flex-wrap text-[10px] shrink-0">
        <span className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20 font-mono">
          {stats.adCampaignCount} ad campaigns
        </span>
        <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 font-mono">
          {stats.campaignCount} campaigns
        </span>
        {(stats.collectorCount ?? 0) > 0 && (
          <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-300 border border-orange-500/20 font-mono">
            {stats.collectorCount} collectors
          </span>
        )}
        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono">
          {stats.offerCount} offers
        </span>
        <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
          <BarChart3 className="inline h-2.5 w-2.5 mr-1" />
          {fmt(stats.totalClicks)} clicks · {fmt(stats.totalConversions)} conv · {fmtMoney(stats.totalRevenue)}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">{data.period.from} — {data.period.to}</span>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        {/* Network filter */}
        <div className="flex gap-1 p-0.5 rounded-lg border border-border/50 bg-card/30">
          {(['all', 'Meta', 'Google', 'TikTok', 'Other'] as NetworkFilter[]).map(net => {
            const count = net === 'all' ? adNodes.length : (networkCounts[net] ?? 0)
            if (net !== 'all' && count === 0) return null
            const m = NETWORK_META[net]
            const active = networkFilter === net
            return (
              <button
                key={net}
                onClick={() => setNetworkFilter(net)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  active ? `${m.bg} ${m.color} border ${m.border}` : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {net === 'all' ? `All (${count})` : `${net} (${count})`}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search ad_campaign_id…"
            className="w-full pl-7 pr-6 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide shrink-0">Sort</span>
          {([
            { key: 'clicks' as SortKey, label: 'Clicks' },
            { key: 'conversions' as SortKey, label: 'Conv' },
            { key: 'cr' as SortKey, label: 'CR' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                sortKey === key
                  ? 'border-foreground/40 bg-accent text-foreground font-medium'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
          {filtered.length} / {adNodes.length}
        </span>
      </div>

      {/* Cards grid */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No ad campaigns found
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 pb-4">
            {filtered.map(node => (
              <AdCampaignCard
                key={node.id}
                node={node}
                campCount={campCount.get(node.id) ?? 0}
                onSelect={() => onSelect(String((node.data as Record<string, unknown>).adId ?? ''))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Level 2: Drilldown Graph ─────────────────────────────────────────────────

function DrilldownView({
  adId, data, onBack,
}: {
  adId: string
  data: ChainData
  onBack: () => void
}) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const adNodeId = `ad::${adId}`
  const adNode = data.nodes.find(n => n.id === adNodeId)
  const adData = (adNode?.data ?? {}) as Record<string, unknown>

  // Compute subgraph
  const { adCampIds, offerCampIds, campNodes, offerNodes, subEdges } = useMemo(() => {
    // 1. Campaigns that received traffic from this ad (first-hop, from ad→camp edges)
    const adCampIdsFromEdges = new Set(
      data.edges.filter(e => e.source === adNodeId).map(e => String(e.target))
    )

    // Extend with scoped 3-way report if available — catches downstream campaigns
    // (e.g. offer campaigns that don't directly appear in ad→camp edges)
    const adCampIdsFromReport: Set<string> = data.adCampLinks?.[adNodeId]
      ? new Set(data.adCampLinks[adNodeId])
      : new Set()

    const adCampIds = new Set([...adCampIdsFromEdges, ...adCampIdsFromReport])

    // 2. Offers reached by this ad_campaign (direct link from 2-way report)
    const directOfferIds: Set<string> = data.adOfferLinks?.[adNodeId]
      ? new Set(data.adOfferLinks[adNodeId])
      : new Set(data.edges.filter(e => adCampIds.has(String(e.source))).map(e => String(e.target)))

    // 3. Offer-type campaigns: ONLY those scoped to this ad's campaign set
    //    (avoids pulling in unrelated "collector" campaigns that share the same offer)
    const offerCampIds = new Set(
      data.edges
        .filter(e => adCampIds.has(String(e.source)) && directOfferIds.has(String(e.target)))
        .map(e => String(e.source))
    )

    // 4. All campaign nodes = CLOAK/APP (adCampIds) + OFFER (offerCampIds)
    const allCampIds = new Set([...adCampIds, ...offerCampIds])

    const campNodes = data.nodes
      .filter(n => allCampIds.has(n.id))
      .sort((a, b) => Number((b.data as Record<string,unknown>).clicks ?? 0) - Number((a.data as Record<string,unknown>).clicks ?? 0))

    const offerNodes = data.nodes
      .filter(n => directOfferIds.has(n.id))
      .sort((a, b) => Number((b.data as Record<string,unknown>).clicks ?? 0) - Number((a.data as Record<string,unknown>).clicks ?? 0))

    // 5. Edges: only campaign→offer within this subgraph
    const subEdges = data.edges.filter(e =>
      allCampIds.has(String(e.source)) && directOfferIds.has(String(e.target))
    )

    return { adCampIds, offerCampIds, campNodes, offerNodes, subEdges }
  }, [adNodeId, data])

  // Re-layout in 3 columns:
  // Col 1: routing campaigns (cloak/app/manager — receive ad traffic but no direct offer link)
  // Col 2: offer-type campaigns (have direct campaign→offer edges)
  // Col 3: offers
  const { relayoutedNodes, relayoutedEdges } = useMemo(() => {
    const H = 140, GAP = 16, COL_W = 310, COL_GAP = 130

    // Campaigns that directly receive ad traffic but are NOT offer-type campaigns go to col1
    const routingCamps = campNodes.filter(n => adCampIds.has(n.id) && !offerCampIds.has(n.id))
    // Offer-type campaigns (have camp→offer edges, may also be in adCampIds) go to col2
    const offerCamps = campNodes.filter(n => offerCampIds.has(n.id))
    // Campaigns only in offerCampIds (not in adCampIds) — pure offer aggregators
    const pureOfferCamps = offerCamps.filter(n => !adCampIds.has(n.id))
    // Campaigns in BOTH adCampIds and offerCampIds go to col2 (they do both routing and offer delivery)
    const dualCamps = offerCamps.filter(n => adCampIds.has(n.id))

    const allCol2 = [...dualCamps, ...pureOfferCamps]
      .sort((a, b) => Number((b.data as Record<string,unknown>).clicks ?? 0) - Number((a.data as Record<string,unknown>).clicks ?? 0))

    // If there are NO routing campaigns (all direct), collapse to 2 columns
    const useThreeCol = routingCamps.length > 0
    const col1X = 0
    const col2X = useThreeCol ? COL_W + COL_GAP : 0
    const col3X = useThreeCol ? (COL_W + COL_GAP) * 2 : COL_W + COL_GAP

    const relayoutedNodes: Node[] = [
      ...(useThreeCol ? routingCamps.map((n, i) => ({ ...n, position: { x: col1X, y: i * (H + GAP) } })) : []),
      ...allCol2.map((n, i) => ({ ...n, position: { x: col2X, y: i * (H + GAP) } })),
      ...offerNodes.map((n, i) => ({ ...n, position: { x: col3X, y: i * (H + GAP) } })),
    ]

    // Real measured edges: offer_campaign → offer (solid)
    const measuredEdges = subEdges

    // Inferred edges: routing_campaign → offer_campaign (dashed — Keitaro doesn't measure this directly)
    const inferredEdges: Edge[] = []
    if (useThreeCol) {
      for (const rc of routingCamps) {
        for (const oc of allCol2) {
          inferredEdges.push({
            id: `inf-${rc.id}→${oc.id}`,
            source: rc.id,
            target: oc.id,
            data: { inferred: true },
            style: { strokeWidth: 1.5, stroke: '#6b7280', strokeDasharray: '6 3', opacity: 0.55 },
          } as Edge)
        }
      }
    }

    return { relayoutedNodes, relayoutedEdges: [...inferredEdges, ...measuredEdges] }
  }, [campNodes, offerNodes, subEdges, adCampIds, offerCampIds])

  const selectedNode = selectedNodeId
    ? relayoutedNodes.find(n => n.id === selectedNodeId) ?? null
    : null

  const networkColor = String(adData.networkColor ?? '#6b7280')

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Breadcrumb / Header */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Ad Campaigns
        </button>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-xs font-mono font-semibold text-foreground truncate max-w-[200px]" title={adId}>
          {adId}
        </span>
        <span
          className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
          style={{ color: networkColor, backgroundColor: networkColor + '20' }}
        >
          {String(adData.network ?? 'Other')}
        </span>

        {/* Ad stats */}
        <div className="flex gap-2 ml-auto text-[10px]">
          <span className="text-indigo-300 font-mono">{fmt(Number(adData.clicks ?? 0))} clicks</span>
          <span className="text-green-400 font-mono">{fmt(Number(adData.conversions ?? 0))} conv</span>
          <span className="text-amber-400 font-mono">{Number(adData.cr ?? 0).toFixed(2)}% CR</span>
        </div>
      </div>

      {/* Chain label */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground shrink-0 flex-wrap">
        <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-300 font-mono">
          🟡 cloak / app
        </span>
        <span className="text-muted-foreground/40 text-[10px]">{adCampIds.size}</span>
        <span>+</span>
        <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-300 font-mono">
          🟢 offer campaigns
        </span>
        <span className="text-muted-foreground/40 text-[10px]">{offerCampIds.size}</span>
        <span>→</span>
        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono">offer_id</span>
        <span className="text-muted-foreground/40 text-[10px]">{offerNodes.length}</span>
      </div>

      {/* Graph canvas */}
      <div className="flex-1 min-h-0 relative rounded-xl border border-border/50 overflow-hidden">
        {relayoutedNodes.length > 0 ? (
          <ChainCanvas
            nodes={relayoutedNodes}
            edges={relayoutedEdges}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            No campaign connections found for this ad_campaign_id in the selected period.
          </div>
        )}
        {selectedNode && (
          <DetailPanel node={selectedNode} onClose={() => setSelectedNodeId(null)} />
        )}
        <DrilldownLegend />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ChainGraph() {
  const [preset, setPreset] = useState<Preset>('30d')
  const [refreshKey, setRefreshKey] = useState(0)
  const [data, setData] = useState<ChainData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null)

  const { from, to } = useMemo(() => getRange(preset), [preset])

  useEffect(() => {
    setLoading(true)
    setError(false)
    setSelectedAdId(null)
    const qs = new URLSearchParams({ from, to }).toString()
    fetch(`/api/analytics/chain?${qs}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<ChainData> })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [from, to, refreshKey])

  if (loading) {
    return (
      <div className="flex flex-col gap-3 h-full">
        <div className="flex gap-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-7 w-24" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Failed to load data. Check Keitaro service.
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Top controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Presets */}
        <div className="flex gap-1 p-0.5 rounded-lg border border-border/50 bg-card/30">
          {PRESETS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setPreset(key); setSelectedAdId(null) }}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                preset === key
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {selectedAdId ? (
          <DrilldownView
            adId={selectedAdId}
            data={data}
            onBack={() => setSelectedAdId(null)}
          />
        ) : (
          <AdCampaignListView data={data} onSelect={setSelectedAdId} />
        )}
      </div>
    </div>
  )
}
