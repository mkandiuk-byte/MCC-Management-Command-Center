"use client"

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle, Clock, ChevronsUpDown, TrendingUp, TrendingDown, RefreshCw, ArrowLeft } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ─── Types ────────────────────────────────────────────────────────────────────

type Signal  = 'STOP' | 'WATCH' | 'OK' | 'NEW'
type Preset  = '7d' | '14d' | '30d' | '90d'

interface DailyRow {
  date:           string
  buyer:          string | null
  clicks:         number
  adSpend:        number
  totalCost:      number
  leads:          number
  ftds:           number
  cvr:            number | null
  revenue:        number
  revenuePending: number
  revenueTotal:   number
  profit:         number
  profitTotal:    number
  roi:            number | null
  roiTotal:       number | null
  cpl:            number | null
  cpa:            number | null
}

interface BreakdownRow {
  key:            string
  name:           string | null
  buyer:          string | null
  clicks:         number
  adSpend:        number
  totalCost:      number
  leads:          number
  ftds:           number
  cvr:            number | null
  revenue:        number
  revenuePending: number
  revenueTotal:   number
  profit:         number
  profitTotal:    number
  roi:            number | null
  roiTotal:       number | null
  cpl:            number | null
  cpa:            number | null
  signal:         Signal
}

interface Totals {
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
  signal:         Signal
}

interface DetailData {
  id:        string
  name:      string | null
  groupBy:   'offer_id' | 'ad_campaign_id'
  period:    { from: string; to: string }
  totals:    Totals
  daily:     DailyRow[]
  breakdown: BreakdownRow[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}k`
  return String(Math.round(v))
}

function fmtMoney(v: number, short = false): string {
  const abs  = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (short) {
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
    if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}k`
    return `${sign}$${abs.toFixed(0)}`
  }
  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtDate(d: Date): string { return d.toISOString().split('T')[0] }

const PRESETS: { key: Preset; label: string }[] = [
  { key: '7d',  label: '7d'  },
  { key: '14d', label: '14d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
]

function getRange(p: Preset): { from: string; to: string } {
  const today = new Date()
  const days  = p === '7d' ? 7 : p === '14d' ? 14 : p === '30d' ? 30 : 90
  return { from: fmtDate(new Date(today.getTime() - days * 86400000)), to: fmtDate(today) }
}

// ─── Signal badge ─────────────────────────────────────────────────────────────

const SIGNAL_META: Record<Signal, { icon: React.ElementType; label: string; cls: string }> = {
  STOP:  { icon: AlertTriangle,  label: 'STOP',  cls: 'bg-red-500/15 text-red-400 border-red-500/30'          },
  WATCH: { icon: Clock,          label: 'WATCH', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  OK:    { icon: CheckCircle,    label: 'OK',    cls: 'bg-green-500/15 text-green-400 border-green-500/30'    },
  NEW:   { icon: ChevronsUpDown, label: 'NEW',   cls: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'       },
}

function SignalBadge({ signal }: { signal: Signal }) {
  const m    = SIGNAL_META[signal]
  const Icon = m.icon
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide ${m.cls}`}>
      <Icon className="h-2.5 w-2.5" />
      {m.label}
    </span>
  )
}

// ─── ROI cell ─────────────────────────────────────────────────────────────────

function RoiCell({ roi }: { roi: number | null }) {
  if (roi === null) return <span className="text-muted-foreground">—</span>
  const color = roi >= 20 ? 'text-green-400' : roi >= 0 ? 'text-emerald-300' : roi >= -30 ? 'text-yellow-400' : 'text-red-400'
  const Icon  = roi >= 0 ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${color}`}>
      <Icon className="h-3 w-3" />{roi.toFixed(1)}%
    </span>
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

// ─── Th helper ────────────────────────────────────────────────────────────────

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`${right ? 'text-right' : 'text-left'} px-2 py-2 font-medium text-muted-foreground whitespace-nowrap`}>
      {children}
    </th>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AdPerformanceDetailProps {
  type: 'offer' | 'campaign'
  id:   string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdPerformanceDetail({ type, id }: AdPerformanceDetailProps) {
  const router = useRouter()
  const [preset, setPreset]       = useState<Preset>('30d')
  const [data, setData]           = useState<DetailData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [analysis, setAnalysis]   = useState('')
  const [streaming, setStreaming] = useState(false)
  const [analyzeErr, setAnalyzeErr] = useState(false)

  const { from, to } = useMemo(() => getRange(preset), [preset])

  const groupBy = type === 'offer' ? 'offer_id' : 'ad_campaign_id'

  // ── Fetch detail data ──────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true)
    setError(null)
    setData(null)
    setAnalysis('')
    setAnalyzeErr(false)

    const qs = new URLSearchParams({ id, group_by: groupBy, from, to }).toString()
    fetch(`/api/analytics/ad-performance/detail?${qs}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<DetailData>
      })
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message ?? 'Failed to load data')
        setLoading(false)
      })
  }, [id, groupBy, from, to])

  // ── Stream analysis when data is ready ────────────────────────────────────

  useEffect(() => {
    if (!data) return

    let cancelled = false
    setAnalysis('')
    setAnalyzeErr(false)
    setStreaming(true)

    async function streamAnalysis() {
      if (!data) return
      try {
        const locale = (typeof localStorage !== 'undefined' ? localStorage.getItem('aap-locale') : null) ?? 'ru'
        const res = await fetch('/api/analyze/ad-performance', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            groupBy:   data.groupBy,
            id:        data.id,
            name:      data.name,
            period:    data.period,
            totals:    data.totals,
            daily:     data.daily,
            breakdown: data.breakdown,
            locale,
          }),
        })

        if (!res.ok || !res.body) {
          if (!cancelled) setAnalyzeErr(true)
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done || cancelled) break
          setAnalysis(prev => prev + decoder.decode(value, { stream: true }))
        }
      } catch {
        if (!cancelled) setAnalyzeErr(true)
      } finally {
        if (!cancelled) setStreaming(false)
      }
    }

    streamAnalysis()
    return () => { cancelled = true }
  }, [data])

  // ── Loading skeleton ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
          <ArrowLeft className="h-4 w-4" />Back
        </button>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
          <ArrowLeft className="h-4 w-4" />Back
        </button>
        <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
          {error ?? 'No data found.'}
        </div>
      </div>
    )
  }

  const { totals } = data

  const overallRoi      = totals.totalCost > 0
    ? ((totals.revenue - totals.totalCost) / totals.totalCost * 100)
    : 0
  const overallRoiTotal = totals.totalCost > 0
    ? ((totals.revenueTotal - totals.totalCost) / totals.totalCost * 100)
    : 0

  // Daily: last 30, recent first
  const dailySorted = [...data.daily]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30)

  const displayName = data.name ?? data.id
  const breakdownLabel = groupBy === 'offer_id' ? 'Campaign' : 'Offer'

  return (
    <div className="flex flex-col gap-5">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate">{displayName}</h2>
          <p className="text-[11px] text-muted-foreground font-mono">{data.id} · {groupBy}</p>
        </div>

        {/* Period presets */}
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

        <span className="text-[10px] text-muted-foreground font-mono">
          {data.period.from} — {data.period.to}
        </span>
      </div>

      {/* ── Summary cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label="Total Spend"
          value={fmtMoney(totals.totalCost, true)}
          sub={`Ad: ${fmtMoney(totals.adSpend, true)} · Tech: ${fmtMoney(totals.techCost, true)}`}
          color="text-foreground"
        />
        <SummaryCard
          label="Revenue Fact / Est"
          value={fmtMoney(totals.revenue, true)}
          sub={`+${fmtMoney(totals.revenuePending, true)} pending`}
          color="text-blue-400"
        />
        <SummaryCard
          label="Profit (Fact+Est)"
          value={fmtMoney(totals.profitTotal, true)}
          sub={`ROI ${overallRoi.toFixed(1)}% → ${overallRoiTotal.toFixed(1)}%`}
          color={totals.profitTotal >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[10px] text-muted-foreground mb-1.5">Signal &amp; Conversion</div>
          <div className="flex items-center gap-2 mb-1.5">
            <SignalBadge signal={totals.signal} />
            <span className="text-[10px] text-muted-foreground">
              {fmt(totals.ftds)} FTDs · CVR {totals.leads > 0 ? ((totals.ftds / totals.leads) * 100).toFixed(1) : '0.0'}%
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            CPL: {totals.cpl != null ? `$${totals.cpl.toFixed(0)}` : '—'} ·
            CPA: {totals.cpa != null ? `$${totals.cpa.toFixed(0)}` : '—'}
          </div>
        </div>
      </div>

      {/* ── AI Analysis ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card/80">
          <span className="text-sm font-semibold">🤖 Senior Analyst</span>
          {streaming && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" /> analyzing…
            </span>
          )}
        </div>
        <div className="px-4 py-4 min-h-[80px]">
          {analyzeErr ? (
            <p className="text-sm text-muted-foreground">Analysis unavailable.</p>
          ) : !analysis && streaming ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {analysis}
              </ReactMarkdown>
              {streaming && (
                <span className="inline-block w-2 h-4 bg-indigo-400 ml-0.5 animate-pulse align-text-bottom" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Daily Table ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-card/50">
          <h3 className="text-sm font-semibold">Daily Trend</h3>
          <p className="text-[10px] text-muted-foreground">Last 30 days, most recent first</p>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead className="bg-card/95 backdrop-blur-sm border-b border-border">
              <tr>
                <Th>Date</Th>
                <Th>Buyer</Th>
                <Th right>Clicks</Th>
                <Th right>Spend</Th>
                <Th right>Leads</Th>
                <Th right>FTDs</Th>
                <Th right>CVR</Th>
                <Th right>Rev Fact</Th>
                <Th right>Rev Est</Th>
                <Th right>Profit</Th>
                <Th right>ROI</Th>
                <Th right>CPL</Th>
                <Th right>CPA</Th>
              </tr>
            </thead>
            <tbody>
              {dailySorted.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-8 text-muted-foreground">No daily data available.</td>
                </tr>
              ) : dailySorted.map(d => (
                <tr key={d.date} className="border-b border-border/30 hover:bg-accent/30 transition-colors">
                  <td className="px-2 py-1.5 font-mono text-foreground whitespace-nowrap">{d.date}</td>
                  <td className="px-2 py-1.5 text-muted-foreground max-w-[80px] truncate" title={d.buyer ?? ''}>{d.buyer ?? '—'}</td>
                  <td className="text-right px-2 py-1.5 text-indigo-300">{fmt(d.clicks)}</td>
                  <td className="text-right px-2 py-1.5">{fmtMoney(d.totalCost, true)}</td>
                  <td className="text-right px-2 py-1.5 text-blue-300">{fmt(d.leads)}</td>
                  <td className="text-right px-2 py-1.5 text-emerald-300 font-semibold">{fmt(d.ftds)}</td>
                  <td className="text-right px-2 py-1.5 text-violet-300">
                    {d.cvr != null ? `${d.cvr.toFixed(1)}%` : '—'}
                  </td>
                  <td className="text-right px-2 py-1.5 text-blue-400">{fmtMoney(d.revenue, true)}</td>
                  <td className="text-right px-2 py-1.5 text-blue-300/70">
                    {d.revenuePending > 0 ? `+${fmtMoney(d.revenuePending, true)}` : '—'}
                  </td>
                  <td className={`text-right px-2 py-1.5 font-semibold ${d.profitTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmtMoney(d.profitTotal, true)}
                  </td>
                  <td className="text-right px-2 py-1.5"><RoiCell roi={d.roiTotal} /></td>
                  <td className="text-right px-2 py-1.5 text-muted-foreground">
                    {d.cpl != null ? `$${d.cpl.toFixed(0)}` : '—'}
                  </td>
                  <td className="text-right px-2 py-1.5 text-muted-foreground">
                    {d.cpa != null ? `$${d.cpa.toFixed(0)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Breakdown Table ──────────────────────────────────────────── */}
      {data.breakdown.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-card/50">
            <h3 className="text-sm font-semibold">{breakdownLabel} Breakdown</h3>
            <p className="text-[10px] text-muted-foreground">All {breakdownLabel.toLowerCase()}s for this {type}, sorted by spend</p>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead className="bg-card/95 backdrop-blur-sm border-b border-border">
                <tr>
                  <Th>Signal</Th>
                  <Th>Buyer</Th>
                  <Th>{breakdownLabel}</Th>
                  <Th right>Clicks</Th>
                  <Th right>Spend</Th>
                  <Th right>Leads</Th>
                  <Th right>FTDs</Th>
                  <Th right>CVR</Th>
                  <Th right>Rev Fact</Th>
                  <Th right>Rev Est</Th>
                  <Th right>Profit</Th>
                  <Th right>ROI</Th>
                  <Th right>CPL</Th>
                  <Th right>CPA</Th>
                </tr>
              </thead>
              <tbody>
                {[...data.breakdown]
                  .sort((a, b) => b.totalCost - a.totalCost)
                  .map((b, i) => {
                    const rowBg = b.signal === 'STOP'  ? 'bg-red-500/5 hover:bg-red-500/10'
                      : b.signal === 'OK'    ? 'bg-green-500/5 hover:bg-green-500/10'
                      : b.signal === 'WATCH' ? 'bg-yellow-500/5 hover:bg-yellow-500/10'
                      : 'hover:bg-accent/40'
                    return (
                      <tr key={`${b.key}-${i}`} className={`border-b border-border/30 transition-colors ${rowBg}`}>
                        <td className="px-2 py-1.5"><SignalBadge signal={b.signal} /></td>
                        <td className="px-2 py-1.5 text-muted-foreground max-w-[80px] truncate" title={b.buyer ?? ''}>
                          {b.buyer ?? '—'}
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="font-mono font-semibold text-foreground block max-w-[160px] truncate" title={b.key}>
                            {b.key}
                          </span>
                          {b.name && (
                            <span className="text-[9px] text-muted-foreground block max-w-[160px] truncate" title={b.name}>
                              {b.name}
                            </span>
                          )}
                        </td>
                        <td className="text-right px-2 py-1.5 text-indigo-300">{fmt(b.clicks)}</td>
                        <td className="text-right px-2 py-1.5">{fmtMoney(b.totalCost, true)}</td>
                        <td className="text-right px-2 py-1.5 text-blue-300">{fmt(b.leads)}</td>
                        <td className="text-right px-2 py-1.5 text-emerald-300 font-semibold">{fmt(b.ftds)}</td>
                        <td className="text-right px-2 py-1.5 text-violet-300">
                          {b.cvr != null ? `${b.cvr.toFixed(1)}%` : '—'}
                        </td>
                        <td className="text-right px-2 py-1.5 text-blue-400">{fmtMoney(b.revenue, true)}</td>
                        <td className="text-right px-2 py-1.5 text-blue-300/70">
                          {b.revenuePending > 0 ? `+${fmtMoney(b.revenuePending, true)}` : '—'}
                        </td>
                        <td className={`text-right px-2 py-1.5 font-semibold ${b.profitTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {fmtMoney(b.profitTotal, true)}
                        </td>
                        <td className="text-right px-2 py-1.5"><RoiCell roi={b.roiTotal} /></td>
                        <td className="text-right px-2 py-1.5 text-muted-foreground">
                          {b.cpl != null ? `$${b.cpl.toFixed(0)}` : '—'}
                        </td>
                        <td className="text-right px-2 py-1.5 text-muted-foreground">
                          {b.cpa != null ? `$${b.cpa.toFixed(0)}` : '—'}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
