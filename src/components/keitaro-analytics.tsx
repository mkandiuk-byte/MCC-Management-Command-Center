"use client"

import { useState, useEffect, useMemo } from "react"
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts"
import { Skeleton } from "@/components/ui/skeleton"
import { RefreshCw, TrendingUp, MousePointerClick, Target, DollarSign, Users, Search, X } from "lucide-react"
import { format, subDays } from "date-fns"

// ─── Types ───────────────────────────────────────────────────────────────────

type Row = Record<string, string | number>

interface ReportData {
  rows: Row[]
  period: { from: string; to: string }
}

type Preset = "7d" | "14d" | "30d" | "90d"

// ─── Constants ───────────────────────────────────────────────────────────────

const CHART_COLORS = {
  clicks:      "#818cf8",
  conversions: "#4ade80",
  cr:          "#fbbf24",
  revenue:     "#60a5fa",
  unique:      "#a78bfa",
}

const PIE_PALETTE = [
  "#818cf8", "#4ade80", "#fbbf24", "#60a5fa",
  "#f87171", "#34d399", "#fb923c", "#a78bfa",
  "#38bdf8", "#e879f9",
]

const SUBID_LABELS: Record<string, string> = {
  sub_id_1: "Sub ID 1",
  sub_id_2: "Sub ID 2",
  sub_id_3: "Sub ID 3",
  sub_id_4: "Sub ID 4",
  sub_id_5: "Sub ID 5",
  sub_id_6: "Sub ID 6",
  sub_id_7: "Sub ID 7",
  sub_id_8: "Sub ID 8",
  sub_id_9: "Sub ID 9 — Traffic Type (cloak / offer / pwa / app / manager)",
  sub_id_10: "Sub ID 10",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtNum(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return String(v)
}

function fmtMoney(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`
  return `$${v.toFixed(0)}`
}

function fmtPct(v: number): string {
  return `${Number(v).toFixed(2)}%`
}

function fmtDate(d: Date): string {
  return format(d, "yyyy-MM-dd")
}

function countryFlag(code: string): string {
  try {
    return code
      .toUpperCase()
      .replace(/./g, (c) => String.fromCodePoint(0x1f1e0 + c.charCodeAt(0) - 65))
  } catch {
    return "🌐"
  }
}

function getDateRange(preset: Preset): { from: string; to: string } {
  const today = new Date()
  const days = preset === "7d" ? 7 : preset === "14d" ? 14 : preset === "30d" ? 30 : 90
  return { from: fmtDate(subDays(today, days)), to: fmtDate(today) }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

function useReport(params: Record<string, string>, key: string) {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    const qs = new URLSearchParams(params).toString()
    fetch(`/api/analytics/report?${qs}`)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json() as Promise<ReportData>
      })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { data, loading, error }
}

// ─── KPI Cards ───────────────────────────────────────────────────────────────

function KpiCards({ rows, loading }: { rows: Row[]; loading: boolean }) {
  const totals = useMemo(() => {
    const acc = { clicks: 0, visitors: 0, conversions: 0, revenue: 0, cr_sum: 0, cr_count: 0 }
    for (const r of rows) {
      acc.clicks += Number(r.clicks ?? 0)
      acc.visitors += Number(r.visitors ?? 0)
      acc.conversions += Number(r.conversions ?? 0)
      acc.revenue += Number(r.revenue ?? 0)
      if (Number(r.cr ?? 0) > 0) { acc.cr_sum += Number(r.cr ?? 0); acc.cr_count++ }
    }
    return { ...acc, cr: acc.cr_count > 0 ? acc.cr_sum / acc.cr_count : 0 }
  }, [rows])

  const cards = [
    { label: "Clicks",       value: fmtNum(totals.clicks),     icon: MousePointerClick, color: "text-indigo-400" },
    { label: "Visitors",     value: fmtNum(totals.visitors),   icon: Users,             color: "text-violet-400" },
    { label: "Conversions",  value: fmtNum(totals.conversions), icon: Target,           color: "text-green-400" },
    { label: "Avg CR",       value: fmtPct(totals.cr),          icon: TrendingUp,       color: "text-amber-400" },
    { label: "Revenue",      value: fmtMoney(totals.revenue),   icon: DollarSign,       color: "text-blue-400" },
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="rounded-lg border border-border/60 bg-card/40 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Icon className={`h-3.5 w-3.5 ${color}`} />
            <span className="text-[11px] text-muted-foreground">{label}</span>
          </div>
          <div className={`text-xl font-bold ${color}`}>{value}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Funnel ──────────────────────────────────────────────────────────────────

function FunnelViz({ rows, loading }: { rows: Row[]; loading: boolean }) {
  const stages = useMemo(() => {
    const acc = { clicks: 0, visitors: 0, conversions: 0, leads: 0, sales: 0 }
    for (const r of rows) {
      acc.clicks += Number(r.clicks ?? 0)
      acc.visitors += Number(r.visitors ?? 0)
      acc.conversions += Number(r.conversions ?? 0)
      acc.leads += Number(r.leads ?? 0)
      acc.sales += Number(r.sales ?? 0)
    }
    const base = acc.clicks || 1
    return [
      { label: "Clicks",      value: acc.clicks,     pct: 100,                          color: CHART_COLORS.clicks },
      { label: "Visitors",    value: acc.visitors,   pct: (acc.visitors / base) * 100,  color: CHART_COLORS.unique },
      { label: "Conversions", value: acc.conversions, pct: (acc.conversions / base) * 100, color: CHART_COLORS.conversions },
      { label: "Leads",       value: acc.leads,       pct: (acc.leads / base) * 100,     color: "#34d399" },
      { label: "Sales",       value: acc.sales,       pct: (acc.sales / base) * 100,     color: "#60a5fa" },
    ]
  }, [rows])

  if (loading) return <Skeleton className="h-48" />

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4 h-full">
      <h3 className="text-sm font-medium mb-4">Conversion Funnel</h3>
      <div className="space-y-2">
        {stages.map((s) => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground w-20 shrink-0 text-right">{s.label}</span>
            <div className="flex-1 bg-muted/30 rounded-full h-5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 flex items-center pl-2"
                style={{ width: `${Math.max(s.pct, 0.5)}%`, backgroundColor: s.color + "cc" }}
              />
            </div>
            <span className="text-[11px] font-mono w-16 shrink-0">
              {fmtNum(s.value)}
            </span>
            <span className="text-[10px] text-muted-foreground w-10 shrink-0">
              {s.pct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Time Series ─────────────────────────────────────────────────────────────

type TooltipProps = {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <div className="font-medium mb-1 text-muted-foreground">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex gap-2 items-center">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-medium">
            {p.name === "cr" ? fmtPct(p.value) : fmtNum(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function TrendChart({ rows, loading }: { rows: Row[]; loading: boolean }) {
  const data = useMemo(
    () =>
      [...rows]
        .sort((a, b) => String(a.day).localeCompare(String(b.day)))
        .map((r) => ({
          date: String(r.day ?? "").slice(5),
          clicks: Number(r.clicks ?? 0),
          conversions: Number(r.conversions ?? 0),
          cr: Number(r.cr ?? 0),
        })),
    [rows],
  )

  if (loading) return <Skeleton className="h-48" />

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4 h-full">
      <h3 className="text-sm font-medium mb-4">Daily Trend</h3>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data} margin={{ top: 0, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#71717a" }} tickLine={false} axisLine={false} tickFormatter={fmtNum} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#71717a" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
          <Tooltip content={<ChartTooltip />} />
          <Bar yAxisId="left" dataKey="clicks" fill={CHART_COLORS.clicks} opacity={0.8} radius={[2, 2, 0, 0]} maxBarSize={20} />
          <Bar yAxisId="left" dataKey="conversions" fill={CHART_COLORS.conversions} opacity={0.8} radius={[2, 2, 0, 0]} maxBarSize={20} />
          <Line yAxisId="right" type="monotone" dataKey="cr" stroke={CHART_COLORS.cr} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2 justify-center">
        {[
          { key: "clicks",      label: "Clicks",      color: CHART_COLORS.clicks },
          { key: "conversions", label: "Conversions", color: CHART_COLORS.conversions },
          { key: "cr",          label: "CR %",        color: CHART_COLORS.cr },
        ].map(({ key, label, color }) => (
          <span key={key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Geo Table ───────────────────────────────────────────────────────────────

function GeoTable({ rows, loading }: { rows: Row[]; loading: boolean }) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => Number(b.clicks ?? 0) - Number(a.clicks ?? 0)).slice(0, 20),
    [rows],
  )
  const maxClicks = sorted[0] ? Number(sorted[0].clicks ?? 1) : 1

  if (loading) return <Skeleton className="h-64" />

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4">
      <h3 className="text-sm font-medium mb-3">Top Countries</h3>
      <div className="grid grid-cols-1 gap-1.5">
        {sorted.map((r) => {
          const code = String(r.country_code ?? r.country ?? "??").toUpperCase()
          const clicks = Number(r.clicks ?? 0)
          const conversions = Number(r.conversions ?? 0)
          const cr = Number(r.cr ?? 0)
          const barPct = (clicks / maxClicks) * 100
          return (
            <div key={code} className="flex items-center gap-3 group">
              <span className="text-base w-8 shrink-0 text-center">{countryFlag(code)}</span>
              <span className="text-[11px] font-mono text-muted-foreground w-8 shrink-0">{code}</span>
              <div className="flex-1 bg-muted/30 rounded-full h-3.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${barPct}%`, backgroundColor: CHART_COLORS.clicks + "bb" }}
                />
              </div>
              <span className="text-[11px] font-mono w-14 text-right text-foreground">{fmtNum(clicks)}</span>
              <span className="text-[11px] font-mono w-12 text-right text-green-400">{fmtNum(conversions)}</span>
              <span className="text-[10px] font-mono w-10 text-right text-amber-400">{fmtPct(cr)}</span>
            </div>
          )
        })}
      </div>
      {sorted.length > 0 && (
        <div className="flex gap-4 mt-3 justify-end text-[10px] text-muted-foreground border-t border-border/30 pt-2">
          <span>clicks</span>
          <span className="text-green-400/70">conv</span>
          <span className="text-amber-400/70">cr%</span>
        </div>
      )}
    </div>
  )
}

// ─── Device / OS Pies ────────────────────────────────────────────────────────

function DonutChart({ rows, loading, title, dim }: {
  rows: Row[]; loading: boolean; title: string; dim: string
}) {
  const data = useMemo(
    () =>
      rows
        .filter((r) => r[dim])
        .map((r) => ({ name: String(r[dim]), value: Number(r.clicks ?? 0) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    [rows, dim],
  )
  const total = data.reduce((s, d) => s + d.value, 0)

  if (loading) return <Skeleton className="h-48" />

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4">
      <h3 className="text-sm font-medium mb-3">{title}</h3>
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <PieChart width={120} height={120}>
            <Pie
              data={data} cx={55} cy={55} innerRadius={32} outerRadius={52}
              dataKey="value" strokeWidth={1} stroke="transparent"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        </div>
        <div className="flex-1 space-y-1 min-w-0">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_PALETTE[i % PIE_PALETTE.length] }} />
              <span className="text-[11px] text-muted-foreground truncate flex-1">{d.name}</span>
              <span className="text-[11px] font-mono text-foreground shrink-0">{fmtNum(d.value)}</span>
              <span className="text-[10px] text-muted-foreground shrink-0 w-8 text-right">
                {total > 0 ? `${((d.value / total) * 100).toFixed(0)}%` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Breakdown Table (reusable: ad campaigns / campaigns / offers) ────────────

type BreakdownSortKey = 'clicks' | 'conversions' | 'cr' | 'revenue' | 'cost' | 'profit' | 'roi' | 'leads' | 'sales'

interface BreakdownCol {
  key: BreakdownSortKey | string
  label: string
  fmt: (v: number) => string
  color?: string
}

function detectNetwork(id: string): { label: string; color: string } {
  if (/^\d{15,25}$/.test(id)) return { label: 'Meta', color: '#1877f2' }
  if (/^\d{9,14}$/.test(id)) return { label: 'Google', color: '#4285f4' }
  if (/^[A-Za-z0-9_-]{18,25}$/.test(id)) return { label: 'TikTok', color: '#999' }
  return { label: 'Other', color: '#6b7280' }
}

function BreakdownTable({
  rows, loading, nameKey, cols, nameLabel, showNetwork,
}: {
  rows: Row[]; loading: boolean; nameKey: string; cols: BreakdownCol[]; nameLabel: string; showNetwork?: boolean
}) {
  const [sortCol, setSortCol] = useState<string>(cols[0]?.key ?? 'clicks')
  const [sortDesc, setSortDesc] = useState(true)
  const [search, setSearch] = useState('')

  const sorted = useMemo(() => {
    let list = rows.filter(r => r[nameKey])
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(r => String(r[nameKey]).toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      const va = Number(a[sortCol] ?? 0)
      const vb = Number(b[sortCol] ?? 0)
      return sortDesc ? vb - va : va - vb
    })
  }, [rows, nameKey, sortCol, sortDesc, search])

  const maxClicks = useMemo(() => Math.max(...sorted.map(r => Number(r.clicks ?? 0)), 1), [sorted])

  const handleSort = (key: string) => {
    if (sortCol === key) setSortDesc(d => !d)
    else { setSortCol(key); setSortDesc(true) }
  }

  if (loading) return <Skeleton className="h-64" />
  if (rows.length === 0) return (
    <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">No data</div>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-[280px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${nameLabel}…`}
            className="w-full pl-7 pr-6 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono ml-auto">{sorted.length} rows</span>
      </div>
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">{nameLabel}</th>
                {cols.map(col => (
                  <th
                    key={col.key}
                    className="text-right px-3 py-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap select-none"
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    {sortCol === col.key && <span className="ml-0.5 opacity-60">{sortDesc ? '↓' : '↑'}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const name = String(row[nameKey] ?? '')
                const net = showNetwork ? detectNetwork(name) : null
                const clicks = Number(row.clicks ?? 0)
                const barW = maxClicks > 0 ? (clicks / maxClicks) * 100 : 0
                return (
                  <tr key={i} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {net && (
                          <span className="text-[9px] font-bold uppercase tracking-widest shrink-0 px-1 rounded" style={{ color: net.color, backgroundColor: net.color + '20' }}>
                            {net.label}
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-[10px] truncate max-w-[220px]" title={name}>{name}</div>
                          <div className="mt-0.5 bg-muted/30 rounded-full h-1 overflow-hidden max-w-[180px]">
                            <div className="h-full rounded-full bg-indigo-400/50" style={{ width: `${barW}%` }} />
                          </div>
                        </div>
                      </div>
                    </td>
                    {cols.map(col => (
                      <td key={col.key} className={`px-3 py-2 text-right font-mono whitespace-nowrap ${col.color ?? 'text-foreground'}`}>
                        {col.fmt(Number(row[col.key] ?? 0))}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Ad Campaigns Tab ─────────────────────────────────────────────────────────

function AdCampaignsTab({ from, to, cacheKey }: { from: string; to: string; cacheKey: string }) {
  const { data, loading } = useReport(
    { dimensions: 'ad_campaign_id', measures: 'clicks,conversions,cr,revenue,cost', from, to, limit: '200', sort_by: 'clicks' },
    cacheKey + '|ad',
  )
  const rows = data?.rows ?? []

  // KPI totals
  const totals = useMemo(() => {
    const acc = { clicks: 0, conversions: 0, revenue: 0, cost: 0 }
    for (const r of rows) {
      acc.clicks += Number(r.clicks ?? 0)
      acc.conversions += Number(r.conversions ?? 0)
      acc.revenue += Number(r.revenue ?? 0)
      acc.cost += Number(r.cost ?? 0)
    }
    return { ...acc, cr: acc.clicks > 0 ? (acc.conversions / acc.clicks) * 100 : 0, count: rows.length }
  }, [rows])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Ad Campaigns', value: String(totals.count), color: 'text-violet-400' },
          { label: 'Total Clicks', value: fmtNum(totals.clicks), color: 'text-indigo-400' },
          { label: 'Conversions', value: fmtNum(totals.conversions), color: 'text-green-400' },
          { label: 'Avg CR', value: fmtPct(totals.cr), color: 'text-amber-400' },
          { label: 'Revenue', value: fmtMoney(totals.revenue), color: 'text-blue-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-border/60 bg-card/40 px-4 py-3">
            <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
            <div className={`text-lg font-bold ${color}`}>{loading ? '…' : value}</div>
          </div>
        ))}
      </div>
      <BreakdownTable
        rows={rows}
        loading={loading}
        nameKey="ad_campaign_id"
        nameLabel="ad_campaign_id"
        showNetwork
        cols={[
          { key: 'clicks',      label: 'Clicks',  fmt: fmtNum,   color: 'text-indigo-300' },
          { key: 'conversions', label: 'Conv',    fmt: fmtNum,   color: 'text-green-400' },
          { key: 'cr',          label: 'CR %',    fmt: v => fmtPct(v), color: 'text-amber-400' },
          { key: 'revenue',     label: 'Revenue', fmt: fmtMoney, color: 'text-blue-400' },
          { key: 'cost',        label: 'Cost',    fmt: fmtMoney, color: 'text-rose-400' },
        ]}
      />
    </div>
  )
}

// ─── Keitaro Campaigns Tab ────────────────────────────────────────────────────

function CampaignsTab({ from, to, cacheKey }: { from: string; to: string; cacheKey: string }) {
  const { data, loading } = useReport(
    { dimensions: 'campaign', measures: 'clicks,conversions,cr,revenue,cost,profit,roi', from, to, limit: '200', sort_by: 'clicks' },
    cacheKey + '|campaigns',
  )
  const rows = data?.rows ?? []

  const totals = useMemo(() => {
    const acc = { clicks: 0, conversions: 0, revenue: 0, cost: 0, profit: 0 }
    for (const r of rows) {
      acc.clicks += Number(r.clicks ?? 0)
      acc.conversions += Number(r.conversions ?? 0)
      acc.revenue += Number(r.revenue ?? 0)
      acc.cost += Number(r.cost ?? 0)
      acc.profit += Number(r.profit ?? 0)
    }
    return { ...acc, roi: acc.cost > 0 ? ((acc.revenue - acc.cost) / acc.cost) * 100 : 0, count: rows.length }
  }, [rows])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        {[
          { label: 'Campaigns', value: String(totals.count), color: 'text-yellow-400' },
          { label: 'Clicks', value: fmtNum(totals.clicks), color: 'text-indigo-400' },
          { label: 'Conversions', value: fmtNum(totals.conversions), color: 'text-green-400' },
          { label: 'Revenue', value: fmtMoney(totals.revenue), color: 'text-blue-400' },
          { label: 'Cost', value: fmtMoney(totals.cost), color: 'text-rose-400' },
          { label: 'Total ROI', value: `${totals.roi.toFixed(0)}%`, color: totals.roi >= 0 ? 'text-green-400' : 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-border/60 bg-card/40 px-4 py-3">
            <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
            <div className={`text-lg font-bold ${color}`}>{loading ? '…' : value}</div>
          </div>
        ))}
      </div>
      <BreakdownTable
        rows={rows}
        loading={loading}
        nameKey="campaign"
        nameLabel="Campaign"
        cols={[
          { key: 'clicks',      label: 'Clicks',  fmt: fmtNum,   color: 'text-indigo-300' },
          { key: 'conversions', label: 'Conv',    fmt: fmtNum,   color: 'text-green-400' },
          { key: 'cr',          label: 'CR %',    fmt: v => fmtPct(v), color: 'text-amber-400' },
          { key: 'revenue',     label: 'Revenue', fmt: fmtMoney, color: 'text-blue-400' },
          { key: 'cost',        label: 'Cost',    fmt: fmtMoney, color: 'text-rose-400' },
          { key: 'profit',      label: 'Profit',  fmt: fmtMoney, color: 'text-emerald-400' },
          { key: 'roi',         label: 'ROI %',   fmt: v => `${v.toFixed(0)}%`, color: 'text-violet-400' },
        ]}
      />
    </div>
  )
}

// ─── Offers Tab ───────────────────────────────────────────────────────────────

function OffersTab({ from, to, cacheKey }: { from: string; to: string; cacheKey: string }) {
  const { data, loading } = useReport(
    { dimensions: 'offer', measures: 'clicks,conversions,cr,revenue,leads,sales', from, to, limit: '200', sort_by: 'conversions' },
    cacheKey + '|offers',
  )
  const rows = data?.rows ?? []

  const totals = useMemo(() => {
    const acc = { clicks: 0, conversions: 0, revenue: 0, leads: 0, sales: 0 }
    for (const r of rows) {
      acc.clicks += Number(r.clicks ?? 0)
      acc.conversions += Number(r.conversions ?? 0)
      acc.revenue += Number(r.revenue ?? 0)
      acc.leads += Number(r.leads ?? 0)
      acc.sales += Number(r.sales ?? 0)
    }
    return {
      ...acc,
      approveRate: acc.leads > 0 ? (acc.sales / acc.leads) * 100 : 0,
      count: rows.length,
    }
  }, [rows])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        {[
          { label: 'Offers', value: String(totals.count), color: 'text-emerald-400' },
          { label: 'Clicks', value: fmtNum(totals.clicks), color: 'text-indigo-400' },
          { label: 'Conv', value: fmtNum(totals.conversions), color: 'text-green-400' },
          { label: 'Leads', value: fmtNum(totals.leads), color: 'text-blue-400' },
          { label: 'Sales', value: fmtNum(totals.sales), color: 'text-violet-400' },
          { label: 'Approve Rate', value: fmtPct(totals.approveRate), color: 'text-amber-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-border/60 bg-card/40 px-4 py-3">
            <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
            <div className={`text-lg font-bold ${color}`}>{loading ? '…' : value}</div>
          </div>
        ))}
      </div>
      <BreakdownTable
        rows={rows}
        loading={loading}
        nameKey="offer"
        nameLabel="Offer"
        cols={[
          { key: 'clicks',      label: 'Clicks',  fmt: fmtNum,   color: 'text-indigo-300' },
          { key: 'conversions', label: 'Conv',    fmt: fmtNum,   color: 'text-green-400' },
          { key: 'cr',          label: 'CR %',    fmt: v => fmtPct(v), color: 'text-amber-400' },
          { key: 'leads',       label: 'Leads',   fmt: fmtNum,   color: 'text-blue-400' },
          { key: 'sales',       label: 'Sales',   fmt: fmtNum,   color: 'text-violet-400' },
          { key: 'revenue',     label: 'Revenue', fmt: fmtMoney, color: 'text-emerald-400' },
        ]}
      />
    </div>
  )
}

// ─── Sub_id Analyzer ─────────────────────────────────────────────────────────

const SUBIDS = ["sub_id_1", "sub_id_2", "sub_id_3", "sub_id_4", "sub_id_5", "sub_id_6", "sub_id_7", "sub_id_8", "sub_id_9"]

function SubidAnalyzer({ from, to }: { from: string; to: string }) {
  const [active, setActive] = useState("sub_id_1")

  const key = `${from}|${to}|${active}`
  const { data, loading } = useReport(
    { dimensions: active, measures: "clicks,conversions,cr", limit: "30", from, to, sort_by: "clicks" },
    key,
  )

  const chartData = useMemo(() => {
    if (!data) return []
    return data.rows
      .filter((r) => r[active] && String(r[active]).trim() !== "")
      .map((r) => ({
        name: String(r[active]).slice(0, 24),
        clicks: Number(r.clicks ?? 0),
        conversions: Number(r.conversions ?? 0),
        cr: Number(r.cr ?? 0),
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 20)
  }, [data, active])

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Sub_id Analysis</h3>
      </div>

      {/* Sub_id tabs */}
      <div className="flex flex-wrap gap-1 mb-4">
        {SUBIDS.map((sid) => (
          <button
            key={sid}
            onClick={() => setActive(sid)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
              active === sid
                ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300"
                : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            {sid.replace("sub_id_", "sid_")}
            {sid === "sub_id_9" && <span className="ml-1 opacity-60">★</span>}
          </button>
        ))}
      </div>

      <div className="text-[10px] text-muted-foreground mb-3">
        {SUBID_LABELS[active]}
        {active === "sub_id_9" && (
          <span className="ml-2 text-amber-400/80">★ offer = финансовый трафік · cloak = вхідна фільтрація · pwa/app = застосунок</span>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-48" />
      ) : chartData.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} layout="vertical" margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 9, fill: "#71717a" }} tickLine={false} tickFormatter={fmtNum} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "#71717a" }} tickLine={false} width={80} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="clicks" fill={CHART_COLORS.clicks} opacity={0.8} radius={[0, 2, 2, 0]} maxBarSize={12} />
            <Bar dataKey="conversions" fill={CHART_COLORS.conversions} opacity={0.8} radius={[0, 2, 2, 0]} maxBarSize={12} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PRESETS: { key: Preset; label: string }[] = [
  { key: "7d", label: "7d" },
  { key: "14d", label: "14d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
]

type AnalyticsTab = 'overview' | 'ad_campaigns' | 'campaigns' | 'offers'

const TAB_META: { key: AnalyticsTab; label: string }[] = [
  { key: 'overview',     label: 'Overview' },
  { key: 'ad_campaigns', label: 'Ad Campaigns' },
  { key: 'campaigns',    label: 'Keitaro Campaigns' },
  { key: 'offers',       label: 'Offers' },
]

export function KeitaroAnalytics() {
  const [preset, setPreset] = useState<Preset>("30d")
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview')

  const { from, to } = useMemo(() => getDateRange(preset), [preset])
  const cacheKey = `${from}|${to}|${refreshKey}`

  // Overview data (only load when on overview tab — but hooks must always be called)
  const { data: tsData, loading: tsLoading } = useReport(
    { dimensions: "day", measures: "clicks,visitors,conversions,cr,revenue,leads,sales", from, to, limit: "200", sort_by: "day" },
    activeTab === 'overview' ? cacheKey : 'skip',
  )
  const { data: geoData, loading: geoLoading } = useReport(
    { dimensions: "country_code", measures: "clicks,conversions,cr", from, to, limit: "30" },
    activeTab === 'overview' ? cacheKey : 'skip',
  )
  const { data: devData, loading: devLoading } = useReport(
    { dimensions: "device_type", measures: "clicks", from, to },
    activeTab === 'overview' ? cacheKey : 'skip',
  )
  const { data: osData, loading: osLoading } = useReport(
    { dimensions: "os", measures: "clicks", from, to, limit: "15" },
    activeTab === 'overview' ? cacheKey : 'skip',
  )

  const tsRows = tsData?.rows ?? []
  const geoRows = geoData?.rows ?? []
  const devRows = devData?.rows ?? []
  const osRows = osData?.rows ?? []

  return (
    <div className="space-y-4 max-w-7xl">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 p-0.5 rounded-lg border border-border/50 bg-card/30">
          {PRESETS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPreset(key)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                preset === key
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {from} — {to}
        </span>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh all"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/50">
        {TAB_META.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          <KpiCards rows={tsRows} loading={tsLoading} />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <FunnelViz rows={tsRows} loading={tsLoading} />
            </div>
            <div className="lg:col-span-3">
              <TrendChart rows={tsRows} loading={tsLoading} />
            </div>
          </div>
          <GeoTable rows={geoRows} loading={geoLoading} />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <DonutChart rows={devRows} loading={devLoading} title="Device Type" dim="device_type" />
            <DonutChart rows={osRows} loading={osLoading} title="OS" dim="os" />
            <SubidAnalyzer from={from} to={to} />
          </div>
        </div>
      )}

      {activeTab === 'ad_campaigns' && (
        <AdCampaignsTab from={from} to={to} cacheKey={cacheKey} />
      )}

      {activeTab === 'campaigns' && (
        <CampaignsTab from={from} to={to} cacheKey={cacheKey} />
      )}

      {activeTab === 'offers' && (
        <OffersTab from={from} to={to} cacheKey={cacheKey} />
      )}
    </div>
  )
}
