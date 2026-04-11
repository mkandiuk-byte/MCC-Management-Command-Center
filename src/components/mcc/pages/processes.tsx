"use client"

import { useEffect, useState } from "react"
import { PageHeader } from "@/components/mcc/page-header"
import { ScoreBox } from "@/components/mcc/score-box"
import { InsightsCard, type Insight } from "@/components/mcc/insights-card"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Users, ShieldCheck } from "lucide-react"
import { useI18n } from "@/lib/mcc-i18n"

/* -- Types --------------------------------------------------------- */

interface PipelineStage {
  name: string
  count?: number
}

interface KPI {
  label: string
  value: string | number
  status: "ok" | "watch" | "stop" | "neutral"
  sub?: string
}

interface ProcessSection {
  department: string
  pipelines: { label?: string; stages: PipelineStage[] }[]
  kpis: KPI[]
}

interface InfraTask {
  id: string
  status: string
  title: string
}

interface InfraService {
  name: string
  cost: number
  billingCycle: string
  nextPayment: string
  daysLeft: number
}

interface InfraData {
  tasks: InfraTask[]
  services: InfraService[]
}

interface EngineeringApiData {
  teams: {
    ASD: {
      sprint: { name: string; velocity: number; doneIssues: number; totalIssues: number }
      bugDensity: { bugCount90d: number; totalCount90d: number; ratio: number }
      blocked: { count: number }
      pipeline: Record<string, number>
      workload: { person: string; total: number }[]
    }
    FS: {
      sprint: { name: string; velocity: number; doneIssues: number; totalIssues: number }
      bugDensity: { bugCount90d: number; totalCount90d: number; ratio: number }
      blocked: { count: number }
      pipeline: Record<string, number>
      workload: { person: string; total: number }[]
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

/* -- Helpers ------------------------------------------------------- */

function stageColor(count: number | undefined): string {
  if (count === undefined) return "var(--muted-foreground)"
  if (count <= 5) return "var(--success)"
  if (count <= 10) return "var(--warning)"
  return "var(--error)"
}

function stageBgColor(count: number | undefined): string {
  if (count === undefined) return "var(--muted)"
  if (count <= 5) return "var(--success-muted)"
  if (count <= 10) return "var(--warning-muted)"
  return "var(--error-muted)"
}

function stageBorderColor(count: number | undefined): string {
  if (count === undefined) return "var(--border)"
  if (count <= 5) return "var(--border)"
  if (count <= 10) return "var(--border)"
  return "var(--border)"
}

/* -- Stage tooltip descriptions ------------------------------------ */

const stageDescriptions: Record<string, string> = {
  "Open":            "New task queued for sprint planning. Owner: Product Owner.",
  "To Do":           "New task queued for sprint planning. Owner: Product Owner.",
  "Backlog":         "Groomed but not yet scheduled. Will be pulled into a sprint.",
  "In Progress":     "Developer actively working on this task.",
  "Code Review":     "Pull request submitted. Peer reviewing code. SLA: 3 days.",
  "In Review":       "Product/design review of completed work.",
  "QA":              "Quality assurance testing. SLA: 2 days.",
  "QA in Testing":   "Quality assurance testing. SLA: 2 days.",
  "Ready to Stage":  "Passed QA, waiting for deployment to staging. SLA: 1 day.",
  "Staging":         "Passed QA, waiting for deployment to staging. SLA: 1 day.",
  "RC":              "Released to production.",
  "Done":            "Released to production.",
  "Closed":          "Released to production.",
  "Design":          "UI/UX design phase (FS team only).",
  "Queued":          "Combined: Reopened + Hold + Backlog items waiting for attention.",
  // Media buying stages
  "Hypothesis":      "Campaign hypothesis formed. Testing thesis defined.",
  "Creative":        "Ad creative in production.",
  "Account Setup":   "Ad accounts and pixels being configured.",
  "Launch":          "Campaign going live.",
  "Monitor":         "Campaign live and being monitored.",
  "Optimize/Kill":   "Decision point: scale up or kill.",
  // Analytics stages
  "Request":         "Report request received from stakeholder.",
  "Queue":           "Report queued for analyst.",
  "Analysis":        "Analyst actively working on report.",
  "Review":          "Report under peer/stakeholder review.",
  "Delivery":        "Report delivered to requester.",
  // Infra stages
  "Planned":         "Task planned for upcoming sprint.",
}

/* -- Status Dot ---------------------------------------------------- */

function StatusDot({ count }: { count: number | undefined }) {
  if (count === undefined) return null
  const color = count <= 5 ? "var(--success)" : count <= 10 ? "var(--warning)" : "var(--error)"
  return (
    <span
      className="inline-block w-[6px] h-[6px] rounded-full shrink-0"
      style={{ backgroundColor: color }}
    />
  )
}

/* -- Build sections with live data --------------------------------- */

function buildSections(engData: EngineeringApiData | null): ProcessSection[] {
  // ASD pipeline from live data or fallback
  const asdPipeline = engData?.teams?.ASD?.pipeline

  // Group minor ASD statuses into a single "Queued" bucket
  const MINOR_STATUSES = ['Reopened', 'Hold', 'Backlog']
  const groupedAsdPipeline: Record<string, number> | undefined = asdPipeline
    ? (() => {
        const grouped: Record<string, number> = {}
        for (const [status, count] of Object.entries(asdPipeline)) {
          if (MINOR_STATUSES.includes(status)) {
            grouped['Queued'] = (grouped['Queued'] ?? 0) + count
          } else {
            grouped[status] = count
          }
        }
        return grouped
      })()
    : undefined

  const asdPipelineStages: PipelineStage[] = groupedAsdPipeline
    ? Object.entries(groupedAsdPipeline).map(([name, count]) => ({ name, count }))
    : [
        { name: "Open", count: undefined },
        { name: "In Progress", count: undefined },
        { name: "Code Review", count: undefined },
        { name: "QA", count: undefined },
        { name: "Ready to Stage", count: undefined },
        { name: "Done" },
      ]

  // FS pipeline from live data or fallback
  const fsPipeline = engData?.teams?.FS?.pipeline
  const fsPipelineStages: PipelineStage[] = fsPipeline
    ? Object.entries(fsPipeline).map(([name, count]) => ({ name, count }))
    : [
        { name: "To Do", count: undefined },
        { name: "Design", count: undefined },
        { name: "In Progress", count: undefined },
        { name: "Code Review", count: undefined },
        { name: "QA", count: undefined },
        { name: "Staging", count: undefined },
        { name: "Closed" },
      ]

  // Engineering KPIs from live data
  const asdVel = engData?.teams?.ASD?.sprint?.velocity
  const fsVel = engData?.teams?.FS?.sprint?.velocity
  const asdBugPct = engData ? Math.round(engData.teams.ASD.bugDensity.ratio) : null
  const fsBugPct = engData ? Math.round(engData.teams.FS.bugDensity.ratio) : null
  const blockedCount = engData?.summary?.totalBlocked

  const engKpis: KPI[] = [
    {
      label: "Sprint Velocity ASD",
      value: asdVel != null ? `${asdVel}%` : "—",
      status: asdVel != null ? (asdVel >= 80 ? "ok" : asdVel >= 65 ? "watch" : "stop") : "neutral",
    },
    {
      label: "Sprint Velocity FS",
      value: fsVel != null ? `${fsVel}%` : "—",
      status: fsVel != null ? (fsVel >= 80 ? "ok" : fsVel >= 65 ? "watch" : "stop") : "neutral",
    },
    {
      label: "Bug Density ASD",
      value: asdBugPct != null ? `${asdBugPct}%` : "—",
      status: asdBugPct != null ? (asdBugPct > 50 ? "stop" : asdBugPct > 35 ? "watch" : "ok") : "neutral",
    },
    {
      label: "Bug Density FS",
      value: fsBugPct != null ? `${fsBugPct}%` : "—",
      status: fsBugPct != null ? (fsBugPct > 50 ? "stop" : fsBugPct > 35 ? "watch" : "ok") : "neutral",
    },
    {
      label: "Blocked Items",
      value: blockedCount != null ? `${blockedCount}` : "—",
      status: blockedCount != null ? (blockedCount > 5 ? "stop" : blockedCount > 0 ? "watch" : "ok") : "neutral",
    },
  ]

  return [
    {
      department: "Media Buying",
      pipelines: [
        {
          stages: [
            { name: "Hypothesis" },
            { name: "Creative" },
            { name: "Account Setup" },
            { name: "Launch" },
            { name: "Monitor" },
            { name: "Optimize/Kill" },
          ],
        },
      ],
      kpis: [
        { label: "Overall ROI", value: "10%", status: "watch" },
        { label: "Monthly Profit", value: "$309K", status: "ok" },
        { label: "STOP Campaigns", value: "3", status: "stop" },
        { label: "Avg CPA", value: "by geo", status: "neutral" },
      ],
    },
    {
      department: "Product & Engineering",
      pipelines: [
        { label: "ASD Pipeline", stages: asdPipelineStages },
        { label: "FS Pipeline", stages: fsPipelineStages },
      ],
      kpis: engKpis,
    },
    {
      department: "Analytics",
      pipelines: [
        {
          stages: [
            { name: "Request" },
            { name: "Queue" },
            { name: "Analysis" },
            { name: "Review" },
            { name: "Delivery" },
          ],
        },
      ],
      kpis: [
        { label: "Report Turnaround", value: "weeks", status: "stop" },
        { label: "Data Freshness", value: "15 min", status: "ok" },
        { label: "Self-Serve Coverage", value: "~60%", status: "watch" },
      ],
    },
  ]
}

function buildInsights(engData: EngineeringApiData | null): Insight[] {
  const insights: Insight[] = []

  if (engData) {
    const asdVel = engData.teams.ASD.sprint.velocity
    const fsBugPct = Math.round(engData.teams.FS.bugDensity.ratio)
    const fsVel = engData.teams.FS.sprint.velocity
    const zombies = engData.summary.zombieEpicCount

    if (asdVel < 70) {
      insights.push({
        type: "warning",
        text: `ASD sprint velocity at ${asdVel}%. ${engData.summary.totalBlocked} items blocked.`,
      })
    }
    if (fsBugPct > 50) {
      insights.push({
        type: "warning",
        text: `FS bug density at ${fsBugPct}% -- over half of sprint capacity consumed by bug-fixing.`,
      })
    }
    if (fsVel >= 80) {
      insights.push({
        type: "success",
        text: `FS sprint velocity stable at ${fsVel}%. Data pipeline freshness at 15 min.`,
      })
    }
    if (zombies > 0) {
      insights.push({
        type: "info",
        text: `${zombies} zombie epics that have never been decomposed into actionable tasks.`,
      })
    }
  } else {
    // Fallback static insights when API hasn't loaded yet
    insights.push({ type: "warning", text: "Engineering data loading..." })
  }

  insights.push({
    type: "warning",
    text: "Analytics report turnaround measured in weeks. Self-serve coverage only ~60%.",
  })

  return insights
}

/* -- Pipeline Visualization ---------------------------------------- */

function Pipeline({ stages, label }: { stages: PipelineStage[]; label?: string }) {
  return (
    <div className="space-y-2">
      {label && <p className="text-[12px] font-medium text-[var(--muted-foreground)]">{label}</p>}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin min-w-fit">
        {stages.map((stage, i) => {
          const isBottleneck = (stage.count ?? 0) > 10
          const tooltip = stageDescriptions[stage.name] || stage.name
          return (
            <div key={stage.name} className="flex items-center shrink-0">
              <div
                className="flex flex-col items-center justify-center rounded-lg px-3 py-2.5 min-w-[90px] border"
                title={tooltip}
                style={{
                  backgroundColor: isBottleneck ? "var(--error-muted)" : stageBgColor(stage.count),
                  borderColor: stageBorderColor(stage.count),
                  transition: "background 0.5s ease",
                  animation: isBottleneck ? "bottleneck-pulse 3s ease-in-out infinite" : undefined,
                }}
              >
                <div className="flex items-center gap-1">
                  <StatusDot count={stage.count} />
                  <span className="text-[11px] font-medium text-[var(--secondary-foreground)] text-center leading-tight whitespace-nowrap">
                    {stage.name}
                  </span>
                </div>
                {stage.count !== undefined && (
                  <span
                    className="text-[14px] font-bold mt-0.5"
                    style={{ color: stageColor(stage.count) }}
                  >
                    {stage.count}
                  </span>
                )}
              </div>
              {i < stages.length - 1 && (
                <span className="text-[var(--muted-foreground)] text-[16px] mx-0.5 shrink-0">&rarr;</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* -- Section Card -------------------------------------------------- */

function SectionCard({ section }: { section: ProcessSection }) {
  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <h3 className="text-[15px] font-semibold text-[var(--foreground)]">{section.department}</h3>

        {/* Pipelines */}
        <div className="space-y-4">
          {section.pipelines.map((p, i) => (
            <Pipeline key={i} stages={p.stages} label={p.label} />
          ))}
        </div>

        {/* KPI Scorecard */}
        <div className="border-t border-[var(--border)] pt-4">
          <p className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] mb-3">KPIs</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {section.kpis.map((kpi) => (
              <ScoreBox
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                status={kpi.status}
                sub={kpi.sub}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* -- Infrastructure Section ---------------------------------------- */

function InfrastructureSection({ data }: { data: InfraData | null }) {
  const tasks = data?.tasks ?? []
  const services = data?.services ?? []

  const statusMap: Record<string, string> = {
    backlog: "Backlog",
    planned: "Planned",
    in_progress: "In Progress",
    "In Progress": "In Progress",
    done: "Done",
    Done: "Done",
    Backlog: "Backlog",
    Planned: "Planned",
  }

  const normalize = (s: string) => statusMap[s] ?? s

  const backlogCount = tasks.filter((t) => normalize(t.status) === "Backlog").length
  const plannedCount = tasks.filter((t) => normalize(t.status) === "Planned").length
  const inProgressCount = tasks.filter((t) => normalize(t.status) === "In Progress").length
  const doneCount = tasks.filter((t) => normalize(t.status) === "Done").length
  const totalTasks = tasks.length
  const completionRate = totalTasks > 0 ? ((doneCount / totalTasks) * 100).toFixed(1) : "0"
  const overdueServices = services.filter((s) => s.daysLeft < 0).length

  const pipelineStages: PipelineStage[] = [
    { name: "Backlog", count: backlogCount },
    { name: "Planned", count: plannedCount },
    { name: "In Progress", count: inProgressCount },
    { name: "Done", count: doneCount },
  ]

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <h3 className="text-[15px] font-semibold text-[var(--foreground)]">Infrastructure Processes</h3>

        {/* Pipeline */}
        <Pipeline stages={pipelineStages} />

        {/* KPIs */}
        <div className="border-t border-[var(--border)] pt-4">
          <p className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] mb-3">KPIs</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <ScoreBox label="Total Tasks" value={totalTasks} status="neutral" />
            <ScoreBox label="In Progress" value={inProgressCount} status={inProgressCount > 0 ? "ok" : "neutral"} />
            <ScoreBox
              label="Completion Rate"
              value={`${completionRate}%`}
              status={Number(completionRate) >= 70 ? "ok" : Number(completionRate) >= 40 ? "watch" : "stop"}
            />
            <ScoreBox
              label="Overdue Services"
              value={overdueServices}
              status={overdueServices > 0 ? "stop" : "ok"}
            />
          </div>
        </div>

        {/* Service Cost Table */}
        {services.length > 0 && (
          <div className="border-t border-[var(--border)] pt-4">
            <p className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] mb-3">Service Costs</p>
            <Table>
              <TableHeader>
                <TableRow className="border-b-[var(--border)] hover:bg-transparent">
                  <TableHead className="text-[var(--muted-foreground)] text-[12px] font-semibold pl-4">Name</TableHead>
                  <TableHead className="text-[var(--muted-foreground)] text-[12px] font-semibold">Cost</TableHead>
                  <TableHead className="text-[var(--muted-foreground)] text-[12px] font-semibold">Billing Cycle</TableHead>
                  <TableHead className="text-[var(--muted-foreground)] text-[12px] font-semibold">Days Left</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((svc) => (
                  <TableRow
                    key={svc.name}
                    className="border-b-[var(--border)] hover:bg-[var(--muted)]"
                  >
                    <TableCell className="pl-4 text-[13px] font-medium text-[var(--foreground)]">
                      {svc.name}
                    </TableCell>
                    <TableCell className="text-[13px] text-[var(--muted-foreground)]">
                      ${svc.cost.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-[13px] text-[var(--muted-foreground)] capitalize">
                      {svc.billingCycle}
                    </TableCell>
                    <TableCell
                      className={`text-[13px] font-medium ${
                        svc.daysLeft < 0
                          ? "text-[var(--error)]"
                          : svc.daysLeft <= 7
                          ? "text-[var(--warning)]"
                          : "text-[var(--muted-foreground)]"
                      }`}
                    >
                      {svc.daysLeft < 0 ? `${svc.daysLeft}d (overdue)` : `${svc.daysLeft}d`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* -- People Data Types ---------------------------------------------- */

interface PersonRecord {
  name: string
  department: string
  team: string
  position: string
  email: string
}

interface PeopleApiData {
  people: PersonRecord[]
  summary: {
    total: number
    byDepartment: Record<string, number>
    byTeam: Record<string, number>
  }
  teams: { name: string; memberCount: number }[]
}

/* -- Chart color palette ------------------------------------------- */

const chartColors = [
  "var(--chart-1, oklch(0.65 0.18 250))",
  "var(--chart-2, oklch(0.65 0.18 155))",
  "var(--chart-3, oklch(0.65 0.18 30))",
  "var(--chart-4, oklch(0.65 0.18 320))",
  "var(--chart-5, oklch(0.65 0.18 60))",
]

/* -- People & Organization Section --------------------------------- */

function PeopleSection({ data }: { data: PeopleApiData | null }) {
  if (!data) {
    return (
      <Card>
        <CardContent className="p-6">
          <h3 className="text-[15px] font-semibold text-[var(--foreground)]">People & Organization</h3>
          <Skeleton className="h-24 w-full mt-4" />
        </CardContent>
      </Card>
    )
  }

  const { summary, teams } = data
  const departments = Object.entries(summary.byDepartment).sort((a, b) => b[1] - a[1])
  const maxDeptCount = departments.length > 0 ? departments[0][1] : 1
  const totalPeople = summary.total

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--muted-foreground)]" />
          <h3 className="text-[15px] font-semibold text-[var(--foreground)]">People & Organization</h3>
        </div>

        {/* Total Headcount — large prominent number */}
        <div className="flex items-baseline gap-3">
          <span className="text-[2.5rem] font-bold tabular-nums text-[var(--foreground)] leading-none">
            {totalPeople}
          </span>
          <span className="text-[13px] text-[var(--muted-foreground)]">total headcount</span>
        </div>

        {/* Proportional stacked bar */}
        {departments.length > 0 && (
          <div>
            <div className="flex h-3 rounded-full overflow-hidden">
              {departments.map(([dept, count], index) => (
                <div
                  key={dept}
                  style={{
                    width: `${(count / totalPeople) * 100}%`,
                    background: chartColors[index % chartColors.length],
                  }}
                  title={`${dept}: ${count}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {departments.map(([dept, count], index) => (
                <div key={dept} className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ background: chartColors[index % chartColors.length] }}
                  />
                  <span className="text-[11px] text-[var(--muted-foreground)]">{dept} ({count})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <ScoreBox label="Total People" value={summary.total} status="neutral" />
          <ScoreBox label="Departments" value={departments.length} status="neutral" />
          <ScoreBox label="Teams" value={teams.length} status="neutral" />
          <ScoreBox
            label="Avg Team Size"
            value={teams.length > 0 ? (summary.total / teams.length).toFixed(1) : "0"}
            status="neutral"
          />
        </div>

        {/* Department Breakdown */}
        <div className="border-t border-[var(--border)] pt-4">
          <p className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
            Department Breakdown
          </p>
          <div className="space-y-2">
            {departments.map(([dept, count]) => (
              <div key={dept} className="flex items-center gap-3">
                <span className="text-[13px] text-[var(--foreground)] font-medium w-[160px] shrink-0 truncate">
                  {dept}
                </span>
                <div className="flex-1 h-[22px] bg-[var(--muted)] rounded-md overflow-hidden">
                  <div
                    className="h-full rounded-md bg-[var(--accent)] transition-all duration-500"
                    style={{
                      width: `${Math.max((count / maxDeptCount) * 100, 4)}%`,
                      opacity: 0.7 + (count / maxDeptCount) * 0.3,
                    }}
                  />
                </div>
                <span className="text-[13px] font-semibold text-[var(--foreground)] w-[36px] text-right shrink-0">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Teams */}
        {teams.length > 0 && (
          <div className="border-t border-[var(--border)] pt-4">
            <p className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
              Teams
            </p>
            <div className="flex flex-wrap gap-2">
              {teams
                .filter((t) => t.name)
                .sort((a, b) => b.memberCount - a.memberCount)
                .map((team) => (
                  <span
                    key={team.name}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-[var(--input)] bg-[var(--muted)] text-[var(--foreground)]"
                  >
                    {team.name}
                    <span className="text-[var(--muted-foreground)]">({team.memberCount})</span>
                  </span>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* -- SLA Compliance Section ----------------------------------------- */

const SLA_HOURS: Record<string, number> = {
  "Open": 24,
  "Backlog": 168,       // 1 week
  "In Progress": 336,   // 2 weeks
  "Code Review": 72,    // 3 days
  "QA": 48,             // 2 days
  "Ready to Stage": 24,
}

function slaStatusFromCount(count: number): "ok" | "watch" | "stop" {
  if (count <= 5) return "ok"
  if (count <= 10) return "watch"
  return "stop"
}

function slaStatusColor(status: "ok" | "watch" | "stop"): string {
  if (status === "ok") return "var(--success)"
  if (status === "watch") return "var(--warning)"
  return "var(--error)"
}

function slaBgColor(status: "ok" | "watch" | "stop"): string {
  if (status === "ok") return "var(--success-muted)"
  if (status === "watch") return "var(--warning-muted)"
  return "var(--error-muted)"
}

function slaBorderColor(status: "ok" | "watch" | "stop"): string {
  if (status === "ok") return "var(--border)"
  if (status === "watch") return "var(--border)"
  return "var(--border)"
}

function formatSlaHours(hours: number): string {
  if (hours < 24) return `${hours}h`
  const days = hours / 24
  if (days === 7) return "1 week"
  if (days === 14) return "2 weeks"
  return `${days}d`
}

function SlaComplianceSection({ engData }: { engData: EngineeringApiData | null }) {
  // Merge both team pipelines to get combined counts per stage
  const asdPipeline = engData?.teams?.ASD?.pipeline ?? {}
  const fsPipeline = engData?.teams?.FS?.pipeline ?? {}

  // Build SLA entries only for stages that have defined SLA targets
  const slaEntries = Object.entries(SLA_HOURS).map(([stage, targetHours]) => {
    const asdCount = asdPipeline[stage] ?? 0
    const fsCount = fsPipeline[stage] ?? 0
    const totalCount = asdCount + fsCount
    const status = slaStatusFromCount(totalCount)
    return { stage, targetHours, count: totalCount, status }
  })

  // Overall compliance: % of stages that are "ok"
  const okCount = slaEntries.filter((e) => e.status === "ok").length
  const complianceRate = slaEntries.length > 0 ? Math.round((okCount / slaEntries.length) * 100) : 0
  const complianceStatus: "ok" | "watch" | "stop" =
    complianceRate >= 80 ? "ok" : complianceRate >= 50 ? "watch" : "stop"

  if (!engData) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-4 w-4 text-[var(--muted-foreground)]" />
            <h3 className="text-[15px] font-semibold text-[var(--foreground)]">SLA Compliance</h3>
          </div>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--muted-foreground)]" />
            <h3 className="text-[15px] font-semibold text-[var(--foreground)]">SLA Compliance</h3>
          </div>
          {/* Prominent compliance percentage */}
          <div className="flex items-baseline gap-2">
            <span
              className="text-[2rem] font-bold tabular-nums leading-none"
              style={{
                color: complianceRate > 80
                  ? "var(--success)"
                  : complianceRate >= 50
                    ? "var(--warning)"
                    : "var(--error)",
              }}
            >
              {complianceRate}%
            </span>
            <span className="text-[11px] text-[var(--muted-foreground)]">SLA Compliance</span>
          </div>
        </div>

        <p className="text-[11px] text-[var(--muted-foreground)]">
          Item counts per pipeline stage across ASD + FS teams. High item counts signal potential SLA breaches.
        </p>

        {/* SLA cards row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {slaEntries.map((entry) => (
            <div
              key={entry.stage}
              className="flex flex-col items-center justify-center rounded-lg px-3 py-3 border"
              title={stageDescriptions[entry.stage] || entry.stage}
              style={{
                backgroundColor: slaBgColor(entry.status),
                borderColor: slaBorderColor(entry.status),
              }}
            >
              <span className="text-[11px] font-medium text-[var(--secondary-foreground)] text-center leading-tight whitespace-nowrap">
                {entry.stage}
              </span>
              <span
                className="text-[18px] font-bold mt-1"
                style={{ color: slaStatusColor(entry.status) }}
              >
                {entry.count}
              </span>
              <span className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                SLA: {formatSlaHours(entry.targetHours)}
              </span>
              <span className="text-[9px] text-[var(--muted-foreground)] mt-0.5 italic">
                measuring...
              </span>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 pt-2">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--success)]" />
            <span className="text-[11px] text-[var(--muted-foreground)]">0-5 items</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--warning)]" />
            <span className="text-[11px] text-[var(--muted-foreground)]">6-10 items</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--error)]" />
            <span className="text-[11px] text-[var(--muted-foreground)]">&gt;10 items</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* -- Department Flow Narrative ------------------------------------- */

function DepartmentFlowNarrative() {
  return (
    <div className="flex items-center gap-3 text-[13px] text-[var(--muted-foreground)] mb-8 flex-wrap">
      <span className="font-semibold text-[var(--foreground)]">Media Buying</span>
      <span>runs campaigns &rarr;</span>
      <span className="font-semibold text-[var(--foreground)]">Engineering</span>
      <span>builds tools &rarr;</span>
      <span className="font-semibold text-[var(--foreground)]">Analytics</span>
      <span>measures impact &rarr;</span>
      <span>cycle repeats</span>
    </div>
  )
}

/* -- Main Export ---------------------------------------------------- */

export function ProcessesPage() {
  const { t } = useI18n()
  const [infraData, setInfraData] = useState<InfraData | null>(null)
  const [engData, setEngData] = useState<EngineeringApiData | null>(null)
  const [engLoading, setEngLoading] = useState(true)
  const [peopleData, setPeopleData] = useState<PeopleApiData | null>(null)

  useEffect(() => {
    fetch("/api/mcc/airtable/infra")
      .then((r) => r.json())
      .then(setInfraData)
      .catch(() => {})

    fetch("/api/mcc/jira/engineering")
      .then((r) => r.json())
      .then((d: EngineeringApiData) => {
        setEngData(d)
        setEngLoading(false)
      })
      .catch(() => {
        setEngLoading(false)
      })

    fetch("/api/mcc/airtable/people")
      .then((r) => r.json())
      .then(setPeopleData)
      .catch(() => {})
  }, [])

  const sections = buildSections(engData)
  const insights = buildInsights(engData)

  return (
    <>
      <PageHeader
        title={t("proc.title")}
        subtitle={t("proc.subtitle")}
      />

      <InsightsCard insights={insights} className="mb-8" />

      {/* Department connection narrative */}
      <DepartmentFlowNarrative />

      <div className="space-y-6">
        {sections.map((s) => (
          <SectionCard key={s.department} section={s} />
        ))}
        <SlaComplianceSection engData={engData} />
        <InfrastructureSection data={infraData} />
        <PeopleSection data={peopleData} />
      </div>

      {/* Bottleneck pulse animation */}
      <style>{`
        @keyframes bottleneck-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.88; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="bottleneck-pulse"] {
            animation: none !important;
          }
        }
      `}</style>
    </>
  )
}
