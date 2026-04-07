"use client"

import { useState, useCallback, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { RefreshCw, ChevronRight, ArrowLeft, TrendingUp, TrendingDown, Minus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/i18n'
import type { GraphResponse, GraphNode, EnrichedCampaign, KeitaroDashboardResponse, CampaignStatus } from '@aap/types'

const GraphCanvas = dynamic(() => import('./graph-canvas'), { ssr: false })

// ─── Date helpers ──────────────────────────────────────────────────────────────
type DatePreset = 'this_month' | 'last_month' | '7d' | '30d' | '90d' | 'custom'

function fmtDate(d: Date) { return d.toISOString().split('T')[0] }

function presetRange(preset: Exclude<DatePreset, 'custom'>): { from: string; to: string } {
  const today = new Date()
  switch (preset) {
    case 'this_month':
      return { from: fmtDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmtDate(today) }
    case 'last_month': {
      const f = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      return { from: fmtDate(f), to: fmtDate(new Date(today.getFullYear(), today.getMonth(), 0)) }
    }
    case '7d':  { const f = new Date(today); f.setDate(f.getDate() - 7);  return { from: fmtDate(f), to: fmtDate(today) } }
    case '30d': { const f = new Date(today); f.setDate(f.getDate() - 30); return { from: fmtDate(f), to: fmtDate(today) } }
    case '90d': { const f = new Date(today); f.setDate(f.getDate() - 90); return { from: fmtDate(f), to: fmtDate(today) } }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt$(v: number) {
  if (v === 0) return '$0'
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`
  return `$${v.toFixed(0)}`
}

const TYPE_META: Record<string, { badge: string; cls: string }> = {
  offer:         { badge: '🟢 Offer',        cls: 'bg-green-100  text-green-800  dark:bg-green-900/40  dark:text-green-300'  },
  app:           { badge: '🟠 App/PWA',       cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  cloak:         { badge: '🟡 Cloak',         cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
  funnel_owner:  { badge: '🟦 Funnel Owner',  cls: 'bg-blue-100   text-blue-800   dark:bg-blue-900/40   dark:text-blue-300'   },
  offer_manager: { badge: '🟩 Offer Mgr',     cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  default_app:   { badge: '🟨 Default App',   cls: 'bg-amber-100  text-amber-800  dark:bg-amber-900/40  dark:text-amber-300'  },
  unknown:       { badge: '⚪ Unknown',        cls: 'bg-gray-100   text-gray-600   dark:bg-gray-800      dark:text-gray-400'   },
}

// ─── Date range picker (shared) ──────────────────────────────────────────────
type TFn = (key: import('@/lib/i18n').TranslationKey) => string

const PRESET_KEYS: Record<DatePreset, import('@/lib/i18n').TranslationKey> = {
  this_month: 'graph.this_month', last_month: 'graph.last_month',
  '7d': 'graph.7d', '30d': 'graph.30d', '90d': 'graph.90d', custom: 'graph.custom',
}

interface DateRangePickerProps {
  t: TFn
  datePreset: DatePreset
  dateFrom: string; dateTo: string
  customFrom: string; customTo: string
  onPreset: (p: DatePreset) => void
  onCustomFrom: (v: string) => void
  onCustomTo: (v: string) => void
  onApply: () => void
}
function DateRangePicker({ t, datePreset, dateFrom, dateTo, customFrom, customTo, onPreset, onCustomFrom, onCustomTo, onApply }: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide shrink-0">{t('graph.period')}</span>
      {(['this_month', 'last_month', '7d', '30d', '90d', 'custom'] as DatePreset[]).map(p => (
        <button key={p} onClick={() => onPreset(p)} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
          datePreset === p
            ? 'border-foreground/40 bg-accent text-foreground font-medium'
            : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
        }`}>{t(PRESET_KEYS[p])}</button>
      ))}
      {datePreset === 'custom' && (
        <div className="flex items-center gap-1.5 ml-1">
          <input type="date" value={customFrom} max={customTo || undefined} onChange={e => onCustomFrom(e.target.value)}
            className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground w-[130px]" />
          <span className="text-muted-foreground text-xs">—</span>
          <input type="date" value={customTo} min={customFrom || undefined} onChange={e => onCustomTo(e.target.value)}
            className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground w-[130px]" />
          <button onClick={onApply} disabled={!customFrom || !customTo || customFrom > customTo}
            className="text-xs px-3 py-1 rounded border border-foreground/30 bg-accent text-foreground font-medium hover:bg-accent/80 disabled:opacity-40 transition-colors">
            {t('graph.apply')}
          </button>
        </div>
      )}
      {datePreset !== 'custom' && (
        <span className="text-[10px] text-muted-foreground ml-1 font-mono">{dateFrom} — {dateTo}</span>
      )}
    </div>
  )
}

// ─── Campaign card ────────────────────────────────────────────────────────────
function CampaignCard({ c, onClick }: { c: EnrichedCampaign; onClick: () => void }) {
  const meta = TYPE_META[c.campaignType] ?? TYPE_META['unknown']
  const roi = c.stats.roi
  const RoiIcon = roi > 0 ? TrendingUp : roi < -10 ? TrendingDown : Minus
  const roiCls = roi > 0 ? 'text-green-600 dark:text-green-400' : roi < -10 ? 'text-red-500' : 'text-muted-foreground'

  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-xl border bg-background hover:border-blue-400 hover:shadow-md transition-all p-4 space-y-2.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold leading-tight line-clamp-2 flex-1" title={c.name}>{c.name}</div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 shrink-0 mt-0.5 transition-colors" />
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${meta.cls}`}>{meta.badge}</span>
        {c.state !== 'active' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">{c.state}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Клики</span>
          <span className="font-medium">{c.stats.clicks.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Конв.</span>
          <span className="font-medium">{c.stats.conversions.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Revenue</span>
          <span className="font-medium">{fmt$(c.stats.revenue)}</span>
        </div>
        <div className="flex justify-between items-center gap-1">
          <span className="text-muted-foreground">ROI</span>
          <span className={`font-semibold flex items-center gap-0.5 ${roiCls}`}>
            <RoiIcon className="h-3 w-3" />{roi.toFixed(0)}%
          </span>
        </div>
      </div>
    </button>
  )
}

// ─── Node stats panel ─────────────────────────────────────────────────────────
function geoFlagPanel(code: string): string {
  if (!code || code.length !== 2) return ''
  return code.toUpperCase().split('').map(c => String.fromCodePoint(0x1F1A5 + c.charCodeAt(0))).join('')
}

function NodeStatsPanel({ node }: { node: GraphNode }) {
  const { data } = node
  const typeLabel = data.type === 'stream' ? 'Поток' : 'Оффер'

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">{typeLabel}</div>
        <div className="text-sm font-semibold break-words">
          {data.type === 'offer' && data.offerBrand ? data.offerBrand : data.label}
        </div>
      </div>

      {/* Stream meta */}
      {data.type === 'stream' && (
        <div className="flex flex-wrap gap-1 text-[10px]">
          {data.schema && <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">{data.schema}</span>}
          {data.weight !== undefined && <span className="px-1.5 py-0.5 rounded bg-muted">вес {data.weight}%</span>}
          {data.streamStatus && <span className="px-1.5 py-0.5 rounded bg-muted">{data.streamStatus}</span>}
        </div>
      )}

      {/* Offer profile meta */}
      {data.type === 'offer' && (data.offerGeo || data.offerLandingType || data.offerConvAction || data.offerNetwork || data.offerBonus) && (
        <div className="space-y-1.5 rounded-lg bg-muted/30 p-2.5 text-[10px]">
          {(data.offerGeo || data.offerSource) && (
            <div className="flex items-center gap-2 flex-wrap">
              {data.offerGeo && <span className="font-mono">{geoFlagPanel(data.offerGeo)} {data.offerGeo}</span>}
              {data.offerSource && <span className="text-muted-foreground">· {data.offerSource}</span>}
            </div>
          )}
          {(data.offerLandingType || data.offerConvAction) && (
            <div className="flex items-center gap-1 flex-wrap">
              {data.offerLandingType && (
                <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium">
                  {data.offerLandingType}{data.offerTier ? ` ${data.offerTier}` : ''}
                </span>
              )}
              {data.offerConvAction && (
                <span className="px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-medium">
                  {data.offerConvAction}
                </span>
              )}
              {data.offerPayoutUpsell && (
                <span className="px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-medium">upsell</span>
              )}
            </div>
          )}
          {data.offerNetwork && (
            <div className="text-muted-foreground truncate" title={data.offerNetwork}>{data.offerNetwork}</div>
          )}
          {data.offerBonus && (
            <div className="text-green-700 dark:text-green-400">🎁 {data.offerBonus}</div>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {[
          ['Клики', data.clicks.toLocaleString()],
          ['Конверсии', data.conversions.toLocaleString()],
          ['Revenue', fmt$(data.revenue)],
          ['Profit', fmt$(data.profit)],
          ['ROI', `${data.roi.toFixed(0)}%`],
          ['CR', `${data.cr.toFixed(1)}%`],
          ['CPA', fmt$(data.cpa)],
          ['Cost', fmt$(data.cost)],
        ].map(([label, value]) => (
          <div key={label}>
            <div className="text-[10px] text-muted-foreground">{label}</div>
            <div className="font-medium">{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Campaign filter helpers ──────────────────────────────────────────────────
type SortBy = 'default' | 'clicks' | 'roi' | 'profit'
type FilterStatus = 'all' | CampaignStatus

function matchesSearch(name: string, query: string): boolean {
  if (!query.trim()) return true
  const q = query.trim().toLowerCase()
  return name.split('|').some(seg => seg.trim().toLowerCase().includes(q))
}

function extractSegments(campaigns: EnrichedCampaign[]): string[] {
  const freq = new Map<string, number>()
  for (const c of campaigns) {
    for (const seg of c.name.split('|').map(s => s.trim()).filter(Boolean)) {
      freq.set(seg, (freq.get(seg) ?? 0) + 1)
    }
  }
  return [...freq.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([seg]) => seg)
}

// ─── Filter bar ───────────────────────────────────────────────────────────────
interface CampaignFiltersProps {
  t: TFn
  campaigns: EnrichedCampaign[]
  searchQuery: string
  filterStatus: FilterStatus
  sortBy: SortBy
  shownCount: number
  onSearch: (v: string) => void
  onStatus: (v: FilterStatus) => void
  onSort: (v: SortBy) => void
}

function CampaignFilters({ t, campaigns, searchQuery, filterStatus, sortBy, shownCount, onSearch, onStatus, onSort }: CampaignFiltersProps) {
  const segments = useMemo(() => extractSegments(campaigns), [campaigns])
  const STATUS_FILTERS: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: t('graph.filter_all') },
    { key: 'success', label: t('graph.filter_success') },
    { key: 'failed', label: t('graph.filter_failed') },
    { key: 'decision', label: t('graph.filter_decision') },
  ]
  const SORT_OPTIONS: { key: SortBy; label: string }[] = [
    { key: 'clicks', label: t('graph.sort_clicks') },
    { key: 'roi',    label: t('graph.sort_roi') },
    { key: 'profit', label: t('graph.sort_profit') },
  ]
  return (
    <div className="space-y-2">
      {/* Row 1: search + status + sort */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search input */}
        <div className="relative flex-1 min-w-[180px] max-w-[320px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
            placeholder={t('graph.search_placeholder')}
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {searchQuery && (
            <button onClick={() => onSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {/* Status filter */}
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onStatus(key)}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                filterStatus === key
                  ? 'bg-accent text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >{label}</button>
          ))}
        </div>
        {/* Sort */}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide shrink-0">↕</span>
          {SORT_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onSort(sortBy === key ? 'default' : key)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                sortBy === key
                  ? 'border-foreground/40 bg-accent text-foreground font-medium'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >{label}</button>
          ))}
        </div>
        {/* Count */}
        {campaigns.length > 0 && (
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
            {t('graph.shown_n').replace('{n}', String(shownCount)).replace('{total}', String(campaigns.length))}
          </span>
        )}
      </div>
      {/* Row 2: segment tags */}
      {segments.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide shrink-0">{t('graph.segments')}</span>
          {segments.map(seg => (
            <button
              key={seg}
              onClick={() => onSearch(searchQuery === seg ? '' : seg)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors font-mono ${
                searchQuery === seg
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                  : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
              }`}
            >{seg}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
type Level = 'campaigns' | 'campaign-graph'

export function GraphDashboard() {
  const { t } = useLanguage()
  // Date range
  const initial = presetRange('this_month')
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month')
  const [dateFrom,   setDateFrom]   = useState(initial.from)
  const [dateTo,     setDateTo]     = useState(initial.to)
  const [customFrom, setCustomFrom] = useState(initial.from)
  const [customTo,   setCustomTo]   = useState(initial.to)

  const handlePreset = useCallback((p: DatePreset) => {
    setDatePreset(p)
    if (p !== 'custom') { const r = presetRange(p); setDateFrom(r.from); setDateTo(r.to); setCustomFrom(r.from); setCustomTo(r.to) }
  }, [])
  const applyCustom = useCallback(() => {
    if (customFrom && customTo && customFrom <= customTo) { setDateFrom(customFrom); setDateTo(customTo) }
  }, [customFrom, customTo])

  // Navigation
  const [level,             setLevel]             = useState<Level>('campaigns')
  const [selectedCampaign,  setSelectedCampaign]  = useState<EnrichedCampaign | null>(null)

  // Level 1: campaign list + filters
  const [campaigns,         setCampaigns]         = useState<EnrichedCampaign[]>([])
  const [campaignsLoading,  setCampaignsLoading]  = useState(true)
  const [campaignsRefreshing, setCampaignsRefreshing] = useState(false)
  const [searchQuery,       setSearchQuery]       = useState('')
  const [filterStatus,      setFilterStatus]      = useState<FilterStatus>('all')
  const [sortBy,            setSortBy]            = useState<SortBy>('default')

  const filteredCampaigns = useMemo(() => {
    let list = campaigns
    if (searchQuery) list = list.filter(c => matchesSearch(c.name, searchQuery))
    if (filterStatus !== 'all') list = list.filter(c => c.status === filterStatus)
    if (sortBy === 'clicks')  list = [...list].sort((a, b) => b.stats.clicks - a.stats.clicks)
    if (sortBy === 'roi')     list = [...list].sort((a, b) => b.stats.roi - a.stats.roi)
    if (sortBy === 'profit')  list = [...list].sort((a, b) => b.stats.profit - a.stats.profit)
    return list
  }, [campaigns, searchQuery, filterStatus, sortBy])

  // Level 2: campaign graph
  const [graphData,         setGraphData]         = useState<GraphResponse | null>(null)
  const [graphLoading,      setGraphLoading]       = useState(false)
  const [selectedNodeId,    setSelectedNodeId]    = useState<string | null>(null)
  const [selectedNode,      setSelectedNode]      = useState<GraphNode | null>(null)

  // ── Load campaign list ────────────────────────────────────────────────────
  const loadCampaigns = useCallback(async (bust = false) => {
    if (bust) {
      setCampaignsRefreshing(true)
      await fetch('/api/analytics/campaigns', { method: 'POST' })
    } else {
      setCampaignsLoading(true)
    }
    try {
      const res = await fetch(`/api/analytics/campaigns?from=${dateFrom}&to=${dateTo}`)
      const json: KeitaroDashboardResponse = await res.json()
      setCampaigns(json.campaigns ?? [])
    } finally {
      setCampaignsLoading(false)
      setCampaignsRefreshing(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    if (level === 'campaigns') loadCampaigns()
  }, [level, loadCampaigns])

  // ── Drill into campaign graph ─────────────────────────────────────────────
  const openCampaign = useCallback(async (c: EnrichedCampaign) => {
    setSelectedCampaign(c)
    setLevel('campaign-graph')
    setGraphData(null)
    setSelectedNodeId(null)
    setSelectedNode(null)
    setGraphLoading(true)
    try {
      const res = await fetch(`/api/analytics/graph/campaign/${c.id}?from=${dateFrom}&to=${dateTo}`)
      const json: GraphResponse = await res.json()
      setGraphData(json)
    } finally {
      setGraphLoading(false)
    }
  }, [dateFrom, dateTo])

  const goBack = useCallback(() => {
    setLevel('campaigns')
    setSelectedCampaign(null)
    setGraphData(null)
    setSelectedNodeId(null)
    setSelectedNode(null)
    setSearchQuery('')
    setFilterStatus('all')
    setSortBy('default')
  }, [])

  const handleSelectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id)
    setSelectedNode(id && graphData ? (graphData.nodes.find(n => n.id === id) ?? null) : null)
  }, [graphData])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full gap-3">
      {/* Date picker + controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <DateRangePicker
          t={t}
          datePreset={datePreset} dateFrom={dateFrom} dateTo={dateTo}
          customFrom={customFrom} customTo={customTo}
          onPreset={handlePreset} onCustomFrom={setCustomFrom} onCustomTo={setCustomTo} onApply={applyCustom}
        />
        <div className="ml-auto">
          {level === 'campaigns' && (
            <Button variant="outline" size="sm" onClick={() => loadCampaigns(true)} disabled={campaignsRefreshing} className="gap-2">
              <RefreshCw className={`h-3.5 w-3.5 ${campaignsRefreshing ? 'animate-spin' : ''}`} />
              {t('graph.refresh')}
            </Button>
          )}
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm">
        {level === 'campaigns' ? (
          <span className="font-medium text-foreground">{t('graph.all_campaigns')}</span>
        ) : (
          <>
            <button onClick={goBack} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{t('graph.all_campaigns')}</span>
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium text-foreground truncate max-w-[300px]" title={selectedCampaign?.name}>
              {selectedCampaign?.name}
            </span>
          </>
        )}
      </div>

      {/* ── LEVEL 1: Campaign grid ── */}
      {level === 'campaigns' && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
          {campaignsLoading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <CampaignFilters
                t={t}
                campaigns={campaigns}
                searchQuery={searchQuery}
                filterStatus={filterStatus}
                sortBy={sortBy}
                shownCount={filteredCampaigns.length}
                onSearch={setSearchQuery}
                onStatus={setFilterStatus}
                onSort={setSortBy}
              />
              {filteredCampaigns.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                  {t('status.no_data')}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredCampaigns.map(c => (
                    <CampaignCard key={c.id} c={c} onClick={() => openCampaign(c)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── LEVEL 2: Campaign graph (streams → offers) ── */}
      {level === 'campaign-graph' && (
        <div className="flex flex-1 gap-3 min-h-0">
          {/* Canvas */}
          <div className="flex-1 rounded-xl border bg-muted/10 h-[calc(100vh-200px)] relative overflow-hidden">
            {graphLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="h-7 w-7 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{t('graph.loading')}</span>
              </div>
            ) : graphData && graphData.nodes.length > 0 ? (
              <>
                <div className="absolute top-3 left-3 z-10 flex items-center gap-4 text-[10px] text-muted-foreground bg-background/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500/80" />
                    {graphData.meta?.totalStreams && graphData.meta.totalStreams > (graphData.meta.shownStreams ?? 0)
                      ? t('graph.top_n_streams').replace('{n}', String(graphData.meta.shownStreams)).replace('{total}', String(graphData.meta.totalStreams))
                      : t('graph.streams_count').replace('{n}', String(graphData.nodes.filter(n => n.type === 'stream').length))}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500/80" />
                    {t('graph.offers_count').replace('{n}', String(graphData.nodes.filter(n => n.type === 'offer').length))}
                  </span>
                  <span className="text-muted-foreground/60">{t('graph.click_to_filter')}</span>
                </div>
                <GraphCanvas
                  nodes={graphData.nodes}
                  edges={graphData.edges}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={handleSelectNode}
                />
              </>
            ) : graphData?.error ? (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300 max-w-md">
                  <b>Ошибка:</b> {graphData.error}
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                {t('graph.no_data')}
              </div>
            )}
          </div>

          {/* Stats panel for selected node */}
          {selectedNode && (
            <div className="w-64 shrink-0 rounded-xl border bg-background p-4 overflow-y-auto">
              <NodeStatsPanel node={selectedNode} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
