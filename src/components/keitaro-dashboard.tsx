"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  RefreshCw, TrendingUp, TrendingDown, AlertTriangle,
  BarChart3, CircleDot, CheckCircle2, XCircle, HelpCircle,
  ChevronDown, ChevronUp, TableProperties, Layers, GitBranch, Loader2,
  Package, Filter,
} from "lucide-react"
import type {
  KeitaroDashboardResponse, EnrichedCampaign, CampaignStatus, CampaignType, CostModelType, OfferStat,
  GeoBenchmarksResponse, GeoBenchmark,
  CampaignStreamsResponse, StreamInfo,
  OffersResponse, OfferView, OfferStatus, FunnelStat,
} from "@aap/types"

// ─── Helpers ────────────────────────────────────────────────────────
function fmt$(v: number) {
  if (v === 0) return "$0"
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`
  return `$${v.toFixed(0)}`
}
function fmtNum(v: number) { return v.toLocaleString() }

function statusConfig(s: CampaignStatus) {
  switch (s) {
    case "success":
      return {
        label: "Успешная",
        icon: CheckCircle2,
        border: "border-l-green-500",
        bg: "bg-green-50 dark:bg-green-950/20",
        badge: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
      }
    case "failed":
      return {
        label: "Провальная",
        icon: XCircle,
        border: "border-l-red-500",
        bg: "bg-red-50 dark:bg-red-950/20",
        badge: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
      }
    case "decision":
      return {
        label: "Требует решения",
        icon: AlertTriangle,
        border: "border-l-amber-500",
        bg: "bg-amber-50 dark:bg-amber-950/20",
        badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
      }
    default:
      return {
        label: "Нет данных",
        icon: HelpCircle,
        border: "border-l-gray-300",
        bg: "bg-gray-50 dark:bg-gray-900/20",
        badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
      }
  }
}

// ─── Campaign type badge ─────────────────────────────────────────────
const CAMPAIGN_TYPE_META: Record<CampaignType, { label: string; cls: string }> = {
  offer:         { label: "🟢 Offer",         cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  app:           { label: "🟠 App/PWA",        cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  cloak:         { label: "🟡 Cloak",          cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
  funnel_owner:  { label: "🟦 Funnel Owner",   cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  offer_manager: { label: "🟩 Offer Manager",  cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  default_app:   { label: "🟨 Default App",    cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  unknown:       { label: "⚪ Unknown",         cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
}

// ─── Cost model badge ────────────────────────────────────────────────
const COST_MODEL_META: Partial<Record<CostModelType, { label: string; cls: string }>> = {
  cpc:      { label: "CPC",      cls: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  cpm:      { label: "CPM",      cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  cpa:      { label: "CPA",      cls: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300" },
  revshare: { label: "RevShare", cls: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300" },
  fixed:    { label: "Fixed",    cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
}

// ─── Geo Benchmark Table ─────────────────────────────────────────────
function GeoBenchmarkTable({ benchmarks, period }: { benchmarks: GeoBenchmark[]; period: { from: string; to: string } }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/40 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <TableProperties className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Эталонный CPA по гео</span>
          <span className="text-xs text-muted-foreground">
            (успешные кампании за 12 мес., {period.from} — {period.to})
          </span>
          {benchmarks.length > 0 && (
            <Badge variant="secondary" className="text-xs">{benchmarks.length} гео</Badge>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border overflow-x-auto">
          {benchmarks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Нет данных по успешным кампаниям за последний год.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Гео</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Кампаний</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Ср. CPA</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Мин. CPA</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Макс. CPA</th>
                </tr>
              </thead>
              <tbody>
                {benchmarks.map((b) => (
                  <tr key={b.geo} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2 font-medium">{b.geo}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{b.count}</td>
                    <td className="px-4 py-2 text-right font-semibold font-mono text-green-600 dark:text-green-400">
                      {fmt$(b.avgCpa)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-muted-foreground">{fmt$(b.minCpa)}</td>
                    <td className="px-4 py-2 text-right font-mono text-muted-foreground">{fmt$(b.maxCpa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Schema label ────────────────────────────────────────────────────
function schemaLabel(schema: string) {
  const map: Record<string, string> = {
    "prelanding+landing": "Pre-lnd → Lnd",
    "prelanding": "Pre-lnd",
    "landing": "Landing",
    "direct": "Direct",
    "": "Landing",
  }
  return map[schema.toLowerCase()] ?? schema
}

function schemaBadgeClass(schema: string) {
  const s = schema.toLowerCase()
  if (s.includes("prelanding")) return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
  if (s === "direct") return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
  return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
}

// ─── Offers Breakdown ─────────────────────────────────────────────────
function OffersBreakdown({ offers }: { offers: OfferStat[] }) {
  const [open, setOpen] = useState(false)
  if (offers.length === 0) return null

  const topOffer = offers[0]

  return (
    <div className="border-t border-border/60 mt-2 pt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left"
      >
        <Layers className="h-3 w-3 shrink-0" />
        <span>Офферы</span>
        <span className="ml-1 text-xs font-normal text-muted-foreground/70">
          ({offers.length}) · топ: <span className="font-medium text-foreground/80 truncate max-w-[120px] inline-block align-bottom">{topOffer.name}</span>
        </span>
        <span className="ml-auto shrink-0">{open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</span>
      </button>

      {open && (
        <div className="mt-2 overflow-x-auto rounded border border-border/50">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border/50">
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Оффер</th>
                <th className="text-right px-2 py-1.5 font-medium text-muted-foreground">Доля</th>
                <th className="text-right px-2 py-1.5 font-medium text-muted-foreground">Клики</th>
                <th className="text-right px-2 py-1.5 font-medium text-muted-foreground">Conv.</th>
                <th className="text-right px-2 py-1.5 font-medium text-muted-foreground">CR%</th>
                <th className="text-right px-2 py-1.5 font-medium text-muted-foreground">CPA</th>
                <th className="text-right px-2 py-1.5 font-medium text-muted-foreground">ROI%</th>
                <th className="text-right px-2 py-1.5 font-medium text-muted-foreground">Доход</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.name} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <td className="px-2 py-1.5 max-w-[140px]">
                    <span className="truncate block" title={o.name}>{o.name}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <div className="h-1.5 w-10 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-400 dark:bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(o.shareClicks, 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-muted-foreground">{o.shareClicks.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{fmtNum(o.clicks)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmtNum(o.conversions)}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">
                    {o.cr > 0 ? o.cr.toFixed(2) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono font-medium">
                    {o.cpa > 0 ? fmt$(o.cpa) : "—"}
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono font-semibold ${o.conversions > 0 ? (o.roi >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400") : "text-muted-foreground"}`}>
                    {o.conversions > 0 ? `${o.roi.toFixed(0)}%` : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{fmt$(o.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Streams Breakdown ────────────────────────────────────────────────
function StreamsBreakdown({ campaignId }: { campaignId: number }) {
  const [open, setOpen] = useState(false)
  const [streams, setStreams] = useState<StreamInfo[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStreams = useCallback(async () => {
    if (streams !== null) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/keitaro/campaigns/${campaignId}/streams`)
      const data: CampaignStreamsResponse = await res.json()
      if (data.error) setError(data.error)
      else setStreams(data.streams)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки")
    } finally {
      setLoading(false)
    }
  }, [campaignId, streams])

  const handleToggle = () => {
    const next = !open
    setOpen(next)
    if (next) fetchStreams()
  }

  const activeStreams = streams?.filter((s) => s.status === "active") ?? []
  const totalStreams = streams?.length ?? 0

  return (
    <div className="border-t border-border/60 mt-2 pt-2">
      <button
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left"
      >
        <GitBranch className="h-3 w-3 shrink-0" />
        <span>Воронки / потоки</span>
        {streams !== null && (
          <span className="ml-1 text-xs font-normal text-muted-foreground/70">
            ({activeStreams.length} активных из {totalStreams})
          </span>
        )}
        {loading && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
        <span className="ml-auto shrink-0">{open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</span>
      </button>

      {open && (
        <div className="mt-2">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Загрузка потоков…
            </div>
          )}
          {error && (
            <p className="text-xs text-red-500 py-1">{error}</p>
          )}
          {streams !== null && streams.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">Потоки не найдены.</p>
          )}
          {streams !== null && streams.length > 0 && (
            <div className="space-y-1.5">
              {streams.map((s) => (
                <div
                  key={s.id}
                  className={`rounded border px-2.5 py-2 text-xs ${
                    s.status === "active"
                      ? "border-border/60 bg-background"
                      : "border-border/30 bg-muted/20 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate max-w-[140px]" title={s.name}>{s.name}</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${schemaBadgeClass(s.schema)}`}>
                      {schemaLabel(s.schema)}
                    </span>
                    {s.weight !== 100 && (
                      <span className="text-muted-foreground">{s.weight}%</span>
                    )}
                    {s.status !== "active" && (
                      <span className="text-muted-foreground italic">{s.status}</span>
                    )}
                  </div>
                  {s.offerNames.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.offerNames.map((name) => (
                        <span
                          key={name}
                          className="inline-block px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] truncate max-w-[160px]"
                          title={name}
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Campaign Card ──────────────────────────────────────────────────
function CampaignCard({ c, from, to }: { c: EnrichedCampaign; from: string; to: string }) {
  const [expanded, setExpanded] = useState(false)
  const isOffer = c.campaignType === 'offer'
  // For non-offer campaigns show neutral border instead of status color
  const cfg = isOffer ? statusConfig(c.status) : statusConfig('no_data')
  const Icon = cfg.icon
  const { stats } = c
  const hasStats = stats.cost > 0 || stats.clicks > 0
  const typeMeta = CAMPAIGN_TYPE_META[c.campaignType ?? 'unknown']
  const costModelMeta = c.costModel ? COST_MODEL_META[c.costModel as CostModelType] : undefined

  return (
    <Card className={`border-l-4 ${cfg.border} ${cfg.bg} transition-all`}>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Campaign type badge */}
              <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${typeMeta.cls}`}>
                {typeMeta.label}
              </span>
              {/* CPA status — only for offer campaigns */}
              {isOffer && (
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                  <Icon className="h-3 w-3" />
                  {cfg.label}
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                  c.state === "active"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${c.state === "active" ? "bg-blue-500" : "bg-gray-400"}`} />
                {c.state === "active" ? "Active" : c.state}
              </span>
              {c.geo && c.geo !== "Unknown" && (
                <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-mono">
                  {c.geo}
                </span>
              )}
              {costModelMeta && (
                <span className={`inline-flex items-center text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${costModelMeta.cls}`}>
                  {costModelMeta.label}
                </span>
              )}
            </div>
            <p className="text-sm font-medium mt-1 leading-tight line-clamp-2">{c.name}</p>
          </div>
          <Link
            href={`/keitaro/campaigns/${c.id}?from=${from}&to=${to}`}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground border border-border rounded px-1.5 py-0.5 hover:bg-accent transition-colors whitespace-nowrap"
          >
            Деталі →
          </Link>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-3 pt-0 space-y-3">
        {hasStats ? (
          <>
            {isOffer ? (
              <>
                {/* CPA metrics — offer campaigns only */}
                <div className="grid grid-cols-3 gap-2">
                  <MetricCell label="Расход" value={fmt$(stats.cost)} />
                  <MetricCell label="Доход" value={fmt$(stats.revenue)} />
                  <MetricCell
                    label="Прибыль"
                    value={fmt$(stats.profit)}
                    className={stats.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
                  />
                  <MetricCell
                    label="ROI"
                    value={`${stats.roi.toFixed(1)}%`}
                    className={stats.roi >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
                    icon={stats.roi >= 0 ? TrendingUp : TrendingDown}
                  />
                  <MetricCell label="CPA" value={stats.cpa > 0 ? fmt$(stats.cpa) : "—"} />
                  <MetricCell label="CR" value={stats.cr > 0 ? `${stats.cr.toFixed(2)}%` : "—"} />
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Клики: <b className="text-foreground">{fmtNum(stats.clicks)}</b></span>
                  <span>Конверсии: <b className="text-foreground">{fmtNum(stats.conversions)}</b></span>
                  {stats.leads > 0 && <span>Лиды: <b className="text-foreground">{fmtNum(stats.leads)}</b></span>}
                  {stats.sales > 0 && <span>Продажи: <b className="text-foreground">{fmtNum(stats.sales)}</b></span>}
                  {c.paybackMonths !== null && (
                    <span>
                      Окупаемость:{" "}
                      <b className={
                        c.paybackMonths <= 3 ? "text-green-600 dark:text-green-400"
                        : c.paybackMonths <= 4 ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400"
                      }>
                        {c.paybackMonths.toFixed(1)} мес.
                      </b>
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Spend/infra metrics — non-offer campaigns, adapted per cost model */}
                <div className="grid grid-cols-3 gap-2">
                  <MetricCell label="Витрати" value={fmt$(stats.cost)} />
                  <MetricCell label="Кліки" value={fmtNum(stats.clicks)} />
                  {c.costModel === 'cpc' && stats.cpc > 0
                    ? <MetricCell label="CPC" value={`$${stats.cpc.toFixed(3)}`} />
                    : c.costModel === 'cpm' && stats.cpc > 0
                      ? <MetricCell label="CPM" value={`$${(stats.cpc * 1000).toFixed(2)}`} />
                      : <MetricCell label="CR" value={stats.cr > 0 ? `${stats.cr.toFixed(2)}%` : "—"} />
                  }
                </div>
                {(stats.conversions > 0 || stats.leads > 0 || (c.costModel === 'cpc' && stats.cr > 0)) && (
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {c.costModel === 'cpc' && stats.cr > 0 && <span>CR: <b className="text-foreground">{stats.cr.toFixed(2)}%</b></span>}
                    {stats.conversions > 0 && <span>Події: <b className="text-foreground">{fmtNum(stats.conversions)}</b></span>}
                    {stats.leads > 0 && <span>Ліди: <b className="text-foreground">{fmtNum(stats.leads)}</b></span>}
                    {c.rotationType === 'weight' && <span className="text-muted-foreground/60 italic">ротація за вагою</span>}
                  </div>
                )}
              </>
            )}

            {/* Offer breakdown — only meaningful for offer campaigns */}
            {isOffer && c.offerBreakdown.length > 0 && (
              <OffersBreakdown offers={c.offerBreakdown} />
            )}

            {/* Streams */}
            <StreamsBreakdown campaignId={c.id} />

            {/* Recommendation note */}
            {c.recommendation && (
              <div className="mt-2 border-t pt-2">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left"
                >
                  <BarChart3 className="h-3 w-3 shrink-0" />
                  <span>{isOffer ? "Аналитическая заметка" : "Опис кампанії"}</span>
                  <span className="ml-auto">{expanded ? "↑" : "↓"}</span>
                </button>
                {expanded && (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {c.recommendation}
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Недостатньо даних (витрати &lt;${150}, кліків &lt;100).
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function MetricCell({
  label,
  value,
  className = "",
  icon: Icon,
}: {
  label: string
  value: string
  className?: string
  icon?: React.ElementType
}) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold flex items-center gap-0.5 ${className}`}>
        {Icon && <Icon className="h-3 w-3" />}
        {value}
      </span>
    </div>
  )
}

// ─── Summary Cards ───────────────────────────────────────────────────
function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  active,
  onClick,
  colorClass,
}: {
  icon: React.ElementType
  label: string
  value: number
  sub?: string
  active?: boolean
  onClick: () => void
  colorClass: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[110px] text-left p-3 rounded-lg border transition-all hover:shadow-sm ${
        active ? "border-foreground/30 bg-accent shadow-sm" : "border-border bg-card hover:bg-accent/40"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${colorClass}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </button>
  )
}

// ─── Offer status config ──────────────────────────────────────────────
function offerStatusConfig(s: OfferStatus) {
  switch (s) {
    case "success":
      return {
        label: "Прибыльный",
        icon: CheckCircle2,
        border: "border-l-green-500",
        bg: "bg-green-50 dark:bg-green-950/20",
        badge: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
      }
    case "failed":
      return {
        label: "Убыточный",
        icon: XCircle,
        border: "border-l-red-500",
        bg: "bg-red-50 dark:bg-red-950/20",
        badge: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
      }
    case "decision":
      return {
        label: "Требует решения",
        icon: AlertTriangle,
        border: "border-l-amber-500",
        bg: "bg-amber-50 dark:bg-amber-950/20",
        badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
      }
    default:
      return {
        label: "Нет данных",
        icon: HelpCircle,
        border: "border-l-gray-300",
        bg: "bg-gray-50 dark:bg-gray-900/20",
        badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
      }
  }
}

// ─── Funnel Schema Breakdown ──────────────────────────────────────────
function FunnelSchemaBreakdown({ funnels }: { funnels: FunnelStat[] }) {
  const withTraffic = funnels.filter((f) => f.clicks > 0)
  if (withTraffic.length === 0) return null

  type SchemaGroup = {
    schema: string
    count: number
    totalClicks: number
    totalConversions: number
    totalCost: number
    totalRevenue: number
    totalProfit: number
  }
  const groups = new Map<string, SchemaGroup>()
  for (const f of withTraffic) {
    const key = f.schema || "landing"
    const g = groups.get(key) ?? {
      schema: key, count: 0, totalClicks: 0, totalConversions: 0,
      totalCost: 0, totalRevenue: 0, totalProfit: 0,
    }
    g.count++
    g.totalClicks += f.clicks
    g.totalConversions += f.conversions
    g.totalCost += f.cost
    g.totalRevenue += f.revenue
    g.totalProfit += f.profit
    groups.set(key, g)
  }

  const rows = [...groups.values()]
    .map((g) => ({
      ...g,
      roi: g.totalCost > 0 ? ((g.totalRevenue - g.totalCost) / g.totalCost) * 100 : 0,
      cpa: g.totalConversions > 0 ? g.totalCost / g.totalConversions : 0,
      cr: g.totalClicks > 0 ? (g.totalConversions / g.totalClicks) * 100 : 0,
    }))
    .sort((a, b) => b.totalClicks - a.totalClicks)

  if (rows.length < 2) return null // только одна схема — нечего сравнивать

  return (
    <div className="rounded-md border border-border/50 overflow-hidden">
      <div className="bg-muted/30 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <BarChart3 className="h-3 w-3" />
        Эффективность по схеме воронки
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/30 bg-muted/10">
            <th className="text-left px-3 py-1 text-muted-foreground font-medium">Схема</th>
            <th className="text-right px-2 py-1 text-muted-foreground font-medium">Клики</th>
            <th className="text-right px-2 py-1 text-muted-foreground font-medium">Конв.</th>
            <th className="text-right px-2 py-1 text-muted-foreground font-medium">CR%</th>
            <th className="text-right px-2 py-1 text-muted-foreground font-medium">CPA</th>
            <th className="text-right px-3 py-1 text-muted-foreground font-medium">ROI%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.schema} className="border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors">
              <td className="px-3 py-1.5">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${schemaBadgeClass(g.schema)}`}>
                  {schemaLabel(g.schema)}
                </span>
                <span className="ml-1.5 text-muted-foreground">{g.count} вор.</span>
              </td>
              <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{fmtNum(g.totalClicks)}</td>
              <td className="px-2 py-1.5 text-right font-mono">{fmtNum(g.totalConversions)}</td>
              <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">
                {g.cr > 0 ? g.cr.toFixed(2) : "—"}
              </td>
              <td className="px-2 py-1.5 text-right font-mono">
                {g.cpa > 0 ? fmt$(g.cpa) : "—"}
              </td>
              <td className={`px-3 py-1.5 text-right font-mono font-semibold ${
                g.totalConversions > 0
                  ? g.roi >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"
                  : "text-muted-foreground"
              }`}>
                {g.totalConversions > 0 ? `${g.roi.toFixed(0)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Stream type badge ────────────────────────────────────────────────
function streamTypeBadge(type: string) {
  if (type === "forced") return { label: "forced", cls: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300" }
  if (type === "position") return { label: "position", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" }
  return { label: type, cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" }
}

// ─── Funnel Row ───────────────────────────────────────────────────────
function FunnelRow({ f }: { f: FunnelStat }) {
  const [open, setOpen] = useState(false)
  const hasStats = f.clicks > 0
  const typeBadge = streamTypeBadge(f.streamType ?? "position")

  const roiColor = f.conversions > 0
    ? (f.roi >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400")
    : "text-muted-foreground"

  return (
    <div className={`rounded-md border text-xs ${
      f.streamStatus === "active"
        ? "border-border/60 bg-background"
        : "border-border/30 bg-muted/20 opacity-60"
    }`}>
      {/* Funnel header row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/30 transition-colors text-left rounded-md"
      >
        <GitBranch className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="font-medium truncate max-w-[120px]" title={f.streamName}>{f.streamName}</span>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${typeBadge.cls}`}>
          {typeBadge.label}
        </span>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${schemaBadgeClass(f.schema)}`}>
          {schemaLabel(f.schema)}
        </span>
        {f.streamType !== "forced" && f.weight !== 100 && (
          <span className="text-muted-foreground shrink-0">{f.weight}%</span>
        )}
        {f.streamStatus !== "active" && (
          <span className="text-muted-foreground italic shrink-0">{f.streamStatus}</span>
        )}

        {/* Stats inline */}
        {hasStats && (
          <div className="ml-auto flex items-center gap-3 shrink-0 font-mono">
            <span className="text-muted-foreground">{fmtNum(f.clicks)} кл.</span>
            {f.conversions > 0 && (
              <>
                <span>{fmtNum(f.conversions)} конв.</span>
                <span className={roiColor}>{f.roi.toFixed(0)}%</span>
                <span className="text-muted-foreground">{fmt$(f.cpa)} CPA</span>
              </>
            )}
            {f.conversions === 0 && <span className="text-muted-foreground">0 конв.</span>}
          </div>
        )}
        {!hasStats && <span className="ml-auto text-muted-foreground">нет трафика</span>}
        <span className="ml-2 shrink-0">{open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</span>
      </button>

      {/* Expanded funnel detail */}
      {open && (
        <div className="border-t border-border/40 px-3 py-2.5 space-y-2.5">
          {/* Stats grid */}
          {hasStats && (
            <div className="grid grid-cols-4 gap-x-4 gap-y-1">
              <div className="flex flex-col">
                <span className="text-muted-foreground">Расход</span>
                <span className="font-semibold font-mono">{fmt$(f.cost)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Доход</span>
                <span className="font-semibold font-mono">{fmt$(f.revenue)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Прибыль</span>
                <span className={`font-semibold font-mono ${f.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                  {fmt$(f.profit)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">CR</span>
                <span className="font-semibold font-mono">{f.cr > 0 ? `${f.cr.toFixed(2)}%` : "—"}</span>
              </div>
            </div>
          )}

          {/* Setup pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide mr-1">Сетап</span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${typeBadge.cls}`}>
              {typeBadge.label}
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${schemaBadgeClass(f.schema)}`}>
              {schemaLabel(f.schema)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              вес <b className="text-foreground">{f.weight}%</b>
            </span>
            <span className="text-[10px] text-muted-foreground truncate max-w-[160px]" title={f.campaignName}>
              · {f.campaignName}
            </span>
          </div>

          {/* Recommendation */}
          <div className="flex items-start gap-1.5 rounded bg-muted/40 px-2.5 py-2">
            <BarChart3 className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
            <p className="leading-relaxed text-muted-foreground">{f.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Offer Card (summary — click to navigate to detail page) ────────────
function OfferCard({ offer, from, to }: { offer: OfferView; from: string; to: string }) {
  const router = useRouter()
  const cfg = offerStatusConfig(offer.status)
  const Icon = cfg.icon
  const { stats } = offer
  const hasStats = stats.cost > 0 || stats.clicks > 0
  const activeFunnels = offer.funnels.filter((f) => f.streamStatus === "active")
  const bestFunnel = offer.funnels
    .filter((f) => f.streamStatus === "active" && f.conversions > 0 && f.clicks > 50)
    .sort((a, b) => b.roi - a.roi)[0]

  const href = `/keitaro/offers/${encodeURIComponent(offer.name)}?from=${from}&to=${to}`

  return (
    <Card
      className={`border-l-4 ${cfg.border} ${cfg.bg} cursor-pointer hover:shadow-md hover:border-l-[5px] transition-all`}
      onClick={() => router.push(href)}
    >
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                <Icon className="h-3 w-3" />
                {cfg.label}
              </span>
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Package className="h-3 w-3" />
                Оффер
              </span>
              {offer.funnels.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {activeFunnels.length} з {offer.funnels.length} воронок активні
                </span>
              )}
            </div>
            <p className="text-sm font-semibold mt-1.5 leading-tight">{offer.name}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1 -rotate-90" />
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-3 pt-0 space-y-2.5">
        {hasStats ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <MetricCell label="Расход" value={fmt$(stats.cost)} />
              <MetricCell label="Доход" value={fmt$(stats.revenue)} />
              <MetricCell
                label="Прибыль"
                value={fmt$(stats.profit)}
                className={stats.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
              />
              <MetricCell
                label="ROI"
                value={`${stats.roi.toFixed(1)}%`}
                className={stats.roi >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
                icon={stats.roi >= 0 ? TrendingUp : TrendingDown}
              />
              <MetricCell label="CPA" value={stats.cpa > 0 ? fmt$(stats.cpa) : "—"} />
              <MetricCell label="CR" value={stats.cr > 0 ? `${stats.cr.toFixed(2)}%` : "—"} />
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Кліки: <b className="text-foreground">{fmtNum(stats.clicks)}</b></span>
              <span>Конверсії: <b className="text-foreground">{fmtNum(stats.conversions)}</b></span>
            </div>
            {bestFunnel && (
              <div className="flex items-center gap-1.5 text-xs border-t border-border/40 pt-2">
                <TrendingUp className="h-3 w-3 text-green-500 shrink-0" />
                <span className="text-muted-foreground">Краща воронка:</span>
                <span className="font-medium truncate" title={bestFunnel.streamName}>{bestFunnel.streamName}</span>
                <span className="font-mono font-semibold text-green-600 dark:text-green-400 ml-auto shrink-0">
                  ROI {bestFunnel.roi.toFixed(0)}%
                </span>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Недостатньо даних за обраний період.</p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Offers View ──────────────────────────────────────────────────────
type OfferFilterTab = "all" | OfferStatus

function OffersView({ onRefresh, refreshing, from, to }: {
  onRefresh: () => void
  refreshing: boolean
  from: string
  to: string
}) {
  const [data, setData] = useState<OffersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<OfferFilterTab>("all")

  const load = useCallback(async (bust = false) => {
    if (bust) {
      await fetch("/api/keitaro/offers", { method: "POST" })
    }
    try {
      const res = await fetch(`/api/keitaro/offers?from=${from}&to=${to}`)
      const json: OffersResponse = await res.json()
      setData(json)
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { load() }, [load])

  // Expose refresh to parent
  useEffect(() => {
    if (refreshing) load(true)
  }, [refreshing, load])

  if (loading) return <LoadingSkeleton />

  if (!data) return <p className="text-muted-foreground text-sm">Нет данных</p>

  if (data.error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">
        <b>Ошибка загрузки офферов:</b> {data.error}
      </div>
    )
  }

  const { offers, period } = data
  const counts = {
    all: offers.length,
    success: offers.filter((o) => o.status === "success").length,
    decision: offers.filter((o) => o.status === "decision").length,
    failed: offers.filter((o) => o.status === "failed").length,
    no_data: offers.filter((o) => o.status === "no_data").length,
  }
  const filtered = filter === "all" ? offers : offers.filter((o) => o.status === filter)

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        Период: {period.from} — {period.to} (текущий месяц) ·{" "}
        Обновлено: {new Date(data.lastUpdated).toLocaleTimeString("ru-RU")}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(["all", "success", "decision", "failed", "no_data"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`flex-1 min-w-[90px] text-left p-2.5 rounded-lg border transition-all hover:shadow-sm text-xs ${
              filter === tab ? "border-foreground/30 bg-accent shadow-sm" : "border-border bg-card hover:bg-accent/40"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              {tab === "all" && <CircleDot className="h-3.5 w-3.5 text-foreground" />}
              {tab === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
              {tab === "decision" && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
              {tab === "failed" && <XCircle className="h-3.5 w-3.5 text-red-500" />}
              {tab === "no_data" && <HelpCircle className="h-3.5 w-3.5 text-gray-400" />}
              <span className="text-muted-foreground">
                {tab === "all" ? "Все" : tab === "success" ? "Прибыльные" : tab === "decision" ? "На решении" : tab === "failed" ? "Убыточные" : "Нет данных"}
              </span>
            </div>
            <div className="text-xl font-bold">{counts[tab]}</div>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Нет офферов в этой категории</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((o) => (
            <OfferCard key={o.name} offer={o} from={from} to={to} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Loading Skeleton ────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="flex gap-3 flex-wrap">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 flex-1 min-w-[110px] rounded-lg" />
        ))}
      </div>
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-36 w-full rounded-lg" />
      ))}
    </div>
  )
}

// ─── Date range picker ────────────────────────────────────────────────
type DatePreset = "this_month" | "last_month" | "7d" | "30d" | "90d" | "custom"

function fmtDate(d: Date) { return d.toISOString().split("T")[0] }

function presetRange(preset: Exclude<DatePreset, "custom">): { from: string; to: string } {
  const today = new Date()
  switch (preset) {
    case "this_month":
      return { from: fmtDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmtDate(today) }
    case "last_month": {
      const f = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const t = new Date(today.getFullYear(), today.getMonth(), 0)
      return { from: fmtDate(f), to: fmtDate(t) }
    }
    case "7d": {
      const f = new Date(today); f.setDate(f.getDate() - 7)
      return { from: fmtDate(f), to: fmtDate(today) }
    }
    case "30d": {
      const f = new Date(today); f.setDate(f.getDate() - 30)
      return { from: fmtDate(f), to: fmtDate(today) }
    }
    case "90d": {
      const f = new Date(today); f.setDate(f.getDate() - 90)
      return { from: fmtDate(f), to: fmtDate(today) }
    }
  }
}

const PRESET_LABELS: Record<DatePreset, string> = {
  this_month: "Цей міс.",
  last_month: "Мин. міс.",
  "7d": "7 днів",
  "30d": "30 днів",
  "90d": "90 днів",
  custom: "Свій",
}

// ─── Main Dashboard ───────────────────────────────────────────────────
type FilterTab = "all" | CampaignStatus
type CostModelFilter = "all" | "cpc" | "cpa" | "cpm" | "revshare" | "fixed" | "unknown"
type ViewMode = "campaigns" | "offers"

export function KeitaroDashboard() {
  const [data, setData] = useState<KeitaroDashboardResponse | null>(null)
  const [benchmarkData, setBenchmarkData] = useState<GeoBenchmarksResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<FilterTab>("all")
  const [costModelFilter, setCostModelFilter] = useState<CostModelFilter>("all")
  const [view, setView] = useState<ViewMode>("offers")

  // ── Date range state ──────────────────────────────────────────────
  const [datePreset, setDatePreset] = useState<DatePreset>("this_month")
  const initialRange = presetRange("this_month")
  const [dateFrom, setDateFrom] = useState(initialRange.from)
  const [dateTo,   setDateTo]   = useState(initialRange.to)
  // Temporary values for custom input (committed on Apply)
  const [customFrom, setCustomFrom] = useState(initialRange.from)
  const [customTo,   setCustomTo]   = useState(initialRange.to)

  const handlePreset = useCallback((preset: DatePreset) => {
    setDatePreset(preset)
    if (preset !== "custom") {
      const range = presetRange(preset)
      setDateFrom(range.from)
      setDateTo(range.to)
      setCustomFrom(range.from)
      setCustomTo(range.to)
    }
  }, [])

  const applyCustomRange = useCallback(() => {
    if (customFrom && customTo && customFrom <= customTo) {
      setDateFrom(customFrom)
      setDateTo(customTo)
    }
  }, [customFrom, customTo])

  const load = useCallback(async (bust = false) => {
    if (bust) {
      setRefreshing(true)
      await Promise.all([
        fetch("/api/keitaro/campaigns", { method: "POST" }),
        fetch("/api/keitaro/geo-benchmarks", { method: "POST" }),
      ])
    } else {
      setLoading(true)
    }
    try {
      const qs = `?from=${dateFrom}&to=${dateTo}`
      const [campaignsRes, benchmarksRes] = await Promise.all([
        fetch(`/api/keitaro/campaigns${qs}`),
        fetch("/api/keitaro/geo-benchmarks"),
      ])
      const [campaigns, benchmarks] = await Promise.all([
        campaignsRes.json(),
        benchmarksRes.json(),
      ])
      setData(campaigns)
      setBenchmarkData(benchmarks)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingSkeleton />

  if (!data) return <p className="text-muted-foreground text-sm">Нет данных</p>

  if (data.error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">
        <b>Ошибка загрузки:</b> {data.error}
      </div>
    )
  }

  const { campaigns, summary, period } = data

  // Cost model counts (from campaigns with any activity)
  const costModelCounts = campaigns.reduce<Record<string, number>>((acc, c) => {
    const key = (c.costModel as string) || "unknown"
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  // Only show cost models that actually exist in the data
  const availableCostModels = (["cpc", "cpa", "cpm", "revshare", "fixed", "unknown"] as CostModelFilter[])
    .filter((m) => costModelCounts[m] > 0)

  const filtered = campaigns
    .filter((c) => filter === "all" || c.status === filter)
    .filter((c) => costModelFilter === "all" || (c.costModel as string) === costModelFilter)

  return (
    <div className="space-y-4">
      {/* Geo benchmark table */}
      {benchmarkData && !benchmarkData.error && (
        <GeoBenchmarkTable
          benchmarks={benchmarkData.benchmarks}
          period={benchmarkData.period}
        />
      )}

      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* View switcher */}
        <div className="flex items-center gap-1 p-1 rounded-lg border border-border bg-muted/40">
          <button
            onClick={() => setView("offers")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === "offers"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            Офферы
          </button>
          <button
            onClick={() => setView("campaigns")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === "campaigns"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Кампании
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => load(true)}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Обновить
        </Button>
      </div>

      {/* Date range picker */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide shrink-0">
          Період
        </span>
        {(["this_month", "last_month", "7d", "30d", "90d", "custom"] as DatePreset[]).map((preset) => (
          <button
            key={preset}
            onClick={() => handlePreset(preset)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              datePreset === preset
                ? "border-foreground/40 bg-accent text-foreground font-medium"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            {PRESET_LABELS[preset]}
          </button>
        ))}
        {datePreset === "custom" && (
          <div className="flex items-center gap-1.5 ml-1">
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground w-[130px]"
            />
            <span className="text-muted-foreground text-xs">—</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
              className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground w-[130px]"
            />
            <button
              onClick={applyCustomRange}
              disabled={!customFrom || !customTo || customFrom > customTo}
              className="text-xs px-3 py-1 rounded border border-foreground/30 bg-accent text-foreground font-medium hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Застосувати
            </button>
          </div>
        )}
        {datePreset !== "custom" && (
          <span className="text-[10px] text-muted-foreground ml-1 font-mono">
            {dateFrom} — {dateTo}
          </span>
        )}
      </div>

      {/* ── OFFERS VIEW ─────────────────────────────────────────────── */}
      {view === "offers" && (
        <OffersView onRefresh={() => load(true)} refreshing={refreshing} from={dateFrom} to={dateTo} />
      )}

      {/* ── CAMPAIGNS VIEW ──────────────────────────────────────────── */}
      {view === "campaigns" && (
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            Период: {period.from} — {period.to} (текущий месяц) ·{" "}
            Обновлено: {new Date(data.lastUpdated).toLocaleTimeString("ru-RU")}
          </div>

          {/* Summary cards / filter tabs */}
          <div className="flex flex-wrap gap-2">
            <SummaryCard
              icon={CircleDot}
              label="Всего"
              value={summary.total}
              sub={`${summary.active} активных`}
              active={filter === "all"}
              onClick={() => setFilter("all")}
              colorClass="text-foreground"
            />
            <SummaryCard
              icon={CheckCircle2}
              label="Успешные"
              value={summary.success}
              active={filter === "success"}
              onClick={() => setFilter("success")}
              colorClass="text-green-500"
            />
            <SummaryCard
              icon={AlertTriangle}
              label="Требуют решения"
              value={summary.decision}
              active={filter === "decision"}
              onClick={() => setFilter("decision")}
              colorClass="text-amber-500"
            />
            <SummaryCard
              icon={XCircle}
              label="Провальные"
              value={summary.failed}
              active={filter === "failed"}
              onClick={() => setFilter("failed")}
              colorClass="text-red-500"
            />
            <SummaryCard
              icon={HelpCircle}
              label="Нет данных"
              value={summary.no_data}
              active={filter === "no_data"}
              onClick={() => setFilter("no_data")}
              colorClass="text-gray-400"
            />
          </div>

          {/* Cost model filter row */}
          {availableCostModels.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mr-0.5">
                Монетизація
              </span>
              <button
                onClick={() => setCostModelFilter("all")}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  costModelFilter === "all"
                    ? "border-foreground/40 bg-accent text-foreground font-medium"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                Усі ({campaigns.length})
              </button>
              {availableCostModels.map((model) => {
                const META: Record<string, { label: string; cls: string; activeCls: string }> = {
                  cpc:      { label: "CPC",      cls: "border-sky-300/60 text-sky-600 dark:text-sky-400",      activeCls: "bg-sky-100 dark:bg-sky-900/40 border-sky-400 text-sky-700 dark:text-sky-300 font-medium" },
                  cpa:      { label: "CPA",      cls: "border-teal-300/60 text-teal-600 dark:text-teal-400",    activeCls: "bg-teal-100 dark:bg-teal-900/40 border-teal-400 text-teal-700 dark:text-teal-300 font-medium" },
                  cpm:      { label: "CPM",      cls: "border-purple-300/60 text-purple-600 dark:text-purple-400", activeCls: "bg-purple-100 dark:bg-purple-900/40 border-purple-400 text-purple-700 dark:text-purple-300 font-medium" },
                  revshare: { label: "RevShare", cls: "border-pink-300/60 text-pink-600 dark:text-pink-400",    activeCls: "bg-pink-100 dark:bg-pink-900/40 border-pink-400 text-pink-700 dark:text-pink-300 font-medium" },
                  fixed:    { label: "Fixed",    cls: "border-slate-300/60 text-slate-500 dark:text-slate-400", activeCls: "bg-slate-100 dark:bg-slate-800 border-slate-400 text-slate-700 dark:text-slate-300 font-medium" },
                  unknown:  { label: "Unknown",  cls: "border-gray-300/60 text-gray-500 dark:text-gray-400",   activeCls: "bg-gray-100 dark:bg-gray-800 border-gray-400 text-gray-700 dark:text-gray-300 font-medium" },
                }
                const meta = META[model] ?? META.unknown
                const isActive = costModelFilter === model
                return (
                  <button
                    key={model}
                    onClick={() => setCostModelFilter(isActive ? "all" : model)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors font-mono ${
                      isActive ? meta.activeCls : `${meta.cls} hover:opacity-80`
                    }`}
                  >
                    {meta.label} ({costModelCounts[model] ?? 0})
                  </button>
                )
              })}
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Нет кампаний в категории «{filter}»{costModelFilter !== "all" ? ` · модель ${costModelFilter.toUpperCase()}` : ""}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((c) => (
                <CampaignCard key={c.id} c={c} from={dateFrom} to={dateTo} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
