"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft, BarChart3, GitBranch, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, AlertTriangle, HelpCircle,
  RefreshCw, Layers, Globe, Zap, RotateCcw, Tag,
  TrendingUp, TrendingDown,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  KeitaroDashboardResponse, EnrichedCampaign, CampaignStatus, CostModelType,
  CampaignStreamsResponse, StreamInfo,
} from "@aap/types"

// ─── Helpers ──────────────────────────────────────────────────────────
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

const STATUS_CFG: Record<CampaignStatus, { label: string; icon: React.ElementType; border: string; bg: string; badge: string }> = {
  success:  { label: "Успешная",        icon: CheckCircle2, border: "border-l-green-500", bg: "bg-green-50 dark:bg-green-950/20",   badge: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  failed:   { label: "Провальная",      icon: XCircle,      border: "border-l-red-500",   bg: "bg-red-50 dark:bg-red-950/20",       badge: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  decision: { label: "Требует решения", icon: AlertTriangle, border: "border-l-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20",   badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  no_data:  { label: "Нет данных",      icon: HelpCircle,   border: "border-l-gray-300",  bg: "bg-gray-50 dark:bg-gray-900/20",     badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
}

const COST_MODEL_META: Partial<Record<CostModelType, { label: string; cls: string }>> = {
  cpc:      { label: "CPC",      cls: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  cpm:      { label: "CPM",      cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  cpa:      { label: "CPA",      cls: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300" },
  revshare: { label: "RevShare", cls: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300" },
  fixed:    { label: "Fixed",    cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
}

// ─── Setting Row ──────────────────────────────────────────────────────
function SettingRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <span className="text-sm text-muted-foreground w-36 shrink-0">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  )
}

// ─── Metric Cell ──────────────────────────────────────────────────────
function MetricCell({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-lg font-bold font-mono ${cls}`}>{value}</span>
    </div>
  )
}

// ─── Streams Section ──────────────────────────────────────────────────
function StreamsSection({ campaignId, from, to }: { campaignId: number; from: string; to: string }) {
  const [streams, setStreams] = useState<StreamInfo[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/keitaro/campaigns/${campaignId}/streams`)
      .then((r) => r.json())
      .then((d: CampaignStreamsResponse) => {
        if (d.error) setError(d.error)
        else setStreams(d.streams)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [campaignId])

  if (loading) return <Skeleton className="h-24 w-full" />
  if (error) return <p className="text-sm text-red-500">{error}</p>
  if (!streams || streams.length === 0) return <p className="text-sm text-muted-foreground py-4 text-center">Потоки не найдены.</p>

  const active = streams.filter((s) => s.status === "active")

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <GitBranch className="h-3.5 w-3.5" />
        <span className="font-medium text-sm text-foreground">Потоки / воронки</span>
        <span>{active.length} активних · {streams.length} всього</span>
      </div>
      {streams.map((s) => (
        <Link
          key={s.id}
          href={`/keitaro/streams/${s.id}?from=${from}&to=${to}&campaignId=${campaignId}`}
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors hover:bg-accent/50 hover:shadow-sm ${
            s.status === "active"
              ? "border-border/60 bg-background"
              : "border-border/30 bg-muted/20 opacity-60"
          }`}
        >
          <GitBranch className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="font-medium truncate max-w-[180px]" title={s.name}>{s.name}</span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${schemaBadgeClass(s.schema)}`}>
            {schemaLabel(s.schema)}
          </span>
          {s.weight !== 100 && <span className="text-muted-foreground shrink-0">{s.weight}%</span>}
          {s.status !== "active" && <span className="text-muted-foreground italic shrink-0">{s.status}</span>}
          {s.offerNames.length > 0 && (
            <span className="text-muted-foreground truncate max-w-[200px] ml-1" title={s.offerNames.join(", ")}>
              → {s.offerNames.slice(0, 2).join(", ")}{s.offerNames.length > 2 ? ` +${s.offerNames.length - 2}` : ""}
            </span>
          )}
          <ChevronDown className="h-3 w-3 ml-auto shrink-0 -rotate-90 text-muted-foreground" />
        </Link>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────
export function KeitaroCampaignPage({ id, from: initFrom, to: initTo }: {
  id: number
  from?: string
  to?: string
}) {
  const today = new Date().toISOString().split("T")[0]
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]

  const [from, setFrom] = useState(initFrom || monthStart)
  const [to, setTo]     = useState(initTo   || today)
  const [campaign, setCampaign] = useState<EnrichedCampaign | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [offersOpen, setOffersOpen] = useState(false)

  const load = useCallback(async (bust = false) => {
    if (bust) {
      setRefreshing(true)
      await fetch("/api/keitaro/campaigns", { method: "POST" }).catch(() => {})
    }
    setError(null)
    try {
      const res = await fetch(`/api/keitaro/campaigns?from=${from}&to=${to}`)
      const data: KeitaroDashboardResponse = await res.json()
      if (data.error) { setError(data.error); return }
      const found = data.campaigns.find((c) => c.id === id)
      if (!found) setError(`Кампанія #${id} не знайдена.`)
      else setCampaign(found)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка завантаження")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [from, to, id])

  useEffect(() => { load() }, [load])

  const cfg = campaign ? (campaign.campaignType === "offer" ? STATUS_CFG[campaign.status] : STATUS_CFG["no_data"]) : STATUS_CFG["no_data"]
  const Icon = cfg.icon
  const costModelMeta = campaign?.costModel ? COST_MODEL_META[campaign.costModel as CostModelType] : undefined
  const { stats } = campaign ?? { stats: null }
  const hasStats = !!stats && (stats.cost > 0 || stats.clicks > 0)
  const isOffer = campaign?.campaignType === "offer"

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/keitaro" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Keitaro
        </Link>
        <span>/</span>
        <span>Кампанії</span>
        <span>/</span>
        <span className="text-foreground font-medium truncate max-w-[300px]">
          {campaign?.name ?? `#${id}`}
        </span>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">Період:</span>
        <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
          className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground w-[130px]" />
        <span className="text-muted-foreground text-xs">—</span>
        <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)}
          className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground w-[130px]" />
        <button onClick={() => load(true)} disabled={refreshing}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-border hover:bg-accent transition-colors disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Оновити
        </button>
      </div>

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {!loading && campaign && (
        <>
          {/* Header */}
          <div className={`rounded-xl border-l-4 ${isOffer ? cfg.border : "border-l-blue-400"} ${isOffer ? cfg.bg : "bg-blue-50/30 dark:bg-blue-950/10"} border border-border p-5 space-y-4`}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {isOffer && (
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                      <Icon className="h-3 w-3" />{cfg.label}
                    </span>
                  )}
                  <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${
                    campaign.state === "active"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${campaign.state === "active" ? "bg-blue-500" : "bg-gray-400"}`} />
                    {campaign.state}
                  </span>
                  {costModelMeta && (
                    <span className={`inline-flex items-center text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${costModelMeta.cls}`}>
                      {costModelMeta.label}
                    </span>
                  )}
                  {campaign.geo && campaign.geo !== "Unknown" && (
                    <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-mono">
                      {campaign.geo}
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-bold leading-tight">{campaign.name}</h1>
                {campaign.alias && <p className="text-sm text-muted-foreground mt-1 font-mono">alias: {campaign.alias}</p>}
              </div>
            </div>

            {/* Performance metrics */}
            {hasStats && stats && (
              <>
                {isOffer ? (
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                    <MetricCell label="Расход"  value={fmt$(stats.cost)} />
                    <MetricCell label="Доход"   value={fmt$(stats.revenue)} />
                    <MetricCell label="Прибыль" value={fmt$(stats.profit)}
                      cls={stats.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} />
                    <MetricCell label="ROI" value={`${stats.roi.toFixed(1)}%`}
                      cls={stats.roi >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} />
                    <MetricCell label="CPA" value={stats.cpa > 0 ? fmt$(stats.cpa) : "—"} />
                    <MetricCell label="CR"  value={stats.cr > 0 ? `${stats.cr.toFixed(2)}%` : "—"} />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                    <MetricCell label="Витрати" value={fmt$(stats.cost)} />
                    <MetricCell label="Кліки"   value={fmtNum(stats.clicks)} />
                    {campaign.costModel === "cpc" && stats.cpc > 0
                      ? <MetricCell label="CPC" value={`$${stats.cpc.toFixed(3)}`} />
                      : <MetricCell label="CR" value={stats.cr > 0 ? `${stats.cr.toFixed(2)}%` : "—"} />
                    }
                    {stats.conversions > 0 && <MetricCell label="Події" value={fmtNum(stats.conversions)} />}
                  </div>
                )}

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>Кліки: <b className="text-foreground">{fmtNum(stats.clicks)}</b></span>
                  {stats.conversions > 0 && <span>Конверсії: <b className="text-foreground">{fmtNum(stats.conversions)}</b></span>}
                  {stats.leads > 0 && <span>Ліди: <b className="text-foreground">{fmtNum(stats.leads)}</b></span>}
                  {stats.sales > 0 && <span>Продажи: <b className="text-foreground">{fmtNum(stats.sales)}</b></span>}
                  {campaign.paybackMonths !== null && (
                    <span>Окупаемість: <b className={
                      campaign.paybackMonths <= 3 ? "text-green-600 dark:text-green-400"
                      : campaign.paybackMonths <= 4 ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                    }>{campaign.paybackMonths.toFixed(1)} мес.</b></span>
                  )}
                </div>
              </>
            )}

            {!hasStats && (
              <p className="text-sm text-muted-foreground">Недостатньо даних за обраний період.</p>
            )}
          </div>

          {/* Settings card */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Налаштування кампанії</span>
            </div>
            <div className="divide-y divide-border/30">
              <SettingRow icon={Zap} label="Модель витрат">
                {costModelMeta
                  ? <span className={`inline-flex items-center text-xs font-mono font-semibold px-2 py-0.5 rounded ${costModelMeta.cls}`}>{costModelMeta.label}</span>
                  : <span className="text-muted-foreground">{campaign.costModel || "—"}</span>
                }
              </SettingRow>
              <SettingRow icon={Globe} label="Домен">
                {campaign.domain
                  ? <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{campaign.domain}</span>
                  : <span className="text-muted-foreground">—</span>
                }
              </SettingRow>
              <SettingRow icon={RotateCcw} label="Тип ротації">
                <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded ${
                  campaign.rotationType === "weight"
                    ? "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}>
                  {campaign.rotationType || "position"}
                </span>
              </SettingRow>
              {campaign.geo && campaign.geo !== "Unknown" && (
                <SettingRow icon={Globe} label="Гео">
                  <span className="font-mono font-semibold">{campaign.geo}</span>
                </SettingRow>
              )}
              <SettingRow icon={Tag} label="Тип кампанії">
                <span className="text-sm">{campaign.campaignType}</span>
              </SettingRow>
              {campaign.trafficSourceId > 0 && (
                <SettingRow icon={TrendingUp} label="Джерело трафіку">
                  <span className="text-muted-foreground font-mono text-xs">ID: {campaign.trafficSourceId}</span>
                </SettingRow>
              )}
            </div>
          </div>

          {/* Analytics */}
          {campaign.recommendation && (
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Аналітика</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{campaign.recommendation}</p>
            </div>
          )}

          {/* Offer breakdown */}
          {isOffer && campaign.offerBreakdown.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setOffersOpen((v) => !v)}
                className="w-full flex items-center gap-2 px-4 py-3 hover:bg-accent/40 transition-colors text-left"
              >
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Офери в кампанії</span>
                <span className="text-xs text-muted-foreground ml-1">({campaign.offerBreakdown.length})</span>
                {offersOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />}
              </button>
              {offersOpen && (
                <div className="border-t border-border overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border/50">
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Оффер</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">Доля</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">Кліки</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">Conv.</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">CR%</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">CPA</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">ROI%</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">Доход</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaign.offerBreakdown.map((o) => (
                        <tr key={o.name} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2 max-w-[160px]">
                            <Link
                              href={`/keitaro/offers/${encodeURIComponent(o.name)}?from=${from}&to=${to}`}
                              className="truncate block hover:text-foreground text-muted-foreground hover:underline"
                              title={o.name}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {o.name}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <div className="h-1.5 w-10 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(o.shareClicks, 100)}%` }} />
                              </div>
                              <span className="font-mono text-muted-foreground">{o.shareClicks.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmtNum(o.clicks)}</td>
                          <td className="px-3 py-2 text-right font-mono">{fmtNum(o.conversions)}</td>
                          <td className="px-3 py-2 text-right font-mono text-muted-foreground">{o.cr > 0 ? o.cr.toFixed(2) : "—"}</td>
                          <td className="px-3 py-2 text-right font-mono font-medium">{o.cpa > 0 ? fmt$(o.cpa) : "—"}</td>
                          <td className={`px-3 py-2 text-right font-mono font-semibold ${
                            o.conversions > 0 ? (o.roi >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400") : "text-muted-foreground"
                          }`}>
                            {o.conversions > 0 ? `${o.roi.toFixed(0)}%` : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmt$(o.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Streams */}
          <div className="rounded-xl border border-border bg-card p-4">
            <StreamsSection campaignId={campaign.id} from={from} to={to} />
          </div>
        </>
      )}
    </div>
  )
}
