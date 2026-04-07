"use client"

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useVirtualizer } from '@tanstack/react-virtual'
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, Search, X, ChevronUp, ChevronDown, ChevronsUpDown, ExternalLink } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

type Signal  = 'STOP' | 'WATCH' | 'OK' | 'NEW'
type GroupBy = 'ad_campaign_id' | 'offer_id'

interface Campaign {
  groupKey:       string
  groupName:      string | null
  clicks:         number
  adSpend:        number
  techCost:       number
  totalCost:      number
  leads:          number
  ftds:           number
  revenue:        number
  revenuePending: number
  revenueTotal:   number
  profit:         number
  profitTotal:    number
  roi:            number | null
  roiTotal:       number | null
  cpl:            number | null
  cpa:            number | null
  cpc:            number
  cvr:            number | null
  buyerId:        string | null
  buyerName:      string | null
  signal:         Signal
}

interface Totals {
  campaigns:    number
  totalSpend:   number
  totalRevenue: number
  totalPending: number
  totalProfit:  number
  totalFtds:    number
  stopCount:    number
  watchCount:   number
  okCount:      number
}

interface AdPerfData {
  campaigns: Campaign[]
  totals:    Totals
  period:    { from: string; to: string }
  groupBy:   GroupBy
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}k`
  return String(Math.round(v))
}
function fmtMoney(v: number, short = false): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (short) {
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
    if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}k`
    return `${sign}$${abs.toFixed(0)}`
  }
  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}
function fmtDate(d: Date): string { return d.toISOString().split('T')[0] }

type Preset = '7d' | '14d' | '30d' | '90d'
const PRESETS: { key: Preset; label: string }[] = [
  { key: '7d',  label: '7d'  },
  { key: '14d', label: '14d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
]
function getRange(p: Preset): { from: string; to: string } {
  const today = new Date()
  const days = p === '7d' ? 7 : p === '14d' ? 14 : p === '30d' ? 30 : 90
  return { from: fmtDate(new Date(today.getTime() - days * 86400000)), to: fmtDate(today) }
}

// ─── Signal badge ─────────────────────────────────────────────────────────────

const SIGNAL_META: Record<Signal, { icon: React.ElementType; label: string; cls: string; dot: string }> = {
  STOP:  { icon: AlertTriangle,  label: 'STOP',  cls: 'bg-red-500/15 text-red-400 border-red-500/30',         dot: 'bg-red-500'    },
  WATCH: { icon: Clock,          label: 'WATCH', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', dot: 'bg-yellow-400' },
  OK:    { icon: CheckCircle,    label: 'OK',    cls: 'bg-green-500/15 text-green-400 border-green-500/30',    dot: 'bg-green-400'  },
  NEW:   { icon: ChevronsUpDown, label: 'NEW',   cls: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',       dot: 'bg-zinc-500'   },
}

function SignalBadge({ signal }: { signal: Signal }) {
  const m = SIGNAL_META[signal]
  const Icon = m.icon
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide ${m.cls}`}>
      <Icon className="h-2.5 w-2.5" />
      {m.label}
    </span>
  )
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

interface SparkPoint { day: string; spend: number; profit: number }

function SparklineChart({ points }: { points: SparkPoint[] | undefined }) {
  if (!points || points.length < 2) {
    return <span className="text-muted-foreground/20 text-[9px]">—</span>
  }

  const W = 112, H = 30, PAD = 2

  const spends  = points.map(p => p.spend)
  const profits = points.map(p => p.profit)
  const allVals = [...spends, ...profits]
  const minV    = Math.min(...allVals)
  const maxV    = Math.max(...allVals)
  const range   = maxV - minV || 1

  const n = points.length
  const px = (i: number) => PAD + (i / (n - 1)) * (W - PAD * 2)
  const py = (v: number) => PAD + (1 - (v - minV) / range) * (H - PAD * 2)

  const toPath = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')

  // zero line y-position (only if range crosses zero)
  const zeroY = minV < 0 && maxV > 0 ? py(0) : null

  const lastProfit  = profits[profits.length - 1]
  const profitColor = lastProfit >= 0 ? 'rgb(74 222 128 / 0.75)' : 'rgb(248 113 113 / 0.75)'

  return (
    <svg width={W} height={H} className="overflow-visible shrink-0">
      {zeroY !== null && (
        <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY}
          stroke="rgb(255 255 255 / 0.08)" strokeWidth="0.8" strokeDasharray="2 2"/>
      )}
      <path d={toPath(spends)}  fill="none" stroke="rgb(251 146 60 / 0.55)" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round"/>
      <path d={toPath(profits)} fill="none" stroke={profitColor}             strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

type SortKey = 'totalCost' | 'profit' | 'profitTotal' | 'roi' | 'roiTotal' | 'ftds' | 'cpa' | 'clicks' | 'revenue' | 'cvr'

function SortIcon({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: 'asc' | 'desc' }) {
  if (col !== sortKey) return <ChevronsUpDown className="h-3 w-3 opacity-30" />
  return dir === 'desc' ? <ChevronDown className="h-3 w-3 text-indigo-400" /> : <ChevronUp className="h-3 w-3 text-indigo-400" />
}

// ─── Column widths (must match between th and td since tbody uses display:block) ─

const CW = {
  signal:      'w-[90px]  min-w-[90px]',
  key:         'w-[200px] min-w-[200px]',
  name:        'w-[160px] min-w-[160px]',
  clicks:      'w-[72px]  min-w-[72px]',
  spend:       'w-[85px]  min-w-[85px]',
  leads:       'w-[62px]  min-w-[62px]',
  ftds:        'w-[62px]  min-w-[62px]',
  buyer:       'w-[100px] min-w-[100px]',
  cvr:         'w-[65px]  min-w-[65px]',
  spark:       'w-[120px] min-w-[120px]',
  revFact:     'w-[82px]  min-w-[82px]',
  revEst:      'w-[78px]  min-w-[78px]',
  profit:      'w-[85px]  min-w-[85px]',
  roi:         'w-[82px]  min-w-[82px]',
  cpl:         'w-[60px]  min-w-[60px]',
  cpa:         'w-[60px]  min-w-[60px]',
}

function SortTh({ label, col, sortKey, dir, onSort, cw }: {
  label: string; col: SortKey; sortKey: SortKey; dir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
  cw: string
}) {
  return (
    <th className={`text-right px-2 py-2 font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground select-none ${cw}`}
      onClick={() => onSort(col)}>
      <span className="inline-flex items-center gap-0.5 justify-end">
        {label}
        <SortIcon col={col} sortKey={sortKey} dir={dir} />
      </span>
    </th>
  )
}

// ─── ROI cell ─────────────────────────────────────────────────────────────────

function RoiCell({ roi, pending }: { roi: number | null; pending?: number | null }) {
  if (roi === null) return <span className="text-muted-foreground">—</span>
  const color = roi >= 20 ? 'text-green-400' : roi >= 0 ? 'text-emerald-300' : roi >= -30 ? 'text-yellow-400' : 'text-red-400'
  const Icon = roi >= 0 ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${color}`}>
      <Icon className="h-3 w-3" />{roi.toFixed(1)}%
      {pending !== undefined && pending !== null && pending !== roi && (
        <span className="text-[9px] text-muted-foreground ml-0.5">({pending > 0 ? '+' : ''}{pending.toFixed(0)}%)</span>
      )}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdPerformance() {
  const router = useRouter()
  const [preset, setPreset]         = useState<Preset>('30d')
  const [groupBy, setGroupBy]       = useState<GroupBy>('ad_campaign_id')
  const [refreshKey, setRefreshKey] = useState(0)
  const [data, setData]             = useState<AdPerfData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(false)

  const [search, setSearch]             = useState('')
  const [signalFilter, setSignalFilter] = useState<Signal | 'all'>('all')
  const [sortKey, setSortKey]           = useState<SortKey>('totalCost')
  const [sortDir, setSortDir]           = useState<'asc' | 'desc'>('desc')
  const [sparklines, setSparklines]     = useState<Record<string, SparkPoint[]>>({})

  const { from, to } = useMemo(() => getRange(preset), [preset])

  useEffect(() => {
    setSparklines({})
    const qs = new URLSearchParams({ from, to, group_by: groupBy }).toString()
    fetch(`/api/analytics/ad-performance/sparklines?${qs}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSparklines(d) })
      .catch(() => {})
  }, [from, to, groupBy, refreshKey])

  useEffect(() => {
    setLoading(true); setError(false)
    const qs = new URLSearchParams({ from, to, min_spend: '500', group_by: groupBy }).toString()
    fetch(`/api/analytics/ad-performance?${qs}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<AdPerfData> })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [from, to, groupBy, refreshKey])

  function handleSort(k: SortKey) {
    if (k === sortKey) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(k); setSortDir('desc') }
  }

  const filtered = useMemo(() => {
    if (!data) return []
    let list = data.campaigns
    if (signalFilter !== 'all') list = list.filter(c => c.signal === signalFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(c =>
        c.groupKey.toLowerCase().includes(q) ||
        (c.groupName?.toLowerCase().includes(q) ?? false) ||
        (c.buyerName?.toLowerCase().includes(q) ?? false) ||
        (c.buyerId?.toLowerCase().includes(q) ?? false)
      )
    }
    return [...list].sort((a, b) => {
      let av: number, bv: number
      if (sortKey === 'roi')           { av = a.roi      ?? -9999; bv = b.roi      ?? -9999 }
      else if (sortKey === 'roiTotal') { av = a.roiTotal ?? -9999; bv = b.roiTotal ?? -9999 }
      else if (sortKey === 'cpa')      { av = a.cpa      ?? 9999;  bv = b.cpa      ?? 9999  }
      else if (sortKey === 'cvr')      { av = a.cvr      ?? -1;    bv = b.cvr      ?? -1    }
      else                             { av = a[sortKey] as number; bv = b[sortKey] as number }
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [data, signalFilter, search, sortKey, sortDir])

  const tableRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => tableRef.current,
    estimateSize: () => 36,
    overscan: 15,
  })

  if (loading) return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2"><Skeleton className="h-8 w-64"/><Skeleton className="h-8 w-32"/></div>
      <div className="grid grid-cols-4 gap-3">{Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-20"/>)}</div>
      <Skeleton className="h-96"/>
    </div>
  )
  if (error) return (
    <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
      Failed to load ad performance data.
    </div>
  )
  if (!data) return null

  const { totals } = data
  const overallRoi = totals.totalSpend > 0
    ? ((totals.totalRevenue - totals.totalSpend) / totals.totalSpend * 100)
    : 0
  const overallRoiTotal = totals.totalSpend > 0
    ? ((totals.totalRevenue + totals.totalPending - totals.totalSpend) / totals.totalSpend * 100)
    : 0

  const keyLabel = groupBy === 'offer_id' ? 'offer_id' : 'ad_campaign_id'

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* ── Controls ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">

        {/* Group by toggle */}
        <div className="flex gap-1 p-0.5 rounded-lg border border-border/50 bg-card/30">
          {(['ad_campaign_id', 'offer_id'] as GroupBy[]).map(g => (
            <button key={g} onClick={() => setGroupBy(g)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                groupBy === g
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}>
              {g === 'ad_campaign_id' ? 'Ad Campaign' : 'Offer'}
            </button>
          ))}
        </div>

        {/* Presets */}
        <div className="flex gap-1 p-0.5 rounded-lg border border-border/50 bg-card/30">
          {PRESETS.map(({ key, label }) => (
            <button key={key} onClick={() => setPreset(key)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                preset === key
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}>{label}</button>
          ))}
        </div>

        {/* Signal filter */}
        <div className="flex gap-1 p-0.5 rounded-lg border border-border/50 bg-card/30">
          {(['all', 'STOP', 'WATCH', 'OK', 'NEW'] as const).map(sig => {
            const count = sig === 'all' ? data.campaigns.length
              : data.campaigns.filter(c => c.signal === sig).length
            const active = signalFilter === sig
            const meta = sig !== 'all' ? SIGNAL_META[sig] : null
            return (
              <button key={sig} onClick={() => setSignalFilter(sig)}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors flex items-center gap-1 ${
                  active ? 'bg-accent text-foreground border border-foreground/20' : 'text-muted-foreground hover:text-foreground'
                }`}>
                {meta && <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`}/>}
                {sig === 'all' ? `All (${count})` : `${sig} (${count})`}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative min-w-[180px] max-w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none"/>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${keyLabel}, buyer…`}
            className="w-full pl-7 pr-6 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"/>
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3"/>
            </button>
          )}
        </div>

        <button onClick={() => setRefreshKey(k => k + 1)}
          className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="h-4 w-4"/>
        </button>
        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
          {filtered.length} / {data.campaigns.length}
        </span>
      </div>

      {/* ── Summary cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        <SummaryCard label="Total Spend" value={fmtMoney(totals.totalSpend, true)} sub={`${fmt(totals.campaigns)} ${groupBy === 'offer_id' ? 'offers' : 'campaigns'}`} color="text-foreground"/>
        <SummaryCard label="Revenue (approved)" value={fmtMoney(totals.totalRevenue, true)}
          sub={`+${fmtMoney(totals.totalPending, true)} pending`} color="text-blue-400"/>
        <SummaryCard label="Profit (est.)" value={fmtMoney(totals.totalRevenue + totals.totalPending - totals.totalSpend, true)}
          sub={`ROI ${overallRoi.toFixed(1)}% fact · ${overallRoiTotal.toFixed(1)}% est`}
          color={(totals.totalRevenue + totals.totalPending - totals.totalSpend) >= 0 ? 'text-green-400' : 'text-red-400'}/>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[10px] text-muted-foreground mb-1.5">Signals</div>
          <div className="flex gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-xs">
              <span className="w-2 h-2 rounded-full bg-red-500"/>
              <span className="font-semibold text-red-400">{totals.stopCount}</span>
              <span className="text-muted-foreground">stop</span>
            </span>
            <span className="flex items-center gap-1 text-xs">
              <span className="w-2 h-2 rounded-full bg-yellow-400"/>
              <span className="font-semibold text-yellow-400">{totals.watchCount}</span>
              <span className="text-muted-foreground">watch</span>
            </span>
            <span className="flex items-center gap-1 text-xs">
              <span className="w-2 h-2 rounded-full bg-green-400"/>
              <span className="font-semibold text-green-400">{totals.okCount}</span>
              <span className="text-muted-foreground">ok</span>
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1.5">{fmt(totals.totalFtds)} total FTDs</div>
        </div>
      </div>

      {/* ── Legend ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 text-[9px] text-muted-foreground shrink-0 flex-wrap">
        <span><span className="text-red-400 font-bold">STOP</span> = ROI w/ pending &lt; -30%</span>
        <span><span className="text-yellow-400 font-bold">WATCH</span> = approved loss, pending may recover</span>
        <span><span className="text-green-400 font-bold">OK</span> = profitable on approved revenue</span>
        <span><span className="text-zinc-400 font-bold">NEW</span> = &lt;5 FTDs, insufficient data</span>
        <span className="w-px h-3 bg-border/50 mx-1"/>
        <span className="flex items-center gap-1">
          <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="rgb(251 146 60 / 0.7)" strokeWidth="1.5"/></svg>
          Spend
        </span>
        <span className="flex items-center gap-1">
          <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="rgb(74 222 128 / 0.75)" strokeWidth="1.5"/></svg>
          Profit (est.)
        </span>
        <span className="ml-auto font-mono">{data.period.from} — {data.period.to}</span>
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div ref={tableRef} className="flex-1 min-h-0 overflow-auto rounded-xl border border-border">
        <table className="w-full text-[11px] border-collapse table-fixed">
          <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border">
            <tr>
              <th className={`text-left px-3 py-2 font-medium text-muted-foreground ${CW.signal}`}>Signal</th>
              <th className={`text-left px-3 py-2 font-medium text-muted-foreground ${CW.key}`}>{keyLabel}</th>
              {groupBy === 'ad_campaign_id' && (
                <th className={`text-left px-2 py-2 font-medium text-muted-foreground ${CW.buyer}`}>Buyer</th>
              )}
              {groupBy === 'offer_id' && (
                <th className={`text-left px-2 py-2 font-medium text-muted-foreground ${CW.name}`}>Name</th>
              )}
              <SortTh label="Clicks"   col="clicks"      cw={CW.clicks}      sortKey={sortKey} dir={sortDir} onSort={handleSort}/>
              <SortTh label="Spend"    col="totalCost"   cw={CW.spend}       sortKey={sortKey} dir={sortDir} onSort={handleSort}/>
              <th className={`text-right px-2 py-2 font-medium text-muted-foreground ${CW.leads}`}>Leads</th>
              <SortTh label="FTDs"     col="ftds"        cw={CW.ftds}        sortKey={sortKey} dir={sortDir} onSort={handleSort}/>
              <SortTh label="CVR %"    col="cvr"         cw={CW.cvr}         sortKey={sortKey} dir={sortDir} onSort={handleSort}/>
              <SortTh label="Rev Fact" col="revenue"     cw={CW.revFact}     sortKey={sortKey} dir={sortDir} onSort={handleSort}/>
              <th className={`text-right px-2 py-2 font-medium text-muted-foreground whitespace-nowrap ${CW.revEst}`}>Rev Est</th>
              <SortTh label="Profit"   col="profitTotal"  cw={CW.profit}      sortKey={sortKey} dir={sortDir} onSort={handleSort}/>
              <SortTh label="ROI"      col="roiTotal"    cw={CW.roi}         sortKey={sortKey} dir={sortDir} onSort={handleSort}/>
              <th className={`text-right px-2 py-2 font-medium text-muted-foreground ${CW.cpl}`}>CPL</th>
              <SortTh label="CPA"      col="cpa"         cw={CW.cpa}         sortKey={sortKey} dir={sortDir} onSort={handleSort}/>
              <th className={`px-2 py-2 font-medium text-muted-foreground text-left ${CW.spark}`}>
                <span className="text-[9px] tracking-wide">Spend · Profit</span>
              </th>
              <th className="w-auto"/>
            </tr>
          </thead>
          <tbody style={{ height: `${rowVirtualizer.getTotalSize()}px`, display: 'block', position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const c = filtered[virtualRow.index]
              const rowBg = c.signal === 'STOP'  ? 'bg-red-500/5 hover:bg-red-500/10'
                : c.signal === 'OK'    ? 'bg-green-500/5 hover:bg-green-500/10'
                : c.signal === 'WATCH' ? 'bg-yellow-500/5 hover:bg-yellow-500/10'
                : 'hover:bg-accent/40'
              return (
                <tr key={c.groupKey}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  onClick={() => router.push(`/ad-performance/${groupBy === 'offer_id' ? 'offer' : 'campaign'}/${encodeURIComponent(c.groupKey)}`)}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
                  className={`border-b border-border/30 transition-colors cursor-pointer table table-fixed ${rowBg}`}>
                  <td className={`px-3 py-2 ${CW.signal}`}>
                    <SignalBadge signal={c.signal}/>
                  </td>
                  <td className={`px-3 py-2 ${CW.key}`}>
                    <span className="font-mono font-semibold text-foreground truncate block max-w-[160px]" title={c.groupKey}>
                      {c.groupKey}
                      <ExternalLink className="inline h-2.5 w-2.5 ml-1 opacity-0 group-hover:opacity-50 transition-opacity" />
                    </span>
                  </td>
                  {groupBy === 'ad_campaign_id' && (
                    <td className={`px-2 py-2 ${CW.buyer}`}>
                      <span
                        className="text-indigo-300/80 text-[10px] font-medium truncate block max-w-[88px]"
                        title={c.buyerId ? `#${c.buyerId}` : ''}
                      >
                        {c.buyerName ?? (c.buyerId ? `#${c.buyerId}` : '—')}
                      </span>
                    </td>
                  )}
                  {groupBy === 'offer_id' && (
                    <td className={`px-2 py-2 ${CW.name}`}>
                      <span className="text-muted-foreground truncate block max-w-[160px]" title={c.groupName ?? ''}>
                        {c.groupName ?? '—'}
                      </span>
                    </td>
                  )}
                  <td className={`text-right px-2 py-2 text-indigo-300 font-mono ${CW.clicks}`}>{fmt(c.clicks)}</td>
                  <td className={`text-right px-2 py-2 font-semibold ${CW.spend}`}>{fmtMoney(c.totalCost, true)}</td>
                  <td className={`text-right px-2 py-2 text-blue-300 ${CW.leads}`}>{fmt(c.leads)}</td>
                  <td className={`text-right px-2 py-2 font-semibold text-emerald-300 ${CW.ftds}`}>{fmt(c.ftds)}</td>
                  <td className={`text-right px-2 py-2 ${CW.cvr}`}>
                    {c.cvr != null ? (
                      <span className={
                        c.cvr >= 20 ? 'text-green-400 font-semibold' :
                        c.cvr >= 10 ? 'text-yellow-400' :
                        'text-muted-foreground'
                      }>{c.cvr.toFixed(1)}%</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className={`text-right px-2 py-2 ${CW.revFact}`}>
                    <span className="text-blue-400">{fmtMoney(c.revenue, true)}</span>
                  </td>
                  <td className={`text-right px-2 py-2 ${CW.revEst}`}>
                    <span className={c.revenuePending > 0 ? 'text-yellow-400/80' : 'text-muted-foreground'}>
                      {c.revenuePending > 0 ? fmtMoney(c.revenuePending, true) : '—'}
                    </span>
                  </td>
                  <td className={`text-right px-2 py-2 ${CW.profit}`}>
                    <span className={c.profitTotal >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                      {fmtMoney(c.profitTotal, true)}
                    </span>
                  </td>
                  <td className={`text-right px-2 py-2 ${CW.roi}`}>
                    <RoiCell roi={c.roiTotal}/>
                  </td>
                  <td className={`text-right px-2 py-2 text-muted-foreground ${CW.cpl}`}>
                    {c.cpl != null ? `$${c.cpl.toFixed(0)}` : '—'}
                  </td>
                  <td className={`text-right px-2 py-2 text-muted-foreground ${CW.cpa}`}>
                    {c.cpa != null ? `$${c.cpa.toFixed(0)}` : '—'}
                  </td>
                  <td className={`px-2 py-2 ${CW.spark}`}>
                    <SparklineChart points={sparklines[c.groupKey]}/>
                  </td>
                  <td className="w-auto"/>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No campaigns match the current filter.
          </div>
        )}
      </div>

    </div>
  )
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}
