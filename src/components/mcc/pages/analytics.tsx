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
import { Input } from "@/components/ui/input"
import { ArrowUpDown, FlaskConical, BarChart3 } from "lucide-react"
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
/*  Tab: Ad Performance                                                */
/* ------------------------------------------------------------------ */

function AdPerformanceTab({ data }: { data: BuyerResponse | null }) {
  const { t } = useI18n()
  const [sortKey, setSortKey] = useState("cost")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [minSpend, setMinSpend] = useState("")

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const buyers = data?.buyers ?? []

  // Signal distribution
  const signalCounts = useMemo(() => {
    const counts = { OK: 0, WATCH: 0, STOP: 0, NEW: 0 }
    for (const b of buyers) {
      const s = b.signal as keyof typeof counts
      if (s in counts) counts[s]++
    }
    return counts
  }, [buyers])

  const filtered = useMemo(() => {
    const min = parseFloat(minSpend) || 0
    return [...buyers]
      .filter((b) => b.cost >= min)
      .sort((a, b) => {
        const av = a[sortKey as keyof Buyer]
        const bv = b[sortKey as keyof Buyer]
        if (typeof av === "number" && typeof bv === "number") {
          return sortDir === "asc" ? av - bv : bv - av
        }
        return sortDir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av))
      })
  }, [buyers, sortKey, sortDir, minSpend])

  return (
    <div className="space-y-5">
      {/* Signal Distribution */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <ScoreBox label="OK" value={signalCounts.OK} status="ok" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox label="WATCH" value={signalCounts.WATCH} status="watch" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox label="STOP" value={signalCounts.STOP} status="stop" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox label="NEW" value={signalCounts.NEW} status="neutral" />
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-[12px] text-[var(--muted-foreground)] font-medium">{t("analytics.minSpend")}</label>
        <Input
          type="number"
          placeholder="0"
          value={minSpend}
          onChange={(e) => setMinSpend(e.target.value)}
          className="w-32 h-8 bg-[var(--card)] border-[var(--input)] text-[var(--foreground)] text-[13px] placeholder:text-[var(--muted-foreground)]"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b-[var(--border)] hover:bg-transparent">
                <SortableHead label={t("buying.buyer")} sortKey="buyer" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="pl-5" />
                <SortableHead label={t("buying.clicks")} sortKey="clicks" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHead label={t("common.ftds")} sortKey="conversions" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHead label={t("buying.spend")} sortKey="cost" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHead label={t("summary.revenue")} sortKey="revenue" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHead label={t("summary.profit")} sortKey="profit" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHead label={t("common.roi")} sortKey="roi" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHead label={t("common.cpa")} sortKey="cpa" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <TableHead className="text-[var(--muted-foreground)] text-[12px] font-semibold">{t("buying.signal")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => (
                <TableRow
                  key={b.buyer}
                  className="border-b-[var(--border)] hover:bg-[var(--muted)]"
                >
                  <TableCell className="pl-5 text-[13px] font-medium text-[var(--foreground)]">
                    {b.buyer}
                  </TableCell>
                  <TableCell className="text-[13px] text-[var(--secondary-foreground)]">
                    {b.clicks.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-[13px] text-[var(--secondary-foreground)]">
                    {b.conversions.toLocaleString()}
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
                  <TableCell>
                    <SignalBadge signal={b.signal as Signal} />
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-[var(--muted-foreground)] py-12">
                    {buyers.length === 0 ? "Loading..." : "No buyers match the filter."}
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
/*  Tab: Geo Benchmarks                                                */
/* ------------------------------------------------------------------ */

function GeoBenchmarksTab({ roi }: { roi: RoiResponse | null }) {
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

  const geos = useMemo(() => {
    if (!roi?.byGeo) return []
    return [...roi.byGeo].sort((a, b) => {
      const av = a[sortKey as keyof RoiRow]
      const bv = b[sortKey as keyof RoiRow]
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
  }, [roi?.byGeo, sortKey, sortDir])

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-b-[var(--border)] hover:bg-transparent">
              <SortableHead label={t("buying.country")} sortKey="grouping" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="pl-5" />
              <SortableHead label={t("buying.clicks")} sortKey="clicks" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHead label={t("buying.conversions")} sortKey="conversions" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHead label={t("summary.revenue")} sortKey="revenue" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHead label={t("buying.cost")} sortKey="cost" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHead label={t("summary.profit")} sortKey="profit" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHead label={t("common.roi")} sortKey="roi" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHead label={t("common.cpa")} sortKey="cpa" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {geos.map((g) => (
              <TableRow
                key={g.grouping}
                className="border-b-[var(--border)] hover:bg-[var(--muted)]"
              >
                <TableCell className="pl-5 text-[13px] font-medium text-[var(--foreground)]">
                  {g.grouping}
                </TableCell>
                <TableCell className="text-[13px] text-[var(--secondary-foreground)]">
                  {g.clicks.toLocaleString()}
                </TableCell>
                <TableCell className="text-[13px] text-[var(--secondary-foreground)]">
                  {g.conversions.toLocaleString()}
                </TableCell>
                <TableCell className="text-[13px] text-[var(--secondary-foreground)]">{fmt(g.revenue)}</TableCell>
                <TableCell className="text-[13px] text-[var(--secondary-foreground)]">{fmt(g.cost)}</TableCell>
                <TableCell className={`text-[13px] font-medium ${profitColor(g.profit)}`}>
                  {fmt(g.profit)}
                </TableCell>
                <TableCell className={`text-[13px] font-medium ${profitColor(g.roi)}`}>
                  {fmtPct(g.roi)}
                </TableCell>
                <TableCell className="text-[13px] text-[var(--secondary-foreground)]">
                  ${g.cpa.toFixed(0)}
                </TableCell>
              </TableRow>
            ))}
            {geos.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-[var(--muted-foreground)] py-12">
                  Loading geo data...
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
/*  Tab: Conversion Quality                                            */
/* ------------------------------------------------------------------ */

function ConversionQualityTab() {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      <Card className="border-[var(--border)]">
        <CardContent className="p-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <FlaskConical className="h-5 w-5 text-[var(--accent)]" />
            <h3 className="text-[15px] font-semibold text-[var(--foreground)]">
              {t("analytics.convQualityAnalysis")}
            </h3>
          </div>
          <p className="text-[13px] text-[var(--muted-foreground)] max-w-lg mx-auto leading-relaxed mb-6">
            Requires analytics service (port 3806). When connected, this tab
            will show approval rates, rejection rates, and revenue
            reconciliation data.
          </p>
        </CardContent>
      </Card>

      {/* Preview of data structure */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-[13px] font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[var(--muted-foreground)]" />
            {t("analytics.availableWhenConnected")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Approval Rate", desc: "% of conversions approved by advertiser" },
              { label: "Rejection Rate", desc: "% of conversions rejected or chargebacked" },
              { label: "Revenue Delta", desc: "Difference between reported and actual revenue" },
              { label: "Quality Score", desc: "Composite score based on approval, retention, LTV" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4"
              >
                <p className="text-[13px] font-medium text-[var(--secondary-foreground)]">{item.label}</p>
                <p className="text-[12px] text-[var(--muted-foreground)] mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export function AnalyticsPage() {
  const { t } = useI18n()
  const [period, setPeriod] = useState(30)
  const [buyerData, setBuyerData] = useState<BuyerResponse | null>(null)
  const [roiData, setRoiData] = useState<RoiResponse | null>(null)

  const reload = () => {
    const to = new Date().toISOString().split("T")[0]
    const from = new Date(Date.now() - period * 86400000).toISOString().split("T")[0]
    fetch(`/api/mcc/keitaro/buyers?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then(setBuyerData)
      .catch(() => {})
    fetch(`/api/mcc/keitaro/roi?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then(setRoiData)
      .catch(() => {})
  }

  useEffect(() => {
    reload()
  }, [period])

  return (
    <>
      <PageHeader
        title={t("analytics.title")}
        subtitle={t("analytics.subtitle")}
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
            {t("analytics.adPerformance")}
          </TabsTrigger>
          <TabsTrigger value={1} className="text-[13px] px-4 py-2">
            {t("analytics.geoBenchmarks")}
          </TabsTrigger>
          <TabsTrigger value={2} className="text-[13px] px-4 py-2">
            {t("analytics.convQuality")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={0}>
          <AdPerformanceTab data={buyerData} />
        </TabsContent>
        <TabsContent value={1}>
          <GeoBenchmarksTab roi={roiData} />
        </TabsContent>
        <TabsContent value={2}>
          <ConversionQualityTab />
        </TabsContent>
      </Tabs>
    </>
  )
}
