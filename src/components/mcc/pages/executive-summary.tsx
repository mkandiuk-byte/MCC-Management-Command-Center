"use client"

import { useEffect, useState, useRef } from "react"
import { PageHeader } from "@/components/mcc/page-header"
import { ScoreBox } from "@/components/mcc/score-box"
import { DeptCard } from "@/components/mcc/dept-card"
import { InsightsCard, type Insight } from "@/components/mcc/insights-card"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useI18n } from "@/lib/mcc-i18n"

interface BuyerData {
  buyers: { buyer: string; cost: number; revenue: number; profit: number; roi: number; signal: string }[]
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
    ASD: {
      sprint: { name: string; velocity: number }
      bugDensity: { ratio: number }
      blocked: { count: number }
    }
    FS: {
      sprint: { name: string; velocity: number }
      bugDensity: { ratio: number }
      blocked: { count: number }
    }
  }
  summary: {
    totalVelocity: number
    avgBugDensity: number
    totalBlocked: number
    zombieEpicCount: number
  }
  updatedAt: string
  source: "jira_api" | "fallback"
}

interface RoiDailyRow {
  grouping: string
  profit: number
  revenue: number
  cost: number
}

interface RoiResponse {
  daily: RoiDailyRow[]
}

function fmt(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

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

function fmtDelta(current: number, previous: number): string {
  const { pct } = computeDelta(current, previous)
  return `${pct} vs prev`
}

export function ExecutiveSummary() {
  const [buyers, setBuyers] = useState<BuyerData | null>(null)
  const [prevBuyers, setPrevBuyers] = useState<BuyerData | null>(null)
  const [problems, setProblems] = useState<ProblemData | null>(null)
  const [infra, setInfra] = useState<InfraData | null>(null)
  const [engData, setEngData] = useState<EngineeringApiData | null>(null)
  const [sparkData, setSparkData] = useState<number[]>([])
  const [period, setPeriod] = useState(30)
  const [lastUpdated, setLastUpdated] = useState<string>("")
  const { t } = useI18n()

  const reload = () => {
    const to = new Date().toISOString().split("T")[0]
    const from = new Date(Date.now() - period * 86400000).toISOString().split("T")[0]
    const prevFrom = new Date(Date.now() - period * 2 * 86400000).toISOString().split("T")[0]
    const prevTo = new Date(Date.now() - period * 86400000).toISOString().split("T")[0]

    // Fetch current and previous periods in parallel
    fetch(`/api/mcc/keitaro/buyers?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(setBuyers)
      .catch(() => {})

    fetch(`/api/mcc/keitaro/buyers?from=${prevFrom}&to=${prevTo}`)
      .then(r => r.json())
      .then(setPrevBuyers)
      .catch(() => setPrevBuyers(null))

    fetch("/api/mcc/problems").then(r => r.json()).then(setProblems).catch(() => {})
    fetch("/api/mcc/airtable/infra").then(r => r.json()).then(setInfra).catch(() => {})
    fetch("/api/mcc/jira/engineering").then(r => r.json()).then(setEngData).catch(() => {})

    // Fetch daily ROI for sparkline
    fetch(`/api/mcc/keitaro/roi?from=${from}&to=${to}`)
      .then(r => r.json())
      .then((d: RoiResponse) => {
        if (d?.daily) {
          const dailyProfits = d.daily.map((row) => row.profit)
          setSparkData(dailyProfits.slice(-7))
        }
      })
      .catch(() => {})

    setLastUpdated(new Date().toISOString())
  }

  useEffect(() => { reload() }, [period])

  const totals = buyers?.totals
  const prevTotals = prevBuyers?.totals
  const probs = problems?.problems ?? []
  const criticalProbs = probs.filter(p => p.severity === "critical")
  const stopBuyers = (buyers?.buyers ?? []).filter(b => b.signal === "STOP")

  // Comparison helpers — graceful when prevTotals is null
  const spendDelta = totals && prevTotals ? computeDelta(totals.totalSpend, prevTotals.totalSpend) : null
  const revDelta = totals && prevTotals ? computeDelta(totals.totalRevenue, prevTotals.totalRevenue) : null
  const profitDelta = totals && prevTotals ? computeDelta(totals.totalProfit, prevTotals.totalProfit) : null
  const roiDelta = totals && prevTotals ? computeDelta(totals.avgRoi, prevTotals.avgRoi) : null

  // Infrastructure metrics
  const infraTasks = infra?.tasks ?? []
  const infraServices = infra?.services ?? []
  const totalTasks = infraTasks.length
  const inProgressCount = infraTasks.filter(t => t.status === "in_progress" || t.status === "In Progress").length
  const serviceCount = infraServices.length
  const overdueCount = infraServices.filter(s => s.daysLeft < 0).length

  // Engineering metrics from live data
  const engSummary = engData?.summary
  const engVelocity = engSummary?.totalVelocity
  const engBugDensity = engSummary?.avgBugDensity
  const engBlocked = engSummary?.totalBlocked
  const engSprintName = engData?.teams?.ASD?.sprint?.name ?? "\u2014"

  // Engineering status coloring
  const velocityStatus: "ok" | "watch" | "stop" | "neutral" = engVelocity != null
    ? (engVelocity >= 80 ? "ok" : engVelocity >= 65 ? "watch" : "stop")
    : "neutral"
  const bugDensityStatus: "ok" | "watch" | "stop" | "neutral" = engBugDensity != null
    ? (engBugDensity <= 30 ? "ok" : engBugDensity <= 45 ? "watch" : "stop")
    : "neutral"
  const blockedStatus: "ok" | "watch" | "stop" | "neutral" = engBlocked != null
    ? (engBlocked === 0 ? "ok" : engBlocked <= 5 ? "watch" : "stop")
    : "neutral"

  // Engineering alert
  const engHasAlert = (engVelocity != null && engVelocity < 70) ||
    (engBugDensity != null && engBugDensity > 40) ||
    (engBlocked != null && engBlocked > 10)

  const engAlertParts: string[] = []
  if (engVelocity != null && engVelocity < 70) engAlertParts.push(`Velocity at ${engVelocity}%`)
  if (engBugDensity != null && engBugDensity > 40) engAlertParts.push(`Bug density ${engBugDensity}%`)
  if (engBlocked != null && engBlocked > 10) engAlertParts.push(`${engBlocked} blocked items`)
  const engAlertText = engAlertParts.length > 0 ? engAlertParts.join(". ") + "." : undefined

  // Engineering DeptCard overall status
  const engCardStatus: "green" | "yellow" | "red" | "gray" = !engData ? "gray"
    : engHasAlert ? "red"
    : velocityStatus === "ok" && bugDensityStatus !== "stop" ? "green"
    : "yellow"

  // Compute insights from real data
  const insights: Insight[] = []
  if (stopBuyers.length > 0) {
    insights.push({
      type: "warning",
      text: `${stopBuyers.length} buyer group${stopBuyers.length > 1 ? "s" : ""} with STOP signal (ROI < -30%). Burning money: ${stopBuyers.map(b => b.buyer).join(", ")}.`,
    })
  }
  if (totals && totals.avgRoi < 10) {
    insights.push({
      type: "warning",
      text: `Overall ROI is ${totals.avgRoi}% \u2014 below 10% target. Only ${(buyers?.buyers ?? []).filter(b => b.signal === "OK").length} of ${(buyers?.buyers ?? []).length} buyer groups are profitable.`,
    })
  }
  if (criticalProbs.length > 0) {
    insights.push({
      type: "warning",
      text: `${criticalProbs.length} critical problem${criticalProbs.length > 1 ? "s" : ""} open: ${criticalProbs.map(p => p.title.slice(0, 50)).join("; ")}.`,
    })
  }
  // Positive
  const okBuyers = (buyers?.buyers ?? []).filter(b => b.signal === "OK")
  if (okBuyers.length > 0 && totals && totals.totalProfit > 0) {
    insights.push({
      type: "success",
      text: `${okBuyers.length} buyer groups profitable, generating ${fmt(totals.totalProfit)} profit over ${period} days.`,
    })
  }

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

      {/* Insights */}
      {insights.length > 0 && (
        <InsightsCard insights={insights} className="mb-8" />
      )}

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8 stagger-children">
        <Card>
          <CardContent className="p-5">
            <ScoreBox
              label={t("summary.totalSpend")}
              value={totals ? fmt(totals.totalSpend) : "\u2014"}
              trend={spendDelta?.trend}
              comparison={spendDelta ? `${spendDelta.pct} vs prev` : undefined}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox
              label={t("summary.revenue")}
              value={totals ? fmt(totals.totalRevenue) : "\u2014"}
              trend={revDelta?.trend}
              comparison={revDelta ? `${revDelta.pct} vs prev` : undefined}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox
              label={t("summary.profit")}
              value={totals ? fmt(totals.totalProfit) : "\u2014"}
              status={totals ? (totals.totalProfit >= 0 ? "ok" : "stop") : "neutral"}
              trend={profitDelta?.trend}
              comparison={profitDelta ? `${profitDelta.pct} vs prev` : undefined}
              sparkData={sparkData.length >= 2 ? sparkData : undefined}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox
              label={t("summary.avgRoi")}
              value={totals ? `${totals.avgRoi}%` : "\u2014"}
              status={totals ? (totals.avgRoi >= 15 ? "ok" : totals.avgRoi >= 0 ? "watch" : "stop") : "neutral"}
              trend={roiDelta?.trend}
              comparison={roiDelta ? `${roiDelta.pct} vs prev` : undefined}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox
              label={t("summary.openProblems")}
              value={probs.filter(p => p.status !== "resolved").length}
              sub={criticalProbs.length > 0 ? `${criticalProbs.length} ${t("summary.critical")}` : undefined}
              status={criticalProbs.length > 0 ? "stop" : "neutral"}
            />
          </CardContent>
        </Card>
      </div>

      {/* Department Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5 mb-8 stagger-children">
        <DeptCard
          name={t("nav.buying")}
          href="/buying"
          status={totals ? (totals.avgRoi >= 15 ? "green" : totals.avgRoi >= 0 ? "yellow" : "red") : "gray"}
          metrics={[
            { label: t("common.spend"), value: totals ? fmt(totals.totalSpend) : "\u2014" },
            { label: t("common.profit"), value: totals ? fmt(totals.totalProfit) : "\u2014", status: totals ? (totals.totalProfit >= 0 ? "ok" : "stop") : "neutral" },
            { label: t("common.roi"), value: totals ? `${totals.avgRoi}%` : "\u2014", status: totals ? (totals.avgRoi >= 15 ? "ok" : totals.avgRoi >= 0 ? "watch" : "stop") : "neutral" },
            { label: t("buying.stopSignals"), value: stopBuyers.length, status: stopBuyers.length > 0 ? "stop" : "ok" },
          ]}
          alert={stopBuyers.length > 0 ? `${stopBuyers.length} buyer groups losing money (ROI < -30%)` : undefined}
        />

        <DeptCard
          name={t("nav.engineering")}
          href="/engineering"
          status={engCardStatus}
          metrics={[
            { label: t("eng.sprint"), value: engData ? engSprintName : "..." },
            { label: t("eng.velocity"), value: engVelocity != null ? `${engVelocity}%` : "\u2014", status: velocityStatus },
            { label: t("eng.bugDensity"), value: engBugDensity != null ? `${engBugDensity}%` : "\u2014", status: bugDensityStatus },
            { label: t("eng.blocked"), value: engBlocked != null ? `${engBlocked}` : "\u2014", status: blockedStatus },
          ]}
          alert={engAlertText}
        />

        <DeptCard
          name={t("nav.analytics")}
          href="/analytics"
          status="yellow"
          metrics={[
            { label: "Self-Serve", value: "Partial" },
            { label: "Data Fresh", value: "15 min" },
            { label: "Pipeline", value: "Running", status: "ok" },
            { label: "Coverage", value: "~60%" },
          ]}
          alert="Report turnaround: weeks. Self-serve analytics covers ~60% of queries."
        />

        <DeptCard
          name={t("nav.infrastructure" as any) || "Infrastructure"}
          href="/processes"
          status={overdueCount > 0 ? "red" : inProgressCount > 0 ? "green" : "yellow"}
          metrics={[
            { label: "Tasks", value: infra ? totalTasks : "..." },
            { label: "In Progress", value: infra ? inProgressCount : "..." },
            { label: "Services", value: infra ? serviceCount : "..." },
            { label: "Overdue", value: infra ? overdueCount : "...", status: overdueCount > 0 ? "stop" : "ok" },
          ]}
          alert={overdueCount > 0 ? `${overdueCount} service${overdueCount > 1 ? "s" : ""} with overdue payments` : undefined}
        />
      </div>

      {/* Recent Problems */}
      <div>
        <h2 className="text-section-header mb-4">{t("summary.activeProblems")}</h2>
        <div className="space-y-2">
          {probs
            .filter(p => p.status !== "resolved")
            .slice(0, 5)
            .map((p) => (
              <Card key={p.id}>
                <CardContent className="flex items-center gap-4 px-5 py-3">
                  <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                    p.severity === "critical" ? "bg-[var(--error)]" :
                    p.severity === "high" ? "bg-[var(--warning)]" :
                    p.severity === "medium" ? "bg-[var(--info)]" : "bg-[var(--muted-foreground)]"
                  }`} />
                  <span className="text-[14px] font-medium text-[var(--foreground)] flex-1 truncate">{p.title}</span>
                  <Badge variant="secondary" className="text-[11px] font-medium capitalize">
                    {p.status}
                  </Badge>
                  <Badge variant="outline" className="text-[11px] capitalize">
                    {p.category.replace(/_/g, " ")}
                  </Badge>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    </>
  )
}
