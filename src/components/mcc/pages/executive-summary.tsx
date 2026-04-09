"use client"

import { useEffect, useState } from "react"
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

function fmt(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

export function ExecutiveSummary() {
  const [buyers, setBuyers] = useState<BuyerData | null>(null)
  const [problems, setProblems] = useState<ProblemData | null>(null)
  const [infra, setInfra] = useState<InfraData | null>(null)
  const [period, setPeriod] = useState(30)
  const { t } = useI18n()

  const reload = () => {
    const to = new Date().toISOString().split("T")[0]
    const from = new Date(Date.now() - period * 86400000).toISOString().split("T")[0]
    fetch(`/api/mcc/keitaro/buyers?from=${from}&to=${to}`).then(r => r.json()).then(setBuyers).catch(() => {})
    fetch("/api/mcc/problems").then(r => r.json()).then(setProblems).catch(() => {})
    fetch("/api/mcc/airtable/infra").then(r => r.json()).then(setInfra).catch(() => {})
  }

  useEffect(() => { reload() }, [period])

  const totals = buyers?.totals
  const probs = problems?.problems ?? []
  const criticalProbs = probs.filter(p => p.severity === "critical")
  const stopBuyers = (buyers?.buyers ?? []).filter(b => b.signal === "STOP")

  // Infrastructure metrics
  const infraTasks = infra?.tasks ?? []
  const infraServices = infra?.services ?? []
  const totalTasks = infraTasks.length
  const inProgressCount = infraTasks.filter(t => t.status === "in_progress" || t.status === "In Progress").length
  const serviceCount = infraServices.length
  const overdueCount = infraServices.filter(s => s.daysLeft < 0).length

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
      text: `Overall ROI is ${totals.avgRoi}% — below 10% target. Only ${(buyers?.buyers ?? []).filter(b => b.signal === "OK").length} of ${(buyers?.buyers ?? []).length} buyer groups are profitable.`,
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
            <ScoreBox label={t("summary.totalSpend")} value={totals ? fmt(totals.totalSpend) : "—"} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox label={t("summary.revenue")} value={totals ? fmt(totals.totalRevenue) : "—"} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox
              label={t("summary.profit")}
              value={totals ? fmt(totals.totalProfit) : "—"}
              status={totals ? (totals.totalProfit >= 0 ? "ok" : "stop") : "neutral"}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox
              label={t("summary.avgRoi")}
              value={totals ? `${totals.avgRoi}%` : "—"}
              status={totals ? (totals.avgRoi >= 15 ? "ok" : totals.avgRoi >= 0 ? "watch" : "stop") : "neutral"}
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
            { label: t("common.spend"), value: totals ? fmt(totals.totalSpend) : "—" },
            { label: t("common.profit"), value: totals ? fmt(totals.totalProfit) : "—", status: totals ? (totals.totalProfit >= 0 ? "ok" : "stop") : "neutral" },
            { label: t("common.roi"), value: totals ? `${totals.avgRoi}%` : "—", status: totals ? (totals.avgRoi >= 15 ? "ok" : totals.avgRoi >= 0 ? "watch" : "stop") : "neutral" },
            { label: t("buying.stopSignals"), value: stopBuyers.length, status: stopBuyers.length > 0 ? "stop" : "ok" },
          ]}
          alert={stopBuyers.length > 0 ? `${stopBuyers.length} buyer groups losing money (ROI < -30%)` : undefined}
        />

        <DeptCard
          name={t("nav.engineering")}
          href="/engineering"
          status="yellow"
          metrics={[
            { label: t("eng.sprint"), value: "MB AP 20" },
            { label: t("eng.velocity"), value: "61%", status: "stop" },
            { label: t("eng.bugDensity"), value: "44%", status: "stop" },
            { label: t("eng.blocked"), value: "12", status: "watch" },
          ]}
          alert="Sprint velocity dropped from 87% avg to 61%. 53% of FS work is bug-fixing."
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
          name="Infrastructure"
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
