"use client"

import { useEffect, useState, useMemo } from "react"
import { PageHeader } from "@/components/mcc/page-header"
import { ScoreBox } from "@/components/mcc/score-box"
import { SignalBadge, type Signal } from "@/components/mcc/signal-badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { ArrowUpDown, Rocket, AlertOctagon, AlertTriangle, ArrowRight, Skull } from "lucide-react"
import { useI18n } from "@/lib/mcc-i18n"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Buyer {
  buyer: string
  clicks: number
  conversions: number
  revenue: number
  cost: number
  profit: number
  roi: number
  cpa: number
  campaigns: number
  stopCampaigns: number
  signal: string
}

interface BuyerResponse {
  buyers: Buyer[]
  totals: {
    totalSpend: number
    totalRevenue: number
    totalProfit: number
    avgRoi: number
  }
}

interface RoiRow {
  grouping: string
  clicks: number
  conversions: number
  revenue: number
  cost: number
  profit: number
  roi: number
  cpa: number
  trafficLight: string
}

interface RoiResponse {
  byGeo: RoiRow[]
  byOffer: RoiRow[]
  daily: RoiRow[]
}

interface AirtableOffersData {
  offers: {
    total: number
    byStatus: Record<string, number>
    byQuality: Record<string, number>
    byWorkModel: Record<string, number>
    active: number
    withProblems: number
  }
  brands: { total: number; list: { name: string; id: number }[] }
  geos: { total: number; list: string[] }
}

interface KilledCampaign {
  name: string
  spend: number
  reason: string
}

interface LifecycleData {
  tests: number
  active: number
  scaled: number
  optimized: number
  killed: number
  total: number
  recentlyKilled: KilledCampaign[]
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmt(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`
}

function profitColor(n: number): string {
  return n >= 0 ? "text-[var(--success)]" : "text-[var(--error)]"
}

function roiBorderColor(roi: number): string {
  if (roi > 0) return "border-l-[var(--success)]"
  if (roi >= -20) return "border-l-[var(--warning)]"
  return "border-l-[var(--error)]"
}

/* ------------------------------------------------------------------ */
/*  Custom Tooltip                                                     */
/* ------------------------------------------------------------------ */

interface TooltipPayloadItem {
  name: string
  value: number
  color: string
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[var(--input)] bg-[var(--popover)] px-3 py-2 shadow-xl">
      <p className="text-[11px] text-[var(--muted-foreground)] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-[12px] font-medium" style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sortable Table Header                                              */
/* ------------------------------------------------------------------ */

type SortDir = "asc" | "desc"

function SortableHead({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
  className,
}: {
  label: string
  sortKey: string
  currentSort: string
  currentDir: SortDir
  onSort: (key: string) => void
  className?: string
}) {
  return (
    <TableHead
      className={`cursor-pointer select-none hover:text-[var(--foreground)] text-[var(--muted-foreground)] text-[12px] font-semibold ${className ?? ""}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={`h-3 w-3 ${currentSort === sortKey ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"}`}
        />
      </span>
    </TableHead>
  )
}

/* ------------------------------------------------------------------ */
/*  Tab: Overview                                                      */
/* ------------------------------------------------------------------ */

function computeDelta(current: number, previous: number): { pct: string; trend: "up" | "down" | "flat" } {
  if (previous === 0 && current === 0) return { pct: "0%", trend: "flat" }
  if (previous === 0) return { pct: "+100%", trend: "up" }
  const delta = ((current - previous) / Math.abs(previous)) * 100
  if (Math.abs(delta) < 1) return { pct: "0%", trend: "flat" }
  const sign = delta > 0 ? "+" : ""
  return {
    pct: `${sign}${delta.toFixed(0)}%`,
    trend: delta > 0 ? "up" : "down",
  }
}

function OverviewTab({
  data,
  roi,
  prevData,
}: {
  data: BuyerResponse | null
  roi: RoiResponse | null
  prevData: BuyerResponse | null
}) {
  const { t } = useI18n()
  const totals = data?.totals
  const prevTotals = prevData?.totals
  const buyers = data?.buyers ?? []
  const stopCount = buyers.filter((b) => b.signal === "STOP").length
  const totalCampaigns = buyers.reduce((s, b) => s + b.campaigns, 0)

  // Comparisons
  const spendDelta = totals && prevTotals ? computeDelta(totals.totalSpend, prevTotals.totalSpend) : null
  const revDelta = totals && prevTotals ? computeDelta(totals.totalRevenue, prevTotals.totalRevenue) : null
  const profitDelta = totals && prevTotals ? computeDelta(totals.totalProfit, prevTotals.totalProfit) : null
  const roiDelta = totals && prevTotals ? computeDelta(totals.avgRoi, prevTotals.avgRoi) : null

  // Sparkline data from daily ROI
  const spendSpark = useMemo(() => {
    if (!roi?.daily) return undefined
    const sorted = [...roi.daily].sort((a, b) => a.grouping.localeCompare(b.grouping))
    return sorted.slice(-7).map((d) => d.cost)
  }, [roi?.daily])

  const revenueSpark = useMemo(() => {
    if (!roi?.daily) return undefined
    const sorted = [...roi.daily].sort((a, b) => a.grouping.localeCompare(b.grouping))
    return sorted.slice(-7).map((d) => d.revenue)
  }, [roi?.daily])

  const profitSpark = useMemo(() => {
    if (!roi?.daily) return undefined
    const sorted = [...roi.daily].sort((a, b) => a.grouping.localeCompare(b.grouping))
    return sorted.slice(-7).map((d) => d.profit)
  }, [roi?.daily])

  // Daily chart data sorted chronologically
  const chartData = useMemo(() => {
    if (!roi?.daily) return []
    return [...roi.daily]
      .sort((a, b) => a.grouping.localeCompare(b.grouping))
      .map((d) => ({
        date: d.grouping.slice(5), // MM-DD
        revenue: d.revenue,
        cost: d.cost,
        profit: d.profit,
      }))
  }, [roi?.daily])

  // Top 5 geos by profit
  const topGeos = useMemo(() => {
    if (!roi?.byGeo) return []
    return [...roi.byGeo].sort((a, b) => b.profit - a.profit).slice(0, 5)
  }, [roi?.byGeo])

  return (
    <div className="space-y-6">
      {/* KPI Score Boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-5">
            <ScoreBox
              label={t("summary.totalSpend")}
              value={totals ? fmt(totals.totalSpend) : "..."}
              trend={spendDelta?.trend}
              comparison={spendDelta ? `${spendDelta.pct} vs prev` : undefined}
              sparkData={spendSpark && spendSpark.length >= 2 ? spendSpark : undefined}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox
              label={t("summary.revenue")}
              value={totals ? fmt(totals.totalRevenue) : "..."}
              trend={revDelta?.trend}
              comparison={revDelta ? `${revDelta.pct} vs prev` : undefined}
              sparkData={revenueSpark && revenueSpark.length >= 2 ? revenueSpark : undefined}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox
              label={t("summary.profit")}
              value={totals ? fmt(totals.totalProfit) : "..."}
              status={totals ? (totals.totalProfit >= 0 ? "ok" : "stop") : "neutral"}
              trend={profitDelta?.trend}
              comparison={profitDelta ? `${profitDelta.pct} vs prev` : undefined}
              sparkData={profitSpark && profitSpark.length >= 2 ? profitSpark : undefined}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox
              label={t("common.roi")}
              value={totals ? `${totals.avgRoi}%` : "..."}
              status={totals ? (totals.avgRoi >= 15 ? "ok" : totals.avgRoi >= 0 ? "watch" : "stop") : "neutral"}
              trend={roiDelta?.trend}
              comparison={roiDelta ? `${roiDelta.pct} vs prev` : undefined}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox label={t("buying.activeCampaigns")} value={totals ? totalCampaigns : "..."} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox
              label={t("buying.stopSignals")}
              value={stopCount}
              status={stopCount > 0 ? "stop" : "ok"}
            />
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-[13px] font-semibold text-[var(--foreground)] mb-4">
              {t("buying.dailyTrend")}
            </h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4C8BF5" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#4C8BF5" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#52C67E" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#52C67E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="currentColor" strokeOpacity={0.06} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "hsl(220, 15%, 55%)", fontSize: 11 }}
                    axisLine={{ stroke: "currentColor", strokeOpacity: 0.06 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(220, 15%, 55%)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => fmt(v)}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name={t("summary.revenue")}
                    stroke="#4C8BF5"
                    strokeWidth={2}
                    fill="url(#fillRevenue)"
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name={t("summary.profit")}
                    stroke="#52C67E"
                    strokeWidth={2}
                    fill="url(#fillProfit)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 5 Geos */}
      {topGeos.length > 0 && (
        <div>
          <h3 className="text-[13px] font-semibold text-[var(--foreground)] mb-3">{t("buying.topGeosByProfit")}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {topGeos.map((geo) => (
              <Card
                key={geo.grouping}
                className={`border-l-[3px] ${roiBorderColor(geo.roi)}`}
              >
                <CardContent className="p-4">
                  <p className="text-[14px] font-semibold text-[var(--foreground)]">
                    {geo.grouping}
                  </p>
                  <p className={`text-[20px] font-bold mt-1 ${profitColor(geo.roi)}`}>
                    {geo.roi.toFixed(1)}%
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-[12px] text-[var(--muted-foreground)]">
                    <span>{t("buying.spend")} {fmt(geo.cost)}</span>
                    <span className={profitColor(geo.profit)}>
                      {t("summary.profit")} {fmt(geo.profit)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Tab: Buyers                                                        */
/* ------------------------------------------------------------------ */

function BuyersTab({ data }: { data: BuyerResponse | null }) {
  const { t } = useI18n()
  const [sortKey, setSortKey] = useState("profit")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const sorted = useMemo(() => {
    if (!data?.buyers) return []
    return [...data.buyers].sort((a, b) => {
      const av = a[sortKey as keyof Buyer]
      const bv = b[sortKey as keyof Buyer]
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
  }, [data?.buyers, sortKey, sortDir])

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-b-[var(--border)] hover:bg-transparent">
              <SortableHead label={t("buying.buyer")} sortKey="buyer" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="pl-5" />
              <SortableHead label={t("buying.spend")} sortKey="cost" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHead label={t("summary.revenue")} sortKey="revenue" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHead label={t("summary.profit")} sortKey="profit" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHead label={t("common.roi")} sortKey="roi" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHead label={t("common.cpa")} sortKey="cpa" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHead label={t("buying.campaigns")} sortKey="campaigns" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <TableHead className="text-[var(--muted-foreground)] text-[12px] font-semibold">{t("buying.signal")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((b) => (
              <TableRow
                key={b.buyer}
                className="border-b-[var(--border)] hover:bg-[var(--muted)]"
              >
                <TableCell className="pl-5 text-[13px] font-medium text-[var(--foreground)]">
                  {b.buyer}
                </TableCell>
                <TableCell className="text-[13px] text-[var(--secondary-foreground)]">{fmt(b.cost)}</TableCell>
                <TableCell className="text-[13px] text-[var(--secondary-foreground)]">{fmt(b.revenue)}</TableCell>
                <TableCell className={`text-[13px] font-medium ${profitColor(b.profit)}`}>
                  {fmt(b.profit)}
                </TableCell>
                <TableCell className={`text-[13px] font-medium ${profitColor(b.roi)}`}>
                  {fmtPct(b.roi)}
                </TableCell>
                <TableCell className="text-[13px] text-[var(--secondary-foreground)]">${b.cpa}</TableCell>
                <TableCell className="text-[13px] text-[var(--secondary-foreground)]">{b.campaigns}</TableCell>
                <TableCell>
                  <SignalBadge signal={b.signal as Signal} />
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-[var(--muted-foreground)] py-12">
                  Loading buyer data...
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  Tab: Geo                                                           */
/* ------------------------------------------------------------------ */

function GeoTab({ roi }: { roi: RoiResponse | null }) {
  const { t } = useI18n()
  const geos = useMemo(() => {
    if (!roi?.byGeo) return []
    return [...roi.byGeo].sort((a, b) => b.profit - a.profit)
  }, [roi?.byGeo])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {geos.map((geo) => (
        <Card
          key={geo.grouping}
          className={`border-l-[3px] ${roiBorderColor(geo.roi)}`}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[15px] font-semibold text-[var(--foreground)]">
                  {geo.grouping}
                </p>
                <p className={`text-[26px] font-bold mt-1 ${profitColor(geo.roi)}`}>
                  {geo.roi.toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <p className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wide">{t("buying.spend")}</p>
                <p className="text-[14px] font-medium text-[var(--secondary-foreground)] mt-0.5">{fmt(geo.cost)}</p>
              </div>
              <div>
                <p className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wide">{t("summary.profit")}</p>
                <p className={`text-[14px] font-medium mt-0.5 ${profitColor(geo.profit)}`}>
                  {fmt(geo.profit)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wide">{t("buying.clicks")}</p>
                <p className="text-[14px] font-medium text-[var(--secondary-foreground)] mt-0.5">
                  {geo.clicks.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wide">{t("buying.conversions")}</p>
                <p className="text-[14px] font-medium text-[var(--secondary-foreground)] mt-0.5">
                  {geo.conversions.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {geos.length === 0 && (
        <Card className="col-span-full">
          <CardContent className="p-12 text-center text-[var(--muted-foreground)]">
            Loading geo data...
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Tab: Offers                                                        */
/* ------------------------------------------------------------------ */

function OfferPipelineStage({
  label,
  count,
  color,
}: {
  label: string
  count: number
  color: string
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl px-6 py-4 min-w-[120px] border"
      style={{
        backgroundColor: `${color}10`,
        borderColor: `${color}30`,
      }}
    >
      <span className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider whitespace-nowrap">
        {label}
      </span>
      <span className="text-[28px] font-bold mt-1" style={{ color }}>
        {count}
      </span>
    </div>
  )
}

function OffersTab({
  roi,
  airtableOffers,
}: {
  roi: RoiResponse | null
  airtableOffers: AirtableOffersData | null
}) {
  const { t } = useI18n()
  const [sortKey, setSortKey] = useState("revenue")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const offers = useMemo(() => {
    if (!roi?.byOffer) return []
    return [...roi.byOffer]
      .sort((a, b) => {
        const av = a[sortKey as keyof RoiRow]
        const bv = b[sortKey as keyof RoiRow]
        if (typeof av === "number" && typeof bv === "number") {
          return sortDir === "asc" ? av - bv : bv - av
        }
        return sortDir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av))
      })
      .slice(0, 15)
  }, [roi?.byOffer, sortKey, sortDir])

  // Pipeline stages from Airtable statuses
  const pipelineStatuses = ["Arhive", "Видати в роботу", "Очікування Капи", "Заливається"]
  const pipelineColors: Record<string, string> = {
    "Arhive": "#6B7A94",
    "Видати в роботу": "#F5A623",
    "Очікування Капи": "#4C8BF5",
    "Заливається": "#52C67E",
  }
  const statusCounts = airtableOffers?.offers?.byStatus ?? {}

  return (
    <div className="space-y-6">
      {/* Airtable Offer Pipeline */}
      {airtableOffers && (
        <>
          {/* Score Boxes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5">
                <ScoreBox
                  label={t("buying.offers") + " Total"}
                  value={airtableOffers.offers.total}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <ScoreBox
                  label="Active"
                  value={airtableOffers.offers.active}
                  status={airtableOffers.offers.active > 0 ? "ok" : "neutral"}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <ScoreBox
                  label="Brands"
                  value={airtableOffers.brands.total}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <ScoreBox
                  label="Geos"
                  value={airtableOffers.geos.total}
                />
              </CardContent>
            </Card>
          </div>

          {/* Status Pipeline Visualization */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-[13px] font-semibold text-[var(--foreground)] mb-5">
                Offer Status Pipeline
              </h3>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {pipelineStatuses.map((status, i) => (
                  <div key={status} className="flex items-center gap-2">
                    <OfferPipelineStage
                      label={status}
                      count={statusCounts[status] ?? 0}
                      color={pipelineColors[status] ?? "#6B7A94"}
                    />
                    {i < pipelineStatuses.length - 1 && (
                      <ArrowRight className="h-5 w-5 text-[var(--muted-foreground)] shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quality Problems Alert */}
          {airtableOffers.offers.withProblems > 0 && (
            <Card className="border-l-[3px] border-l-[var(--warning)]">
              <CardContent className="p-5 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-[var(--warning)] shrink-0" />
                <div>
                  <p className="text-[14px] font-semibold text-[var(--foreground)]">
                    {airtableOffers.offers.withProblems} offers with quality issues
                  </p>
                  <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">
                    Offers flagged with quality concerns that need attention
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Existing Keitaro Offers Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b-[var(--border)] hover:bg-transparent">
                <SortableHead label={t("buying.offer")} sortKey="grouping" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="pl-5" />
                <SortableHead label={t("summary.revenue")} sortKey="revenue" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHead label={t("buying.cost")} sortKey="cost" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHead label={t("summary.profit")} sortKey="profit" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHead label={t("common.roi")} sortKey="roi" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHead label={t("buying.conversions")} sortKey="conversions" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((o) => (
                <TableRow
                  key={o.grouping}
                  className="border-b-[var(--border)] hover:bg-[var(--muted)]"
                >
                  <TableCell className="pl-5 text-[13px] font-medium text-[var(--foreground)]">
                    {o.grouping}
                  </TableCell>
                  <TableCell className="text-[13px] text-[var(--secondary-foreground)]">{fmt(o.revenue)}</TableCell>
                  <TableCell className="text-[13px] text-[var(--secondary-foreground)]">{fmt(o.cost)}</TableCell>
                  <TableCell className={`text-[13px] font-medium ${profitColor(o.profit)}`}>
                    {fmt(o.profit)}
                  </TableCell>
                  <TableCell className={`text-[13px] font-medium ${profitColor(o.roi)}`}>
                    {fmtPct(o.roi)}
                  </TableCell>
                  <TableCell className="text-[13px] text-[var(--secondary-foreground)]">
                    {o.conversions.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {offers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-[var(--muted-foreground)] py-12">
                    Loading offer data...
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Tab: Operations                                                    */
/* ------------------------------------------------------------------ */

interface DailyCampaignsData {
  campaignsPerDay: { date: string; created: number; killed: number }[]
  campaignsBySource: Record<string, number>
  totalActive: number
  totalKilled30d: number
  totalCreated30d: number
  avgCreatedPerDay: number
  avgKilledPerDay: number
  killRate: number
  updatedAt: string
  source: string
}

/* Tooltip for daily campaigns chart */
function DailyCampaignsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[var(--input)] bg-[var(--popover)] px-3 py-2 shadow-xl">
      <p className="text-[11px] text-[var(--muted-foreground)] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-[12px] font-medium" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

function OperationsTab({ data }: { data: BuyerResponse | null }) {
  const { t } = useI18n()
  const [lifecycle, setLifecycle] = useState<LifecycleData | null>(null)
  const [dailyCampaigns, setDailyCampaigns] = useState<DailyCampaignsData | null>(null)

  useEffect(() => {
    fetch("/api/mcc/keitaro/campaign-lifecycle")
      .then((r) => r.json())
      .then(setLifecycle)
      .catch(() => {})
    fetch("/api/mcc/keitaro/campaigns-daily")
      .then((r) => r.json())
      .then(setDailyCampaigns)
      .catch(() => {})
  }, [])

  const total = lifecycle?.total ?? 0
  const successRate =
    total > 0
      ? (((lifecycle?.scaled ?? 0) + (lifecycle?.optimized ?? 0)) / total) * 100
      : 0

  const funnelStages = [
    { label: "Tests", value: lifecycle?.tests ?? 0, color: "#4C8BF5" },
    { label: "Active", value: lifecycle?.active ?? 0, color: "#F5A623" },
    { label: "Scaled", value: lifecycle?.scaled ?? 0, color: "#52C67E" },
  ]

  const recentlyKilled = lifecycle?.recentlyKilled?.slice(0, 5) ?? []

  const chartData = useMemo(() => {
    if (!dailyCampaigns?.campaignsPerDay) return []
    return dailyCampaigns.campaignsPerDay.map((d) => ({
      date: d.date.slice(5), // MM-DD
      created: d.created,
      killed: d.killed,
    }))
  }, [dailyCampaigns?.campaignsPerDay])

  return (
    <div className="space-y-6">
      {/* Campaigns Per Day */}
      {chartData.length > 0 && (
        <Card className="backdrop-blur-md bg-[var(--card)]/80">
          <CardContent className="p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-4">
              CAMPAIGNS PER DAY
            </h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="fillCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent, #4C8BF5)" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="var(--accent, #4C8BF5)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillKilled" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--error, #E5484D)" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="var(--error, #E5484D)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="currentColor" strokeOpacity={0.04} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "hsl(220, 15%, 55%)", fontSize: 11 }}
                    axisLine={{ stroke: "currentColor", strokeOpacity: 0.04 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(220, 15%, 55%)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<DailyCampaignsTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="created"
                    name="Created"
                    stroke="var(--accent, #4C8BF5)"
                    strokeWidth={2}
                    fill="url(#fillCreated)"
                  />
                  <Area
                    type="monotone"
                    dataKey="killed"
                    name="Killed"
                    stroke="var(--error, #E5484D)"
                    strokeWidth={2}
                    fill="url(#fillKilled)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Compact metrics row */}
            <div className="flex flex-wrap items-center gap-6 mt-4 text-[13px]">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Avg created/day
                </span>
                <span className="ml-2 text-[14px] font-bold text-[var(--foreground)]">
                  {dailyCampaigns?.avgCreatedPerDay ?? "..."}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Avg killed/day
                </span>
                <span className="ml-2 text-[14px] font-bold text-[var(--foreground)]">
                  {dailyCampaigns?.avgKilledPerDay ?? "..."}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Kill rate
                </span>
                <span className="ml-2 text-[14px] font-bold text-[var(--foreground)]">
                  {dailyCampaigns ? `${dailyCampaigns.killRate}%` : "..."}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Active total
                </span>
                <span className="ml-2 text-[14px] font-bold text-[var(--foreground)]">
                  {dailyCampaigns?.totalActive?.toLocaleString() ?? "..."}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score Boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-5">
            <ScoreBox label="Tests" value={lifecycle?.tests ?? "..."} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox label="Active" value={lifecycle?.active ?? "..."} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox
              label="Scaled"
              value={lifecycle?.scaled ?? "..."}
              status={lifecycle ? (lifecycle.scaled > 0 ? "ok" : "neutral") : "neutral"}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox
              label="Killed"
              value={lifecycle?.killed ?? "..."}
              status={lifecycle ? (lifecycle.killed > 5 ? "stop" : lifecycle.killed > 0 ? "watch" : "ok") : "neutral"}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox
              label="Success Rate"
              value={lifecycle ? `${successRate.toFixed(1)}%` : "..."}
              status={lifecycle ? (successRate >= 30 ? "ok" : successRate >= 15 ? "watch" : "stop") : "neutral"}
            />
          </CardContent>
        </Card>
      </div>

      {/* Funnel Visualization */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-[13px] font-semibold text-[var(--foreground)] mb-5">
            Campaign Pipeline
          </h3>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {funnelStages.map((stage, i) => (
              <div key={stage.label} className="flex items-center gap-2">
                <div
                  className="flex flex-col items-center justify-center rounded-xl px-6 py-4 min-w-[120px] border"
                  style={{
                    backgroundColor: `${stage.color}10`,
                    borderColor: `${stage.color}30`,
                  }}
                >
                  <span className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    {stage.label}
                  </span>
                  <span
                    className="text-[28px] font-bold mt-1"
                    style={{ color: stage.color }}
                  >
                    {stage.value}
                  </span>
                </div>
                {i < funnelStages.length - 1 && (
                  <ArrowRight className="h-5 w-5 text-[var(--muted-foreground)] shrink-0" />
                )}
              </div>
            ))}
          </div>
          {total > 0 && (
            <p className="text-center text-[12px] text-[var(--muted-foreground)] mt-4">
              {total} total campaigns tracked &middot; {lifecycle?.killed ?? 0} killed &middot; {successRate.toFixed(1)}% success rate
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recently Killed */}
      {recentlyKilled.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Skull className="h-4 w-4 text-[var(--error)]" />
              <h3 className="text-[13px] font-semibold text-[var(--foreground)]">
                Recently Killed
              </h3>
            </div>
            <div className="space-y-2">
              {recentlyKilled.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-lg border border-[var(--border)] px-4 py-3 bg-[var(--error-muted)]"
                >
                  <span className="text-[13px] font-medium text-[var(--foreground)] flex-1 truncate max-w-[240px]">
                    {c.name}
                  </span>
                  <span className="text-[12px] text-[var(--muted-foreground)] shrink-0">
                    {fmt(c.spend)} spent
                  </span>
                  <span className="text-[12px] text-[var(--error)] shrink-0 max-w-[200px] truncate">
                    {c.reason}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export function MediaBuyingPage() {
  const { t } = useI18n()
  const [period, setPeriod] = useState(30)
  const [buyerData, setBuyerData] = useState<BuyerResponse | null>(null)
  const [prevBuyerData, setPrevBuyerData] = useState<BuyerResponse | null>(null)
  const [roiData, setRoiData] = useState<RoiResponse | null>(null)
  const [airtableOffers, setAirtableOffers] = useState<AirtableOffersData | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>("")

  const reload = () => {
    const to = new Date().toISOString().split("T")[0]
    const from = new Date(Date.now() - period * 86400000).toISOString().split("T")[0]
    const prevFrom = new Date(Date.now() - period * 2 * 86400000).toISOString().split("T")[0]
    const prevTo = new Date(Date.now() - period * 86400000).toISOString().split("T")[0]

    fetch(`/api/mcc/keitaro/buyers?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then(setBuyerData)
      .catch(() => {})
    fetch(`/api/mcc/keitaro/buyers?from=${prevFrom}&to=${prevTo}`)
      .then((r) => r.json())
      .then(setPrevBuyerData)
      .catch(() => setPrevBuyerData(null))
    fetch(`/api/mcc/keitaro/roi?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then(setRoiData)
      .catch(() => {})
    fetch("/api/mcc/airtable/offers")
      .then((r) => r.json())
      .then(setAirtableOffers)
      .catch(() => {})
    setLastUpdated(new Date().toISOString())
  }

  useEffect(() => {
    reload()
  }, [period])

  return (
    <>
      <PageHeader
        title={t("buying.title")}
        subtitle={t("buying.subtitle")}
        lastUpdated={lastUpdated || undefined}
        activePeriod={period}
        onPeriodChange={setPeriod}
        onRefresh={reload}
      />

      <Tabs defaultValue={0}>
        <TabsList
          variant="line"
          className="mb-6 border-b border-[var(--border)] pb-0"
        >
          <TabsTrigger value={0} className="text-[13px] px-4 py-2">
            {t("buying.overview")}
          </TabsTrigger>
          <TabsTrigger value={1} className="text-[13px] px-4 py-2">
            {t("buying.buyers")}
          </TabsTrigger>
          <TabsTrigger value={2} className="text-[13px] px-4 py-2">
            {t("buying.geo")}
          </TabsTrigger>
          <TabsTrigger value={3} className="text-[13px] px-4 py-2">
            {t("buying.offers")}
          </TabsTrigger>
          <TabsTrigger value={4} className="text-[13px] px-4 py-2">
            {t("buying.operations")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={0}>
          <OverviewTab data={buyerData} roi={roiData} prevData={prevBuyerData} />
        </TabsContent>
        <TabsContent value={1}>
          <BuyersTab data={buyerData} />
        </TabsContent>
        <TabsContent value={2}>
          <GeoTab roi={roiData} />
        </TabsContent>
        <TabsContent value={3}>
          <OffersTab roi={roiData} airtableOffers={airtableOffers} />
        </TabsContent>
        <TabsContent value={4}>
          <OperationsTab data={buyerData} />
        </TabsContent>
      </Tabs>
    </>
  )
}
