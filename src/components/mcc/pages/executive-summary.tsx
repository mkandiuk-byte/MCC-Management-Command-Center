"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/mcc/page-header"
import { useI18n } from "@/lib/mcc-i18n"
import {
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Ban,
  Shield,
  Users,
  Lock,
  FileText,
  Skull,
  Smartphone,
  Link2,
  RefreshCw,
  Zap,
  Clock,
  ChevronRight,
} from "lucide-react"

/* ─── Types ─────────────────────────────────────────────────── */

interface BuyerRow {
  buyer: string
  cost: number
  revenue: number
  profit: number
  roi: number
  signal: string
}

interface BuyerData {
  buyers: BuyerRow[]
  totals: { totalSpend: number; totalRevenue: number; totalProfit: number; avgRoi: number }
}

interface ProblemData {
  problems: { id: string; severity: string; status: string; title: string; category: string }[]
}

interface InfraData {
  tasks: { id: string; status: string; title: string }[]
  services: { name: string; cost: number; billingCycle: string; nextPayment: string; daysLeft: number }[]
}

interface EngineeringApiData {
  teams: {
    ASD: { sprint: { name: string; velocity: number }; bugDensity: { ratio: number }; blocked: { count: number } }
    FS: { sprint: { name: string; velocity: number }; bugDensity: { ratio: number }; blocked: { count: number } }
  }
  summary: { totalVelocity: number; avgBugDensity: number; totalBlocked: number; zombieEpicCount: number }
  updatedAt: string
  source: "jira_api" | "fallback"
}

interface RoiResponse {
  daily: { grouping: string; profit: number; revenue: number; cost: number }[]
}

interface PeopleData {
  count: number
}

/* ─── Helpers ───────────────────────────────────────────────── */

function fmt(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

function pct(n: number): string {
  return `${Math.round(n)}%`
}

function computeDelta(current: number, previous: number): { pct: string; trend: "up" | "down" | "flat" } {
  if (previous === 0 && current === 0) return { pct: "0%", trend: "flat" }
  if (previous === 0) return { pct: "+100%", trend: "up" }
  const delta = ((current - previous) / Math.abs(previous)) * 100
  if (Math.abs(delta) < 1) return { pct: "0%", trend: "flat" }
  const sign = delta > 0 ? "+" : ""
  return { pct: `${sign}${delta.toFixed(0)}%`, trend: delta > 0 ? "up" : "down" }
}

type Status = "ok" | "watch" | "stop" | "neutral"

function statusColor(s: Status): string {
  return { ok: "var(--success)", watch: "var(--warning)", stop: "var(--error)", neutral: "var(--foreground)" }[s]
}

/* Mini sparkline — for money KPIs with daily trend data */
function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 48
  const h = 16
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - 1 - ((v - min) / range) * (h - 2)}`)
    .join(" ")
  const up = data[data.length - 1] >= data[0]
  return (
    <svg width={w} height={h} className="inline-block shrink-0 ml-1">
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "oklch(0.7 0.18 155)" : "oklch(0.62 0.22 25)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* FIX 1: Loading skeleton */
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Insight skeleton */}
      <div className="rounded-2xl bg-[var(--muted)] h-20" />
      {/* KPI skeletons — hero row */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
        <div className="rounded-2xl bg-[var(--muted)] h-32" />
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="rounded-2xl bg-[var(--muted)] h-28" />)}
      </div>
      {/* KPI skeletons — secondary row */}
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="rounded-2xl bg-[var(--muted)] h-20" />)}
      </div>
    </div>
  )
}

/* FIX 1: Per-section error indicator */
function DataError({ source, onRetry }: { source: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px]"
         style={{ background: "var(--warning-muted)", color: "var(--warning)" }}>
      <AlertTriangle className="h-3.5 w-3.5" />
      <span>{source} unavailable</span>
      <button onClick={onRetry} className="underline ml-1">Retry</button>
    </div>
  )
}

/* Staggered section wrapper */
function Section({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <div
      className={`animate-fade-in-up ${className}`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      {children}
    </div>
  )
}

/* FIX 3: Clickable section header with drill-down affordance */
function SectionHeader({ label, href }: { label: string; href: string }) {
  const router = useRouter()
  return (
    <div className="flex items-center gap-1 cursor-pointer group" onClick={() => router.push(href)}>
      <span className="text-section-header">{label}</span>
      <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
    </div>
  )
}

/* Problem icon map */
const problemIcons: Record<string, React.ElementType> = {
  cloaking: Lock,
  white_pages: FileText,
  webrtc: Skull,
  ios: Smartphone,
  ssapi: Link2,
  funnel_migration: RefreshCw,
  account_health: Shield,
  event_streaming: Zap,
}

/* ═══════════════════════════════════════════════════════════════
   EXECUTIVE SUMMARY — Control Tower Homepage
   ═══════════════════════════════════════════════════════════════ */

export function ExecutiveSummary() {
  const [buyers, setBuyers] = useState<BuyerData | null>(null)
  const [prevBuyers, setPrevBuyers] = useState<BuyerData | null>(null)
  const [problems, setProblems] = useState<ProblemData | null>(null)
  const [engData, setEngData] = useState<EngineeringApiData | null>(null)
  const [peopleCount, setPeopleCount] = useState<number | null>(null)
  const [profitSpark, setProfitSpark] = useState<number[]>([])
  const [revenueSpark, setRevenueSpark] = useState<number[]>([])
  const [spendSpark, setSpendSpark] = useState<number[]>([])
  const [roiSpark, setRoiSpark] = useState<number[]>([])
  const [period, setPeriod] = useState(30)
  const [lastUpdated, setLastUpdated] = useState("")
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<Set<string>>(new Set())
  const { t } = useI18n()
  const router = useRouter()

  /* ─── Data fetch — all endpoints in parallel ─────────────── */
  const reload = useCallback(() => {
    setLoading(true)
    setErrors(new Set())

    const to = new Date().toISOString().split("T")[0]
    const from = new Date(Date.now() - period * 86400000).toISOString().split("T")[0]
    const prevFrom = new Date(Date.now() - period * 2 * 86400000).toISOString().split("T")[0]
    const prevTo = new Date(Date.now() - period * 86400000).toISOString().split("T")[0]

    Promise.allSettled([
      fetch(`/api/mcc/keitaro/buyers?from=${from}&to=${to}`).then(r => r.json()),
      fetch(`/api/mcc/keitaro/buyers?from=${prevFrom}&to=${prevTo}`).then(r => r.json()),
      fetch(`/api/mcc/keitaro/roi?from=${from}&to=${to}`).then(r => r.json()),
      fetch("/api/mcc/problems").then(r => r.json()),
      fetch("/api/mcc/jira/engineering").then(r => r.json()),
      fetch("/api/mcc/airtable/people").then(r => r.json()),
    ]).then(([buyersR, prevR, roiR, probR, engR, peopleR]) => {
      const failed = new Set<string>()

      if (buyersR.status === "fulfilled") setBuyers(buyersR.value)
      else failed.add("Buyers")

      if (prevR.status === "fulfilled") setPrevBuyers(prevR.value)
      else failed.add("Previous period")

      if (roiR.status === "fulfilled") {
        const d = roiR.value as RoiResponse
        if (d?.daily) {
          const last7 = d.daily.slice(-7)
          setProfitSpark(last7.map(r => r.profit))
          setRevenueSpark(last7.map(r => r.revenue))
          setSpendSpark(last7.map(r => r.cost))
          setRoiSpark(last7.map(r => r.revenue > 0 && r.cost > 0 ? ((r.revenue - r.cost) / r.cost) * 100 : 0))
        }
      } else {
        failed.add("ROI")
      }

      if (probR.status === "fulfilled") setProblems(probR.value)
      else failed.add("Problems")

      if (engR.status === "fulfilled") setEngData(engR.value)
      else failed.add("Engineering")

      if (peopleR.status === "fulfilled") {
        const pd = peopleR.value as PeopleData
        setPeopleCount(pd?.count ?? null)
      } else {
        failed.add("People")
      }

      setErrors(failed)
      setLoading(false)
    })

    setLastUpdated(new Date().toISOString())
  }, [period])

  useEffect(() => { reload() }, [reload])

  /* ─── Computed values ─────────────────────────────────────── */
  const totals = buyers?.totals
  const prevTotals = prevBuyers?.totals
  const probs = problems?.problems ?? []
  const stopBuyers = (buyers?.buyers ?? []).filter(b => b.signal === "STOP")

  const profitDelta = totals && prevTotals ? computeDelta(totals.totalProfit, prevTotals.totalProfit) : null
  const roiDelta = totals && prevTotals ? computeDelta(totals.avgRoi, prevTotals.avgRoi) : null
  const spendDelta = totals && prevTotals ? computeDelta(totals.totalSpend, prevTotals.totalSpend) : null
  const revDelta = totals && prevTotals ? computeDelta(totals.totalRevenue, prevTotals.totalRevenue) : null

  const engSummary = engData?.summary
  const engVelocity = engSummary?.totalVelocity
  const engBugDensity = engSummary?.avgBugDensity
  const engBlocked = engSummary?.totalBlocked

  /* Status thresholds */
  const profitStatus: Status = totals ? (totals.totalProfit > 0 ? "ok" : "stop") : "neutral"
  const roiStatus: Status = totals ? (totals.avgRoi >= 15 ? "ok" : totals.avgRoi >= 0 ? "watch" : "stop") : "neutral"
  const stopStatus: Status = stopBuyers.length === 0 ? "ok" : stopBuyers.length <= 2 ? "watch" : "stop"
  const velocityStatus: Status = engVelocity != null ? (engVelocity >= 80 ? "ok" : engVelocity >= 65 ? "watch" : "stop") : "neutral"
  const bugStatus: Status = engBugDensity != null ? (engBugDensity <= 30 ? "ok" : engBugDensity <= 45 ? "watch" : "stop") : "neutral"
  const blockedStatus: Status = engBlocked != null ? (engBlocked === 0 ? "ok" : engBlocked <= 5 ? "watch" : "stop") : "neutral"

  /* FIX 4: Geo profit rows — top 3 (compressed) */
  const geoRows = (buyers?.buyers ?? [])
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 3)
    .map(b => ({
      name: b.buyer,
      profit: b.profit,
      roi: b.roi,
      status: (b.roi >= 15 ? "ok" : b.roi >= 0 ? "watch" : "stop") as Status,
    }))

  /* Sprint data */
  const asdSprint = engData?.teams?.ASD?.sprint
  const fsSprint = engData?.teams?.FS?.sprint

  /* Bottleneck — top 3 people by WIP (derived from team blocked counts) */
  const bottlenecks = [
    { initials: "AS", name: "ASD Team", count: engData?.teams?.ASD?.blocked?.count ?? 0 },
    { initials: "FS", name: "FS Team", count: engData?.teams?.FS?.blocked?.count ?? 0 },
  ]
    .filter(b => b.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
  const maxWip = Math.max(...bottlenecks.map(b => b.count), 1)

  /* FIX 4: Problem chips — limit to 4 + "+N more" */
  const activeProblems = probs.filter(p => p.status !== "resolved")
  const visibleProblems = activeProblems.slice(0, 4)
  const hiddenProblemCount = activeProblems.length - 4

  /* ─── Insight computation ─────────────────────────────────── */
  type InsightLevel = "critical" | "warning" | "positive"
  type Insight = { level: InsightLevel; text: string }
  const insights: Insight[] = []

  if (stopBuyers.length > 0) {
    const totalBurn = stopBuyers.reduce((s, b) => s + Math.abs(b.profit), 0)
    insights.push({
      level: "critical",
      text: `${stopBuyers.length} buyer group${stopBuyers.length > 1 ? "s" : ""} STOP. ${stopBuyers.map(b => b.buyer).join(", ")} burning ${fmt(totalBurn)}/mo.`,
    })
  }
  if (engVelocity != null && engVelocity < 70) {
    insights.push({
      level: "warning",
      text: `Sprint velocity at ${engVelocity}% (target 75%). Review sprint scope.`,
    })
  }
  if (engBlocked != null && engBlocked > 10) {
    insights.push({
      level: "warning",
      text: `${engBlocked} blocked items across teams. Redistribution needed.`,
    })
  }
  const okBuyers = (buyers?.buyers ?? []).filter(b => b.signal === "OK")
  if (okBuyers.length > 0 && totals && totals.totalProfit > 0 && insights.length === 0) {
    insights.push({
      level: "positive",
      text: `${okBuyers.length} buyer groups profitable \u2014 ${fmt(totals.totalProfit)} profit over ${period}d.`,
    })
  }

  /* AI recommendation */
  let recommendation: string | null = null
  const worstGeo = (buyers?.buyers ?? []).sort((a, b) => a.profit - b.profit)[0]
  if (worstGeo && worstGeo.roi < -10) {
    recommendation = `Consider pausing ${worstGeo.buyer} campaigns (ROI ${worstGeo.roi}%). Estimated savings: ${fmt(Math.abs(worstGeo.profit))}/month.`
  }

  /* Insight strip styling */
  const worstInsight = insights.find(i => i.level === "critical") ?? insights.find(i => i.level === "warning")
  const insightBg = worstInsight?.level === "critical"
    ? "bg-[var(--error-muted)]"
    : worstInsight?.level === "warning"
      ? "bg-[var(--warning-muted)]"
      : ""
  const InsightIcon = worstInsight?.level === "critical" || worstInsight?.level === "warning"
    ? AlertTriangle
    : insights.some(i => i.level === "positive")
      ? CheckCircle2
      : Lightbulb

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <>
      <PageHeader
        title={t("summary.title")}
        subtitle={t("summary.subtitle")}
        lastUpdated={lastUpdated || undefined}
        activePeriod={period}
        onPeriodChange={setPeriod}
        onRefresh={reload}
      />

      {/* FIX 1: Show skeleton while loading */}
      {loading && <LoadingSkeleton />}

      {!loading && (
        <>
          {/* ──────────────────────────────────────────────────────
              INSIGHT STRIP — FIX 5: more prominent, top border, larger text
              ────────────────────────────────────────────────────── */}
          {(insights.length > 0 || recommendation) && (
            <Section delay={0} className="mb-6">
              <div className={`rounded-xl px-5 py-4 ${insightBg}`} style={{ borderTop: "2px solid var(--border)" }}>
                {insights.map((ins, i) => {
                  const iconColor = ins.level === "critical" ? "var(--error)" : ins.level === "warning" ? "var(--warning)" : "var(--success)"
                  return (
                    <div key={i} className="flex items-start gap-2.5 py-0.5">
                      <InsightIcon className="h-3.5 w-3.5 shrink-0 mt-[3px]" style={{ color: iconColor }} />
                      <p className="text-[15px] leading-relaxed text-[var(--foreground)]">{ins.text}</p>
                    </div>
                  )
                })}
                {recommendation && (
                  <div
                    className="flex items-start gap-2.5 mt-2 px-3 py-2.5 rounded-lg"
                    style={{ background: "var(--muted)" }}
                  >
                    <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-[3px]" style={{ color: "var(--accent)" }} />
                    <p className="text-[12px] leading-relaxed font-medium" style={{ color: "var(--muted-foreground)" }}>
                      {recommendation}
                    </p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* FIX 1: Per-section errors for buyer data */}
          {errors.has("Buyers") && (
            <Section delay={80} className="mb-3">
              <DataError source="Buyer data" onRetry={reload} />
            </Section>
          )}

          {/* ──────────────────────────────────────────────────────
              ROW 1 — HERO KPIs: Profit (2fr), ROI, STOP, Velocity
              FIX 2: Hierarchical layout — profit as hero
              FIX 5: Sparklines on all money KPIs
              ────────────────────────────────────────────────────── */}
          <Section delay={80} className="mb-3">
            <div className="grid gap-3" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
              {/* Profit — HERO metric (2fr, larger text) */}
              <div
                onClick={() => router.push("/mcc/buying")}
                className="
                  rounded-2xl border border-white/50 dark:border-white/[0.07]
                  bg-[var(--card)] backdrop-blur-xl
                  p-6 cursor-pointer
                  transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-black/[0.05] dark:hover:shadow-black/20
                "
                style={{ animationDelay: "0ms", transform: "scale(0.97)", animation: "scale-in 0.5s cubic-bezier(0.22,1,0.36,1) forwards" }}
              >
                <div className="flex items-center gap-1 cursor-pointer group" onClick={(e) => { e.stopPropagation(); router.push("/mcc/buying") }}>
                  <span className="text-caption" title="Revenue minus cost across all campaigns">{t("summary.profit")}</span>
                  <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="font-bold tabular-nums" style={{ fontSize: "2.5rem", lineHeight: 1, color: statusColor(profitStatus) }}>
                    {totals ? fmt(totals.totalProfit) : "\u2014"}
                  </span>
                  <Sparkline data={profitSpark} />
                </div>
                {profitDelta && (
                  <div className="flex items-center gap-1 mt-3">
                    {profitDelta.trend === "up" && <TrendingUp className="h-3 w-3" style={{ color: "var(--success)" }} />}
                    {profitDelta.trend === "down" && <TrendingDown className="h-3 w-3" style={{ color: "var(--error)" }} />}
                    <span className="text-body-sm text-[var(--muted-foreground)]">{profitDelta.pct} vs prev</span>
                  </div>
                )}
              </div>

              {/* ROI — primary signal (1fr, 28px) */}
              <div
                onClick={() => router.push("/mcc/buying")}
                className="
                  rounded-2xl border border-white/50 dark:border-white/[0.07]
                  bg-[var(--card)] backdrop-blur-xl
                  p-5 cursor-pointer
                  transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-black/[0.05] dark:hover:shadow-black/20
                "
              >
                <span className="text-caption" title="Profit / cost x 100. Target: >15%">{t("summary.avgRoi")}</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="font-bold tabular-nums" style={{ fontSize: "1.75rem", lineHeight: 1, color: statusColor(roiStatus) }}>
                    {totals ? `${totals.avgRoi}%` : "\u2014"}
                  </span>
                  <Sparkline data={roiSpark} />
                </div>
                {roiDelta && (
                  <div className="flex items-center gap-1 mt-2">
                    {roiDelta.trend === "up" && <TrendingUp className="h-3 w-3" style={{ color: "var(--success)" }} />}
                    {roiDelta.trend === "down" && <TrendingDown className="h-3 w-3" style={{ color: "var(--error)" }} />}
                    <span className="text-body-sm text-[var(--muted-foreground)]">{roiDelta.pct} vs prev</span>
                  </div>
                )}
              </div>

              {/* STOP signals — primary signal (1fr, 28px) */}
              <div
                onClick={() => router.push("/mcc/buying")}
                className="
                  rounded-2xl border border-white/50 dark:border-white/[0.07]
                  bg-[var(--card)] backdrop-blur-xl
                  p-5 cursor-pointer
                  transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-black/[0.05] dark:hover:shadow-black/20
                "
              >
                <span className="text-caption" title="Campaigns with ROI below -30%. Losing money.">STOP</span>
                <div className="mt-2">
                  <span className="font-bold tabular-nums" style={{ fontSize: "1.75rem", lineHeight: 1, color: statusColor(stopStatus) }}>
                    {stopBuyers.length}
                  </span>
                </div>
                <p className="text-body-sm text-[var(--muted-foreground)] mt-2">
                  {stopBuyers.length > 0 ? `${fmt(stopBuyers.reduce((s, b) => s + Math.abs(b.profit), 0))}/mo` : "all clear"}
                </p>
              </div>

              {/* Velocity — primary signal (1fr, 28px) */}
              <div
                onClick={() => router.push("/mcc/engineering")}
                className="
                  rounded-2xl border border-white/50 dark:border-white/[0.07]
                  bg-[var(--card)] backdrop-blur-xl
                  p-5 cursor-pointer
                  transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-black/[0.05] dark:hover:shadow-black/20
                "
              >
                <div className="flex items-center gap-2">
                  <span className="text-caption" title="Sprint tasks completed / total. Target: >75%">{t("eng.velocity")}</span>
                  {engData?.source === "fallback" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--warning-muted)", color: "var(--warning)" }}>
                      Stale data
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <span className="font-bold tabular-nums" style={{ fontSize: "1.75rem", lineHeight: 1, color: statusColor(velocityStatus) }}>
                    {engVelocity != null ? pct(engVelocity) : "\u2014"}
                  </span>
                </div>
                <p className="text-body-sm text-[var(--muted-foreground)] mt-2">avg 75%</p>
              </div>
            </div>
          </Section>

          {/* ──────────────────────────────────────────────────────
              ROW 2 — SECONDARY CONTEXT: Spend, Revenue, Bugs, Blocked
              FIX 2: Smaller (20px), no frosted glass, subtle border
              FIX 5: Sparklines on Spend & Revenue
              ────────────────────────────────────────────────────── */}
          <Section delay={140} className="mb-10">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Spend */}
              <div
                onClick={() => router.push("/mcc/buying")}
                className="
                  rounded-2xl border border-[var(--border)]
                  px-4 py-3.5 cursor-pointer
                  transition-colors duration-200 hover:bg-white/30 dark:hover:bg-white/[0.03]
                "
              >
                <span className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]" title="Total ad spend across all campaigns">{t("summary.totalSpend")}</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-bold tabular-nums text-[var(--foreground)]" style={{ fontSize: "1.25rem", lineHeight: 1.2 }}>
                    {totals ? fmt(totals.totalSpend) : "\u2014"}
                  </span>
                  <Sparkline data={spendSpark} />
                </div>
                {spendDelta && (
                  <span className="text-[11px] text-[var(--muted-foreground)]">{spendDelta.pct} vs prev</span>
                )}
              </div>

              {/* Revenue */}
              <div
                onClick={() => router.push("/mcc/buying")}
                className="
                  rounded-2xl border border-[var(--border)]
                  px-4 py-3.5 cursor-pointer
                  transition-colors duration-200 hover:bg-white/30 dark:hover:bg-white/[0.03]
                "
              >
                <span className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]" title="Total revenue from conversions">{t("summary.revenue")}</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-bold tabular-nums text-[var(--foreground)]" style={{ fontSize: "1.25rem", lineHeight: 1.2 }}>
                    {totals ? fmt(totals.totalRevenue) : "\u2014"}
                  </span>
                  <Sparkline data={revenueSpark} />
                </div>
                {revDelta && (
                  <span className="text-[11px] text-[var(--muted-foreground)]">{revDelta.pct} vs prev</span>
                )}
              </div>

              {/* Bugs */}
              <div
                onClick={() => router.push("/mcc/engineering")}
                className="
                  rounded-2xl border border-[var(--border)]
                  px-4 py-3.5 cursor-pointer
                  transition-colors duration-200 hover:bg-white/30 dark:hover:bg-white/[0.03]
                "
              >
                <span className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]" title="Bug issues / total issues in last 90 days. Target: <20%">{t("eng.bugDensity")}</span>
                <div className="mt-1">
                  <span className="font-bold tabular-nums" style={{ fontSize: "1.25rem", lineHeight: 1.2, color: statusColor(bugStatus) }}>
                    {engBugDensity != null ? pct(engBugDensity) : "\u2014"}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--muted-foreground)]">target &lt;30%</span>
              </div>

              {/* Blocked */}
              <div
                onClick={() => router.push("/mcc/engineering")}
                className="
                  rounded-2xl border border-[var(--border)]
                  px-4 py-3.5 cursor-pointer
                  transition-colors duration-200 hover:bg-white/30 dark:hover:bg-white/[0.03]
                "
              >
                <span className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]" title="Issues in Hold or Blocked status across teams">{t("eng.blocked")}</span>
                <div className="mt-1">
                  <span className="font-bold tabular-nums" style={{ fontSize: "1.25rem", lineHeight: 1.2, color: statusColor(blockedStatus) }}>
                    {engBlocked ?? "\u2014"}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--muted-foreground)]">across teams</span>
              </div>
            </div>
          </Section>

          {/* FIX 1: Engineering error */}
          {errors.has("Engineering") && (
            <Section delay={200} className="mb-3">
              <DataError source="Engineering data" onRetry={reload} />
            </Section>
          )}

          {/* ──────────────────────────────────────────────────────
              SECTION A — ACTIVE FIRES
              FIX 4: Compressed geo table (top 3 + see all)
              FIX 5: Progressively more compact
              ────────────────────────────────────────────────────── */}
          <Section delay={200} className="mb-8">
            <SectionHeader label="Active Fires" href="/mcc/buying" />
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 mt-3">
              {/* Geo profit table — bare rows */}
              <div>
                {geoRows.map((g, i) => (
                  <div
                    key={i}
                    onClick={() => router.push("/mcc/buying")}
                    className="
                      flex items-center justify-between gap-4 px-3 py-2.5 rounded-xl cursor-pointer
                      transition-colors duration-150 hover:bg-white/30 dark:hover:bg-white/[0.04]
                    "
                  >
                    <span className="text-[13px] font-medium text-[var(--foreground)]">{g.name}</span>
                    <div className="flex items-center gap-5">
                      <span
                        className="text-[14px] font-bold tabular-nums"
                        style={{ color: g.profit >= 0 ? "var(--success)" : "var(--error)" }}
                      >
                        {g.profit >= 0 ? "+" : ""}{fmt(g.profit)}
                      </span>
                      <span className="text-[12px] tabular-nums text-[var(--muted-foreground)] min-w-[52px] text-right">
                        ROI {g.roi}%
                      </span>
                    </div>
                  </div>
                ))}
                {geoRows.length === 0 && (
                  <p className="text-[12px] text-[var(--muted-foreground)] px-3 py-4">No geo data available</p>
                )}
                {(buyers?.buyers ?? []).length > 3 && (
                  <div
                    className="px-3 py-2 cursor-pointer text-[12px] font-medium text-[var(--accent)] hover:underline"
                    onClick={() => router.push("/mcc/buying")}
                  >
                    See all {(buyers?.buyers ?? []).length} geos →
                  </div>
                )}
              </div>

              {/* STOP signals — tinted area */}
              {stopBuyers.length > 0 ? (
                <div className="rounded-2xl bg-[var(--error-muted)] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Ban className="h-3.5 w-3.5" style={{ color: "var(--error)" }} />
                    <p className="text-caption" style={{ color: "var(--error)" }}>STOP Signals</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {stopBuyers.map((sb, i) => (
                      <div key={i} className="flex items-center justify-between py-1">
                        <span className="text-[13px] font-medium" style={{ color: "var(--error)" }}>{sb.buyer}</span>
                        <span className="text-[13px] font-bold tabular-nums" style={{ color: "var(--error)" }}>{fmt(sb.profit)}</span>
                      </div>
                    ))}
                  </div>
                  <div
                    className="mt-2 pt-2 text-[12px] font-bold"
                    style={{ color: "var(--error)", borderTop: "1px solid oklch(0.62 0.22 25 / 0.15)" }}
                  >
                    Monthly burn: {fmt(stopBuyers.reduce((s, b) => s + Math.abs(b.profit), 0))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-4 rounded-2xl bg-[var(--success-muted)]">
                  <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--success)" }} />
                  <span className="text-[13px]" style={{ color: "var(--success)" }}>No STOP signals</span>
                </div>
              )}
            </div>
          </Section>

          {/* ──────────────────────────────────────────────────────
              SECTION B — ENGINEERING PULSE
              FIX 4: Compressed — sprint bars + bottlenecks side by side
              FIX 5: More compact as we scroll down
              ────────────────────────────────────────────────────── */}
          <Section delay={260} className="mb-8">
            <SectionHeader label="Engineering Pulse" href="/mcc/engineering" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
              {/* Sprint progress — two thin bars */}
              <div className="flex flex-col gap-3">
                {asdSprint && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-medium text-[var(--foreground)]">ASD</span>
                      <span
                        className="text-[12px] font-bold tabular-nums"
                        style={{ color: statusColor(asdSprint.velocity >= 75 ? "ok" : asdSprint.velocity >= 30 ? "watch" : "stop") }}
                      >
                        {asdSprint.velocity}%
                      </span>
                    </div>
                    <div className="h-1 bg-[var(--muted)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(asdSprint.velocity, 100)}%`,
                          background: asdSprint.velocity >= 75 ? "var(--success)" : asdSprint.velocity >= 30 ? "var(--warning)" : "var(--error)",
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{asdSprint.name}</p>
                  </div>
                )}
                {fsSprint && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-medium text-[var(--foreground)]">FS</span>
                      <span
                        className="text-[12px] font-bold tabular-nums"
                        style={{ color: statusColor(fsSprint.velocity >= 75 ? "ok" : fsSprint.velocity >= 30 ? "watch" : "stop") }}
                      >
                        {fsSprint.velocity}%
                      </span>
                    </div>
                    <div className="h-1 bg-[var(--muted)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(fsSprint.velocity, 100)}%`,
                          background: fsSprint.velocity >= 75 ? "var(--success)" : fsSprint.velocity >= 30 ? "var(--warning)" : "var(--error)",
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{fsSprint.name}</p>
                  </div>
                )}
                {!asdSprint && !fsSprint && (
                  <p className="text-[12px] text-[var(--muted-foreground)]">No sprint data</p>
                )}
              </div>

              {/* Top bottleneck people — avatar initials + bar + count */}
              <div className="flex flex-col gap-2.5">
                {bottlenecks.map((b, i) => {
                  const countStatus: Status = b.count >= 7 ? "stop" : b.count >= 4 ? "watch" : "ok"
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-[var(--muted)] flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-[var(--muted-foreground)]">{b.initials}</span>
                      </div>
                      <span className="text-[12px] text-[var(--foreground)] min-w-[72px]">{b.name}</span>
                      <div className="flex-1 h-1 bg-[var(--muted)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(b.count / maxWip) * 100}%`,
                            background: statusColor(countStatus),
                          }}
                        />
                      </div>
                      <span
                        className="text-[13px] font-bold tabular-nums min-w-[24px] text-right"
                        style={{ color: statusColor(countStatus) }}
                      >
                        {b.count}
                      </span>
                    </div>
                  )
                })}
                {bottlenecks.length === 0 && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--success)" }} />
                    <span className="text-[12px] text-[var(--muted-foreground)]">No bottlenecks</span>
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* ──────────────────────────────────────────────────────
              SECTION C — PROBLEM TRACKER
              FIX 4: Limit to 4 chips + "+N more"
              ────────────────────────────────────────────────────── */}
          <Section delay={320} className="mb-6">
            <SectionHeader label={t("summary.activeProblems")} href="/mcc/problems" />
            <div className="flex gap-2 flex-wrap mt-3">
              {visibleProblems.map((p) => {
                const Icon = problemIcons[p.category] ?? AlertTriangle
                const chipStatusColor =
                  p.severity === "critical" ? "var(--error)"
                  : p.severity === "high" ? "var(--warning)"
                  : "var(--muted-foreground)"
                return (
                  <div
                    key={p.id}
                    onClick={() => router.push("/mcc/problems")}
                    className="
                      flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer
                      bg-[var(--card)] backdrop-blur-xl
                      border border-white/40 dark:border-white/[0.06]
                      transition-all duration-200 hover:border-white/70 dark:hover:border-white/[0.12]
                    "
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
                    <span className="text-[12px] font-semibold text-[var(--foreground)] leading-tight whitespace-nowrap">
                      {p.title.length > 28 ? p.title.slice(0, 26) + "\u2026" : p.title}
                    </span>
                    <span className="text-[10px] font-medium leading-tight" style={{ color: chipStatusColor }}>
                      {p.status.replace(/_/g, " ")}
                    </span>
                  </div>
                )
              })}
              {hiddenProblemCount > 0 && (
                <div
                  onClick={() => router.push("/mcc/problems")}
                  className="
                    flex items-center gap-1 px-3 py-2 rounded-xl cursor-pointer
                    text-[12px] font-medium text-[var(--accent)] hover:underline
                  "
                >
                  +{hiddenProblemCount} more
                  <ChevronRight className="h-3 w-3" />
                </div>
              )}
              {activeProblems.length === 0 && (
                <div className="flex items-center gap-2 px-3 py-3">
                  <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--success)" }} />
                  <span className="text-[12px] text-[var(--muted-foreground)]">No active problems</span>
                </div>
              )}
            </div>
          </Section>

          {/* FIX 4: Infrastructure section REMOVED from homepage — lives on /mcc/processes */}
        </>
      )}

      {/* Scale-in keyframe (injected once) */}
      <style>{`
        @keyframes scale-in {
          from { transform: scale(0.97); opacity: 0.8; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  )
}
