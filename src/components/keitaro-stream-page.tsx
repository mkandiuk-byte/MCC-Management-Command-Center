"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft, BarChart3, GitBranch, CheckCircle2, XCircle, RefreshCw,
  Layers, Package, TrendingUp, TrendingDown,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { OffersResponse, FunnelStat } from "@aap/types"

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
function streamTypeBadge(type: string) {
  if (type === "forced")   return { label: "forced",   cls: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300" }
  if (type === "position") return { label: "position", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" }
  return { label: type || "weight", cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" }
}

function MetricCell({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-lg font-bold font-mono ${cls}`}>{value}</span>
    </div>
  )
}

function SettingChip({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
      <span className={`text-sm font-medium ${cls}`}>{value}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────
export function KeitaroStreamPage({ streamId, from: initFrom, to: initTo }: {
  streamId: number
  from?: string
  to?: string
}) {
  const today = new Date().toISOString().split("T")[0]
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]

  const [from, setFrom] = useState(initFrom || monthStart)
  const [to, setTo]     = useState(initTo   || today)
  const [stream, setStream] = useState<(FunnelStat & { offerName: string }) | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (bust = false) => {
    if (bust) {
      setRefreshing(true)
      await fetch("/api/keitaro/offers", { method: "POST" }).catch(() => {})
    }
    setError(null)
    try {
      const res = await fetch(`/api/keitaro/offers?from=${from}&to=${to}`)
      const data: OffersResponse = await res.json()
      if (data.error) { setError(data.error); return }

      // Search all offers' funnels for matching streamId
      let found: (FunnelStat & { offerName: string }) | null = null
      for (const offer of data.offers) {
        const f = offer.funnels.find((f) => f.streamId === streamId)
        if (f) { found = { ...f, offerName: offer.name }; break }
      }

      if (!found) setError(`Потік #${streamId} не знайдено за обраний період.`)
      else setStream(found)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка завантаження")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [from, to, streamId])

  useEffect(() => { load() }, [load])

  const typeBadge = streamTypeBadge(stream?.streamType ?? "position")
  const hasStats = !!stream && stream.clicks > 0
  const roiCls = stream && stream.conversions > 0
    ? (stream.roi >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")
    : ""
  const isActive = stream?.streamStatus === "active"

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Link href="/keitaro" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Keitaro
        </Link>
        {stream && (
          <>
            <span>/</span>
            <Link
              href={`/keitaro/campaigns/${stream.campaignId}?from=${from}&to=${to}`}
              className="hover:text-foreground transition-colors"
            >
              {stream.campaignName}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-foreground font-medium truncate max-w-[250px]">
          {stream?.streamName ?? `Потік #${streamId}`}
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
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {!loading && stream && (
        <>
          {/* Header card */}
          <div className={`rounded-xl border-l-4 border border-border p-5 space-y-4 ${
            isActive ? "border-l-blue-400 bg-blue-50/30 dark:bg-blue-950/10" : "border-l-gray-300 bg-gray-50 dark:bg-gray-900/20 opacity-80"
          }`}>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                  isActive
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-blue-500" : "bg-gray-400"}`} />
                  {stream.streamStatus}
                </span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${schemaBadgeClass(stream.schema)}`}>
                  {schemaLabel(stream.schema)}
                </span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${typeBadge.cls}`}>
                  {typeBadge.label}
                </span>
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <GitBranch className="h-3 w-3" /> Потік
                </span>
              </div>
              <h1 className="text-xl font-bold leading-tight">{stream.streamName}</h1>
            </div>

            {/* Metrics */}
            {hasStats ? (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                  <MetricCell label="Расход"  value={fmt$(stream.cost)} />
                  <MetricCell label="Доход"   value={fmt$(stream.revenue)} />
                  <MetricCell label="Прибыль" value={fmt$(stream.profit)} cls={stream.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} />
                  <MetricCell label="ROI"     value={stream.conversions > 0 ? `${stream.roi.toFixed(1)}%` : "—"} cls={roiCls} />
                  <MetricCell label="CPA"     value={stream.cpa > 0 ? fmt$(stream.cpa) : "—"} />
                  <MetricCell label="CR"      value={stream.cr > 0 ? `${stream.cr.toFixed(2)}%` : "—"} />
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>Кліки: <b className="text-foreground">{fmtNum(stream.clicks)}</b></span>
                  {stream.conversions > 0 && <span>Конверсії: <b className="text-foreground">{fmtNum(stream.conversions)}</b></span>}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Немає трафіку за обраний період.</p>
            )}
          </div>

          {/* Settings card */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Налаштування потоку</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <SettingChip label="Схема воронки" value={schemaLabel(stream.schema)} />
              <SettingChip label="Тип ротації" value={typeBadge.label} />
              <SettingChip label="Вага" value={`${stream.weight}%`} />
              <SettingChip label="Статус" value={stream.streamStatus}
                cls={isActive ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"} />
            </div>
          </div>

          {/* Links to parent entities */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-3">Пов'язані сутності</p>
            <Link
              href={`/keitaro/campaigns/${stream.campaignId}?from=${from}&to=${to}`}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-accent/50 transition-colors group"
            >
              <TrendingUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Кампанія</p>
                <p className="text-sm font-medium truncate">{stream.campaignName}</p>
              </div>
              <ArrowLeft className="h-3.5 w-3.5 rotate-180 text-muted-foreground" />
            </Link>
            <Link
              href={`/keitaro/offers/${encodeURIComponent(stream.offerName)}?from=${from}&to=${to}`}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-accent/50 transition-colors group"
            >
              <Package className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Оффер</p>
                <p className="text-sm font-medium truncate">{stream.offerName}</p>
              </div>
              <ArrowLeft className="h-3.5 w-3.5 rotate-180 text-muted-foreground" />
            </Link>
          </div>

          {/* Analytics */}
          {stream.recommendation && (
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Аналітика</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{stream.recommendation}</p>
            </div>
          )}

          {/* Performance vs schema insight */}
          {hasStats && stream.conversions > 0 && (
            <div className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${
              stream.roi >= 0
                ? "border-green-300/50 bg-green-50/50 dark:bg-green-950/20"
                : "border-red-300/50 bg-red-50/50 dark:bg-red-950/20"
            }`}>
              {stream.roi >= 0
                ? <TrendingUp className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                : <TrendingDown className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              }
              <div className="text-sm">
                <span className="font-medium">Схема {schemaLabel(stream.schema)}</span>
                <span className="text-muted-foreground"> · {fmtNum(stream.clicks)} кліків · CR {stream.cr.toFixed(2)}% · CPA {fmt$(stream.cpa)}</span>
                <span className={`ml-2 font-bold ${roiCls}`}>ROI {stream.roi.toFixed(0)}%</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
