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
import { Users } from "lucide-react"
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
  if (count === undefined) return "#6B7A94"
  if (count <= 5) return "#52C67E"
  if (count <= 10) return "#F5A623"
  return "#F55D4C"
}

function stageBgColor(count: number | undefined): string {
  if (count === undefined) return "rgba(107,122,148,0.08)"
  if (count <= 5) return "rgba(82,198,126,0.08)"
  if (count <= 10) return "rgba(245,166,35,0.08)"
  return "rgba(245,93,76,0.08)"
}

function stageBorderColor(count: number | undefined): string {
  if (count === undefined) return "rgba(107,122,148,0.2)"
  if (count <= 5) return "rgba(82,198,126,0.2)"
  if (count <= 10) return "rgba(245,166,35,0.2)"
  return "rgba(245,93,76,0.2)"
}

/* -- Build sections with live data --------------------------------- */

function buildSections(engData: EngineeringApiData | null): ProcessSection[] {
  // ASD pipeline from live data or fallback
  const asdPipeline = engData?.teams?.ASD?.pipeline
  const asdPipelineStages: PipelineStage[] = asdPipeline
    ? Object.entries(asdPipeline).map(([name, count]) => ({ name, count }))
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
  const asdBugPct = engData ? Math.round(engData.teams.ASD.bugDensity.ratio * 100) : null
  const fsBugPct = engData ? Math.round(engData.teams.FS.bugDensity.ratio * 100) : null
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
    const fsBugPct = Math.round(engData.teams.FS.bugDensity.ratio * 100)
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
      {label && <p className="text-[12px] font-medium text-[#6B7A94]">{label}</p>}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {stages.map((stage, i) => (
          <div key={stage.name} className="flex items-center shrink-0">
            <div
              className="flex flex-col items-center justify-center rounded-lg px-3 py-2.5 min-w-[90px] border"
              style={{
                backgroundColor: stageBgColor(stage.count),
                borderColor: stageBorderColor(stage.count),
              }}
            >
              <span className="text-[11px] font-medium text-[#C1CCDE] text-center leading-tight whitespace-nowrap">
                {stage.name}
              </span>
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
              <span className="text-[#3A4255] text-[16px] mx-0.5 shrink-0">&rarr;</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* -- Section Card -------------------------------------------------- */

function SectionCard({ section }: { section: ProcessSection }) {
  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <h3 className="text-[15px] font-semibold text-[#E8EFFF]">{section.department}</h3>

        {/* Pipelines */}
        <div className="space-y-4">
          {section.pipelines.map((p, i) => (
            <Pipeline key={i} stages={p.stages} label={p.label} />
          ))}
        </div>

        {/* KPI Scorecard */}
        <div className="border-t border-[rgba(255,255,255,0.06)] pt-4">
          <p className="text-[11px] uppercase tracking-wider text-[#6B7A94] mb-3">KPIs</p>
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
        <div className="border-t border-[rgba(255,255,255,0.06)] pt-4">
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
          <div className="border-t border-[rgba(255,255,255,0.06)] pt-4">
            <p className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] mb-3">Service Costs</p>
            <Table>
              <TableHeader>
                <TableRow className="border-b-[rgba(255,255,255,0.06)] hover:bg-transparent">
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
                    className="border-b-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]"
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

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--muted-foreground)]" />
          <h3 className="text-[15px] font-semibold text-[var(--foreground)]">People & Organization</h3>
        </div>

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
        <div className="border-t border-[rgba(255,255,255,0.06)] pt-4">
          <p className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
            Department Breakdown
          </p>
          <div className="space-y-2">
            {departments.map(([dept, count]) => (
              <div key={dept} className="flex items-center gap-3">
                <span className="text-[13px] text-[var(--foreground)] font-medium w-[160px] shrink-0 truncate">
                  {dept}
                </span>
                <div className="flex-1 h-[22px] bg-[rgba(255,255,255,0.04)] rounded-md overflow-hidden">
                  <div
                    className="h-full rounded-md bg-[#4C8BF5] transition-all duration-500"
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
          <div className="border-t border-[rgba(255,255,255,0.06)] pt-4">
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[var(--foreground)]"
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

      <div className="space-y-6">
        {sections.map((s) => (
          <SectionCard key={s.department} section={s} />
        ))}
        <InfrastructureSection data={infraData} />
        <PeopleSection data={peopleData} />
      </div>
    </>
  )
}
