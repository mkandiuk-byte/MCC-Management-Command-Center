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
  Server,
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

/* Mini sparkline — ONLY for Profit and Revenue where daily trend data exists */
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
  const [infra, setInfra] = useState<InfraData | null>(null)
  const [engData, setEngData] = useState<EngineeringApiData | null>(null)
  const [peopleCount, setPeopleCount] = useState<number | null>(null)
  const [profitSpark, setProfitSpark] = useState<number[]>([])
  const [revenueSpark, setRevenueSpark] = useState<number[]>([])
  const [period, setPeriod] = useState(30)
  const [lastUpdated, setLastUpdated] = useState("")
  const { t } = useI18n()
  const router = useRouter()

  /* ─── Data fetch — all endpoints in parallel ─────────────── */
  const reload = useCallback(() => {
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
      fetch("/api/mcc/airtable/infra").then(r => r.json()),
      fetch("/api/mcc/airtable/people").then(r => r.json()),
    ]).then(([buyersR, prevR, roiR, probR, engR, infraR, peopleR]) => {
      if (buyersR.status === "fulfilled") setBuyers(buyersR.value)
      if (prevR.status === "fulfilled") setPrevBuyers(prevR.value)
      if (roiR.status === "fulfilled") {
        const d = roiR.value as RoiResponse
        if (d?.daily) {
          const last7 = d.daily.slice(-7)
          setProfitSpark(last7.map(r => r.profit))
          setRevenueSpark(last7.map(r => r.revenue))
        }
      }
      if (probR.status === "fulfilled") setProblems(probR.value)
      if (engR.status === "fulfilled") setEngData(engR.value)
      if (infraR.status === "fulfilled") setInfra(infraR.value)
      if (peopleR.status === "fulfilled") {
        const pd = peopleR.value as PeopleData
        setPeopleCount(pd?.count ?? null)
      }
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

  /* Geo profit rows — top 5 */
  const geoRows = (buyers?.buyers ?? [])
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5)
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

  /* Infra numbers */
  const infraTasks = infra?.tasks ?? []
  const infraServices = infra?.services ?? []

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

      {/* ──────────────────────────────────────────────────────
          INSIGHT STRIP — not a card, just tinted text
          ────────────────────────────────────────────────────── */}
      {(insights.length > 0 || recommendation) && (
        <Section delay={30} className="mb-6">
          <div className={`rounded-xl px-5 py-3.5 ${insightBg}`}>
            {insights.map((ins, i) => {
              const iconColor = ins.level === "critical" ? "var(--error)" : ins.level === "warning" ? "var(--warning)" : "var(--success)"
              return (
                <div key={i} className="flex items-start gap-2.5 py-0.5">
                  <InsightIcon className="h-3.5 w-3.5 shrink-0 mt-[3px]" style={{ color: iconColor }} />
                  <p className="text-[13px] leading-relaxed text-[var(--foreground)]">{ins.text}</p>
                </div>
              )
            })}
            {recommendation && (
              <div className="flex items-start gap-2.5 mt-1 pt-1">
                <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-[3px]" style={{ color: "var(--accent)" }} />
                <p className="text-[12px] leading-relaxed italic" style={{ color: "var(--muted-foreground)" }}>
                  {recommendation}
                </p>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ──────────────────────────────────────────────────────
          ROW 1 — MONEY: Profit, ROI, Spend, Revenue
          ────────────────────────────────────────────────────── */}
      <Section delay={80} className="mb-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger-children">
          {/* Profit — hero metric */}
          <div
            onClick={() => router.push("/mcc/buying")}
            className="
              rounded-2xl border border-white/50 dark:border-white/[0.07]
              bg-[var(--card)] backdrop-blur-xl
              p-5 cursor-pointer
              transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-black/[0.05] dark:hover:shadow-black/20
            "
            style={{ animationDelay: "0ms", transform: "scale(0.97)", animation: "scale-in 0.5s cubic-bezier(0.22,1,0.36,1) forwards" }}
          >
            <p className="text-caption mb-2">{t("summary.profit")}</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-kpi" style={{ color: statusColor(profitStatus) }}>
                {totals ? fmt(totals.totalProfit) : "\u2014"}
              </span>
              <Sparkline data={profitSpark} />
            </div>
            {profitDelta && (
              <div className="flex items-center gap-1 mt-2">
                {profitDelta.trend === "up" && <TrendingUp className="h-3 w-3" style={{ color: "var(--success)" }} />}
                {profitDelta.trend === "down" && <TrendingDown className="h-3 w-3" style={{ color: "var(--error)" }} />}
                <span className="text-body-sm text-[var(--muted-foreground)]">{profitDelta.pct} vs prev</span>
              </div>
            )}
          </div>

          {/* ROI */}
          <div
            onClick={() => router.push("/mcc/buying")}
            className="
              rounded-2xl border border-white/50 dark:border-white/[0.07]
              bg-[var(--card)] backdrop-blur-xl
              p-5 cursor-pointer
              transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-black/[0.05] dark:hover:shadow-black/20
            "
          >
            <p className="text-caption mb-2">{t("summary.avgRoi")}</p>
            <span className="text-kpi" style={{ color: statusColor(roiStatus) }}>
              {totals ? `${totals.avgRoi}%` : "\u2014"}
            </span>
            {roiDelta && (
              <div className="flex items-center gap-1 mt-2">
                {roiDelta.trend === "up" && <TrendingUp className="h-3 w-3" style={{ color: "var(--success)" }} />}
                {roiDelta.trend === "down" && <TrendingDown className="h-3 w-3" style={{ color: "var(--error)" }} />}
                <span className="text-body-sm text-[var(--muted-foreground)]">{roiDelta.pct} vs prev</span>
              </div>
            )}
          </div>

          {/* Spend — informational, no status color */}
          <div
            onClick={() => router.push("/mcc/buying")}
            className="
              rounded-2xl border border-white/50 dark:border-white/[0.07]
              bg-[var(--card)] backdrop-blur-xl
              p-5 cursor-pointer
              transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-black/[0.05] dark:hover:shadow-black/20
            "
          >
            <p className="text-caption mb-2">{t("summary.totalSpend")}</p>
            <span className="text-kpi text-[var(--foreground)]">
              {totals ? fmt(totals.totalSpend) : "\u2014"}
            </span>
            {spendDelta && (
              <div className="flex items-center gap-1 mt-2">
                <span className="text-body-sm text-[var(--muted-foreground)]">{spendDelta.pct} vs prev</span>
              </div>
            )}
          </div>

          {/* Revenue — informational, sparkline for trend */}
          <div
            onClick={() => router.push("/mcc/buying")}
            className="
              rounded-2xl border border-white/50 dark:border-white/[0.07]
              bg-[var(--card)] backdrop-blur-xl
              p-5 cursor-pointer
              transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-black/[0.05] dark:hover:shadow-black/20
            "
          >
            <p className="text-caption mb-2">{t("summary.revenue")}</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-kpi text-[var(--foreground)]">
                {totals ? fmt(totals.totalRevenue) : "\u2014"}
              </span>
              <Sparkline data={revenueSpark} />
            </div>
            {revDelta && (
              <div className="flex items-center gap-1 mt-2">
                <span className="text-body-sm text-[var(--muted-foreground)]">{revDelta.pct} vs prev</span>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ──────────────────────────────────────────────────────
          ROW 2 — OPERATIONS: STOP, Velocity, Bugs, Blocked
          ────────────────────────────────────────────────────── */}
      <Section delay={140} className="mb-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger-children">
          {/* STOP signals */}
          <div
            onClick={() => router.push("/mcc/buying")}
            className="
              rounded-2xl border border-white/50 dark:border-white/[0.07]
              bg-[var(--card)] backdrop-blur-xl
              p-5 cursor-pointer
              transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-black/[0.05] dark:hover:shadow-black/20
            "
          >
            <p className="text-caption mb-2">STOP</p>
            <span className="text-kpi" style={{ color: statusColor(stopStatus) }}>
              {stopBuyers.length}
            </span>
            <p className="text-body-sm text-[var(--muted-foreground)] mt-2">
              {stopBuyers.length > 0 ? `${fmt(stopBuyers.reduce((s, b) => s + Math.abs(b.profit), 0))}/mo` : "all clear"}
            </p>
          </div>

          {/* Velocity */}
          <div
            onClick={() => router.push("/mcc/engineering")}
            className="
              rounded-2xl border border-white/50 dark:border-white/[0.07]
              bg-[var(--card)] backdrop-blur-xl
              p-5 cursor-pointer
              transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-black/[0.05] dark:hover:shadow-black/20
            "
          >
            <p className="text-caption mb-2">{t("eng.velocity")}</p>
            <span className="text-kpi" style={{ color: statusColor(velocityStatus) }}>
              {engVelocity != null ? pct(engVelocity) : "\u2014"}
            </span>
            <p className="text-body-sm text-[var(--muted-foreground)] mt-2">avg 75%</p>
          </div>

          {/* Bug Density */}
          <div
            onClick={() => router.push("/mcc/engineering")}
            className="
              rounded-2xl border border-white/50 dark:border-white/[0.07]
              bg-[var(--card)] backdrop-blur-xl
              p-5 cursor-pointer
              transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-black/[0.05] dark:hover:shadow-black/20
            "
          >
            <p className="text-caption mb-2">{t("eng.bugDensity")}</p>
            <span className="text-kpi" style={{ color: statusColor(bugStatus) }}>
              {engBugDensity != null ? pct(engBugDensity) : "\u2014"}
            </span>
            <p className="text-body-sm text-[var(--muted-foreground)] mt-2">target &lt;30%</p>
          </div>

          {/* Blocked */}
          <div
            onClick={() => router.push("/mcc/engineering")}
            className="
              rounded-2xl border border-white/50 dark:border-white/[0.07]
              bg-[var(--card)] backdrop-blur-xl
              p-5 cursor-pointer
              transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-black/[0.05] dark:hover:shadow-black/20
            "
          >
            <p className="text-caption mb-2">{t("eng.blocked")}</p>
            <span className="text-kpi" style={{ color: statusColor(blockedStatus) }}>
              {engBlocked ?? "\u2014"}
            </span>
            <p className="text-body-sm text-[var(--muted-foreground)] mt-2">across teams</p>
          </div>
        </div>
      </Section>

      {/* ──────────────────────────────────────────────────────
          SECTION A — ACTIVE FIRES
          ────────────────────────────────────────────────────── */}
      <Section delay={200} className="mb-10">
        <p className="text-section-header mb-4">Active Fires</p>
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
          {/* Geo profit table — bare rows, no card wrapper */}
          <div>
            {geoRows.map((g, i) => (
              <div
                key={i}
                onClick={() => router.push("/mcc/buying")}
                className="
                  flex items-center justify-between gap-4 px-4 py-3 rounded-xl cursor-pointer
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
              <p className="text-[12px] text-[var(--muted-foreground)] px-4 py-6">No geo data available</p>
            )}
          </div>

          {/* STOP signals — tinted area, NOT a card with stripe */}
          {stopBuyers.length > 0 ? (
            <div className="rounded-2xl bg-[var(--error-muted)] p-5">
              <div className="flex items-center gap-2 mb-3">
                <Ban className="h-3.5 w-3.5" style={{ color: "var(--error)" }} />
                <p className="text-caption" style={{ color: "var(--error)" }}>STOP Signals</p>
              </div>
              <div className="flex flex-col gap-1.5">
                {stopBuyers.map((sb, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <span className="text-[13px] font-medium" style={{ color: "var(--error)" }}>{sb.buyer}</span>
                    <span className="text-[13px] font-bold tabular-nums" style={{ color: "var(--error)" }}>{fmt(sb.profit)}</span>
                  </div>
                ))}
              </div>
              <div
                className="mt-3 pt-3 text-[12px] font-bold"
                style={{ color: "var(--error)", borderTop: "1px solid oklch(0.62 0.22 25 / 0.15)" }}
              >
                Monthly burn: {fmt(stopBuyers.reduce((s, b) => s + Math.abs(b.profit), 0))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-6 rounded-2xl bg-[var(--success-muted)]">
              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--success)" }} />
              <span className="text-[13px]" style={{ color: "var(--success)" }}>No STOP signals</span>
            </div>
          )}
        </div>
      </Section>

      {/* ──────────────────────────────────────────────────────
          SECTION B — ENGINEERING PULSE
          ────────────────────────────────────────────────────── */}
      <Section delay={260} className="mb-10">
        <p className="text-section-header mb-4">Engineering Pulse</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sprint progress — two thin bars */}
          <div>
            <div className="flex flex-col gap-4">
              {asdSprint && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
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
                  <p className="text-[10px] text-[var(--muted-foreground)] mt-1">{asdSprint.name}</p>
                </div>
              )}
              {fsSprint && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
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
                  <p className="text-[10px] text-[var(--muted-foreground)] mt-1">{fsSprint.name}</p>
                </div>
              )}
              {!asdSprint && !fsSprint && (
                <p className="text-[12px] text-[var(--muted-foreground)]">No sprint data</p>
              )}
            </div>
          </div>

          {/* Top bottleneck people — avatar initials + bar + count */}
          <div>
            <div className="flex flex-col gap-3">
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
        </div>
      </Section>

      {/* ──────────────────────────────────────────────────────
          SECTION C — PROBLEM TRACKER (horizontal chips)
          ────────────────────────────────────────────────────── */}
      <Section delay={320} className="mb-10">
        <p className="text-section-header mb-4">{t("summary.activeProblems")}</p>
        <div className="flex gap-2.5 flex-wrap">
          {probs
            .filter(p => p.status !== "resolved")
            .slice(0, 10)
            .map((p) => {
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
                    flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer
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
          {probs.filter(p => p.status !== "resolved").length === 0 && (
            <div className="flex items-center gap-2 px-4 py-3">
              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--success)" }} />
              <span className="text-[12px] text-[var(--muted-foreground)]">No active problems</span>
            </div>
          )}
        </div>
      </Section>

      {/* ──────────────────────────────────────────────────────
          SECTION D — INFRASTRUCTURE (single line strip)
          ────────────────────────────────────────────────────── */}
      <Section delay={380} className="mb-6">
        <p className="text-section-header mb-3">Infrastructure</p>
        <div
          onClick={() => router.push("/mcc/processes")}
          className="
            inline-flex items-center gap-6 px-5 py-3 rounded-xl cursor-pointer
            bg-[var(--card)] backdrop-blur-xl
            border border-white/30 dark:border-white/[0.05]
            transition-colors duration-200 hover:bg-white/50 dark:hover:bg-white/[0.06]
          "
        >
          {[
            { icon: Server, label: "Tasks", value: infraTasks.length },
            { icon: Shield, label: "Services", value: infraServices.length },
            { icon: Users, label: "People", value: peopleCount ?? "\u2014" },
          ].map((item, i) => {
            const Icon = item.icon
            return (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && <span className="text-[var(--border)] mr-2">|</span>}
                <Icon className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                <span className="text-[12px] text-[var(--muted-foreground)]">{item.label}:</span>
                <span className="text-[13px] font-bold tabular-nums text-[var(--foreground)]">{item.value}</span>
              </div>
            )
          })}
        </div>
      </Section>

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
