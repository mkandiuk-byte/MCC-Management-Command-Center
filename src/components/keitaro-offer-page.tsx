"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, TrendingUp, TrendingDown, BarChart3, GitBranch,
  ChevronDown, ChevronUp, Package, CheckCircle2, XCircle,
  AlertTriangle, HelpCircle, Filter, RefreshCw,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { OffersResponse, OfferView, OfferStatus, FunnelStat } from "@aap/types"

// ─── Helpers ─────────────────────────────────────────────────────────
function fmt$(v: number) {
  if (v === 0) return "$0"
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`
  return `$${v.toFixed(0)}`
}
function fmtNum(v: number) { return v.toLocaleString() }

function schemaLabel(schema: string) {
  const map: Record<string, string> = {
    "prelanding+landing": "Pre-lnd → Lnd",
    prelanding: "Pre-lnd",
    landing: "Landing",
    direct: "Direct",
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
function streamTypeBadge(type: string) {
  if (type === "forced")   return { label: "forced",   cls: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300" }
  if (type === "position") return { label: "position", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" }
  return { label: type, cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" }
}

function offerStatusConfig(s: OfferStatus) {
  switch (s) {
    case "success":  return { label: "Прибыльный",      icon: CheckCircle2, border: "border-l-green-500", bg: "bg-green-50 dark:bg-green-950/20",   badge: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" }
    case "failed":   return { label: "Убыточный",       icon: XCircle,      border: "border-l-red-500",   bg: "bg-red-50 dark:bg-red-950/20",       badge: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" }
    case "decision": return { label: "Требует решения", icon: AlertTriangle, border: "border-l-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20",   badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" }
    default:         return { label: "Нет данных",      icon: HelpCircle,   border: "border-l-gray-300",  bg: "bg-gray-50 dark:bg-gray-900/20",     badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" }
  }
}

// ─── Funnel Schema Breakdown ──────────────────────────────────────────
function FunnelSchemaBreakdown({ funnels }: { funnels: FunnelStat[] }) {
  const withTraffic = funnels.filter((f) => f.clicks > 0)
  if (withTraffic.length === 0) return null

  const groups = new Map<string, { schema: string; count: number; totalClicks: number; totalConversions: number; totalCost: number; totalRevenue: number; totalProfit: number }>()
  for (const f of withTraffic) {
    const key = f.schema || "landing"
    const g = groups.get(key) ?? { schema: key, count: 0, totalClicks: 0, totalConversions: 0, totalCost: 0, totalRevenue: 0, totalProfit: 0 }
    g.count++; g.totalClicks += f.clicks; g.totalConversions += f.conversions
    g.totalCost += f.cost; g.totalRevenue += f.revenue; g.totalProfit += f.profit
    groups.set(key, g)
  }
  const rows = [...groups.values()]
    .map((g) => ({ ...g, roi: g.totalCost > 0 ? ((g.totalRevenue - g.totalCost) / g.totalCost) * 100 : 0, cpa: g.totalConversions > 0 ? g.totalCost / g.totalConversions : 0, cr: g.totalClicks > 0 ? (g.totalConversions / g.totalClicks) * 100 : 0 }))
    .sort((a, b) => b.totalClicks - a.totalClicks)
  if (rows.length < 2) return null

  return (
    <div className="rounded-md border border-border/50 overflow-hidden">
      <div className="bg-muted/30 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <BarChart3 className="h-3 w-3" /> Ефективність за схемою воронки
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/30 bg-muted/10">
            <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Схема</th>
            <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Воронок</th>
            <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Кліки</th>
            <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">CR%</th>
            <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">CPA</th>
            <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">ROI%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.schema} className="border-b border-border/20 hover:bg-muted/10">
              <td className="px-3 py-1.5">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${schemaBadgeClass(r.schema)}`}>
                  {schemaLabel(r.schema)}
                </span>
              </td>
              <td className="px-3 py-1.5 text-right text-muted-foreground">{r.count}</td>
              <td className="px-3 py-1.5 text-right font-mono">{fmtNum(r.totalClicks)}</td>
              <td className="px-3 py-1.5 text-right font-mono">{r.cr.toFixed(2)}%</td>
              <td className="px-3 py-1.5 text-right font-mono">{r.cpa > 0 ? fmt$(r.cpa) : "—"}</td>
              <td className={`px-3 py-1.5 text-right font-mono font-semibold ${r.roi >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                {r.roi.toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Funnel Row ───────────────────────────────────────────────────────
function FunnelRow({ f, from, to }: { f: FunnelStat; from: string; to: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const hasStats = f.clicks > 0
  const typeBadge = streamTypeBadge(f.streamType ?? "position")
  const roiColor = f.conversions > 0
    ? (f.roi >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400")
    : "text-muted-foreground"

  const streamHref = `/keitaro/streams/${f.streamId}?from=${from}&to=${to}`

  return (
    <div className={`rounded-md border text-xs ${f.streamStatus === "active" ? "border-border/60 bg-background" : "border-border/30 bg-muted/20 opacity-60"}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/30 transition-colors text-left rounded-md"
      >
        <GitBranch className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="font-medium truncate max-w-[160px]" title={f.streamName}>{f.streamName}</span>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${typeBadge.cls}`}>{typeBadge.label}</span>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${schemaBadgeClass(f.schema)}`}>{schemaLabel(f.schema)}</span>
        {f.streamType !== "forced" && f.weight !== 100 && <span className="text-muted-foreground shrink-0">{f.weight}%</span>}
        {f.streamStatus !== "active" && <span className="text-muted-foreground italic shrink-0">{f.streamStatus}</span>}
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

      {open && (
        <div className="border-t border-border/40 px-3 py-2.5 space-y-2.5">
          {hasStats && (
            <div className="grid grid-cols-4 gap-x-4 gap-y-1">
              <div className="flex flex-col"><span className="text-muted-foreground">Расход</span><span className="font-semibold font-mono">{fmt$(f.cost)}</span></div>
              <div className="flex flex-col"><span className="text-muted-foreground">Доход</span><span className="font-semibold font-mono">{fmt$(f.revenue)}</span></div>
              <div className="flex flex-col"><span className="text-muted-foreground">Прибыль</span><span className={`font-semibold font-mono ${f.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>{fmt$(f.profit)}</span></div>
              <div className="flex flex-col"><span className="text-muted-foreground">CR</span><span className="font-semibold font-mono">{f.cr > 0 ? `${f.cr.toFixed(2)}%` : "—"}</span></div>
            </div>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide mr-1">Сетап</span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${typeBadge.cls}`}>{typeBadge.label}</span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${schemaBadgeClass(f.schema)}`}>{schemaLabel(f.schema)}</span>
            <span className="text-[10px] text-muted-foreground">вес <b className="text-foreground">{f.weight}%</b></span>
            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={f.campaignName}>· {f.campaignName}</span>
          </div>
          <div className="flex items-start gap-1.5 rounded bg-muted/40 px-2.5 py-2">
            <BarChart3 className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
            <p className="leading-relaxed text-muted-foreground">{f.recommendation}</p>
          </div>
          <div className="flex justify-end">
            <button
              onClick={(e) => { e.stopPropagation(); router.push(streamHref) }}
              className="text-[10px] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5 hover:bg-accent transition-colors"
            >
              Деталі потоку →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main offer page component ────────────────────────────────────────
export function KeitaroOfferPage({ name, from: initFrom, to: initTo }: {
  name: string
  from?: string
  to?: string
}) {
  const today = new Date().toISOString().split("T")[0]
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]

  const [from, setFrom] = useState(initFrom || monthStart)
  const [to, setTo]     = useState(initTo   || today)
  const [offer, setOffer]     = useState<OfferView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [sort, setSort]       = useState<"clicks" | "roi">("clicks")
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (bust = false) => {
    if (bust) {
      setRefreshing(true)
      await fetch("/api/keitaro/offers", { method: "POST" })
    }
    setError(null)
    try {
      const res = await fetch(`/api/keitaro/offers?from=${from}&to=${to}`)
      const data: OffersResponse = await res.json()
      if (data.error) { setError(data.error); return }
      const found = data.offers.find((o) => o.name === name)
      if (!found) setError(`Оффер "${name}" не знайдено за обраний період.`)
      else setOffer(found)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка завантаження")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [from, to, name])

  useEffect(() => { load() }, [load])

  const sortedFunnels = offer ? [...offer.funnels].sort((a, b) => {
    if (sort === "roi") {
      if (a.conversions === 0 && b.conversions === 0) return b.clicks - a.clicks
      if (a.conversions === 0) return 1
      if (b.conversions === 0) return -1
      return b.roi - a.roi
    }
    return b.clicks - a.clicks
  }) : []

  const activeFunnels = offer?.funnels.filter((f) => f.streamStatus === "active") ?? []
  const bestFunnel = offer?.funnels
    .filter((f) => f.streamStatus === "active" && f.conversions > 0 && f.clicks > 50)
    .sort((a, b) => b.roi - a.roi)[0]

  const cfg = offer ? offerStatusConfig(offer.status) : offerStatusConfig("no_data")
  const Icon = cfg.icon

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/keitaro" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Keitaro
        </Link>
        <span>/</span>
        <span>Офферы</span>
        <span>/</span>
        <span className="text-foreground font-medium truncate max-w-[300px]">{name}</span>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">Період:</span>
        <input
          type="date"
          value={from}
          max={to}
          onChange={(e) => setFrom(e.target.value)}
          className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground w-[130px]"
        />
        <span className="text-muted-foreground text-xs">—</span>
        <input
          type="date"
          value={to}
          min={from}
          onChange={(e) => setTo(e.target.value)}
          className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground w-[130px]"
        />
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-border hover:bg-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Оновити
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Offer detail */}
      {!loading && offer && (
        <>
          {/* Header card */}
          <div className={`rounded-xl border-l-4 ${cfg.border} ${cfg.bg} border border-border p-5 space-y-4`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                    <Icon className="h-3 w-3" />{cfg.label}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <Package className="h-3 w-3" /> Оффер
                  </span>
                  {offer.funnels.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {activeFunnels.length} з {offer.funnels.length} воронок активні
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-bold leading-tight">{offer.name}</h1>
              </div>
            </div>

            {/* Metrics */}
            {(offer.stats.cost > 0 || offer.stats.clicks > 0) && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                {[
                  { label: "Расход",   value: fmt$(offer.stats.cost),    cls: "" },
                  { label: "Доход",    value: fmt$(offer.stats.revenue),  cls: "" },
                  { label: "Прибыль",  value: fmt$(offer.stats.profit),   cls: offer.stats.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400" },
                  { label: "ROI",      value: `${offer.stats.roi.toFixed(1)}%`, cls: offer.stats.roi >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400" },
                  { label: "CPA",      value: offer.stats.cpa > 0 ? fmt$(offer.stats.cpa) : "—", cls: "" },
                  { label: "CR",       value: offer.stats.cr > 0 ? `${offer.stats.cr.toFixed(2)}%` : "—", cls: "" },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="flex flex-col">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className={`text-lg font-bold font-mono ${cls}`}>{value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>Кліки: <b className="text-foreground">{fmtNum(offer.stats.clicks)}</b></span>
              <span>Конверсії: <b className="text-foreground">{fmtNum(offer.stats.conversions)}</b></span>
            </div>
          </div>

          {/* Analytics */}
          {offer.recommendation && offer.status !== "no_data" && (
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Аналітика</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{offer.recommendation}</p>
            </div>
          )}

          {/* Best funnel */}
          {bestFunnel && (
            <div className="flex items-center gap-2 rounded-lg border border-green-300/50 bg-green-50/50 dark:bg-green-950/20 px-4 py-2.5">
              <TrendingUp className="h-4 w-4 text-green-500 shrink-0" />
              <span className="text-sm text-muted-foreground">Краща воронка:</span>
              <span className="font-semibold">{bestFunnel.streamName}</span>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${schemaBadgeClass(bestFunnel.schema)}`}>{schemaLabel(bestFunnel.schema)}</span>
              <span className="font-mono font-bold text-green-600 dark:text-green-400 ml-auto">ROI {bestFunnel.roi.toFixed(0)}%</span>
            </div>
          )}

          {/* Schema breakdown */}
          {offer.funnels.length >= 2 && <FunnelSchemaBreakdown funnels={offer.funnels} />}

          {/* Funnels list */}
          {offer.funnels.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">Воронки</span>
                  <span className="text-xs text-muted-foreground">
                    {activeFunnels.length} активних · {offer.funnels.length} всього
                  </span>
                </div>
                <div className="ml-auto flex items-center gap-0.5 text-xs">
                  <span className="text-muted-foreground mr-1">Сортування:</span>
                  {(["clicks", "roi"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSort(s)}
                      className={`px-2 py-0.5 rounded transition-colors ${sort === s ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {s === "clicks" ? "Кліки" : "ROI"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                {sortedFunnels.map((f) => (
                  <FunnelRow key={`${f.campaignId}-${f.streamId}`} f={f} from={from} to={to} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Воронки не знайдено (немає активних потоків з цим оффером за обраний період).
            </p>
          )}
        </>
      )}
    </div>
  )
}
