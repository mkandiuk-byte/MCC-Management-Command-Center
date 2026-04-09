"use client"

import { useEffect, useState, useCallback } from "react"
import { PageHeader } from "@/components/mcc/page-header"
import { ScoreBox } from "@/components/mcc/score-box"
import { InsightsCard, type Insight } from "@/components/mcc/insights-card"
import { StatusDot } from "@/components/mcc/status-dot"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { useI18n } from "@/lib/mcc-i18n"

/* -- API Types ----------------------------------------------------- */

interface SprintData {
  name: string
  startDate: string
  endDate: string
  totalIssues: number
  doneIssues: number
  velocity: number
  activeItems: number
}

interface VelocityHistoryPoint {
  sprintName: string
  velocity: number
  done: number
  total: number
}

interface BugDensityData {
  bugCount90d: number
  totalCount90d: number
  ratio: number
}

interface BlockedData {
  count: number
  items: { key: string; summary: string; assignee: string; daysSinceCreated: number }[]
}

interface WorkloadEntry {
  person: string
  inProgress: number
  codeReview: number
  qa: number
  total: number
}

interface EpicData {
  key: string
  summary: string
  project: string
  done: number
  total: number
  progressPct: number
  isZombie: boolean
}

interface TeamData {
  sprint: SprintData
  velocityHistory: VelocityHistoryPoint[]
  bugDensity: BugDensityData
  blocked: BlockedData
  workload: WorkloadEntry[]
  pipeline: Record<string, number>
  epics: EpicData[]
}

interface EngineeringApiResponse {
  teams: {
    ASD: TeamData
    FS: TeamData
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

function workloadColor(total: number): "green" | "yellow" | "red" {
  if (total <= 3) return "green"
  if (total <= 6) return "yellow"
  return "red"
}

function progressColor(pct: number): string {
  if (pct >= 75) return "#52C67E"
  if (pct >= 25) return "#F5A623"
  return "#F55D4C"
}

function minutesAgo(isoDate: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(isoDate).getTime()) / 60000))
}

/* -- Custom Tooltip ------------------------------------------------ */

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#12151C] px-3 py-2 shadow-lg">
      <p className="text-[11px] text-[#6B7A94] mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-[12px] font-medium" style={{ color: entry.color }}>
          {entry.name}: {entry.value}%
        </p>
      ))}
    </div>
  )
}

function BugChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#12151C] px-3 py-2 shadow-lg">
      <p className="text-[11px] text-[#6B7A94] mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-[12px] font-medium" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  )
}

/* -- Loading Skeleton ---------------------------------------------- */

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[120px] w-full rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Skeleton className="h-[200px] rounded-xl" />
        <Skeleton className="h-[200px] rounded-xl" />
      </div>
      <Skeleton className="h-[300px] rounded-xl" />
    </div>
  )
}

/* -- Sprint Tab ---------------------------------------------------- */

function SprintTab({ data }: { data: EngineeringApiResponse }) {
  const { t } = useI18n()
  const asd = data.teams.ASD
  const fs = data.teams.FS

  const insights: Insight[] = []

  if (asd.sprint.velocity < 70) {
    insights.push({
      type: "warning",
      text: `ASD velocity dropped to ${asd.sprint.velocity}%. Investigate sprint planning or scope creep.`,
    })
  }
  if (asd.blocked.count > 0) {
    insights.push({
      type: "warning",
      text: `${asd.blocked.count} items blocked in ASD.${asd.blocked.items.length > 0 ? ` Top: ${asd.blocked.items[0].assignee} (${asd.blocked.items[0].key}).` : ""}`,
    })
  }
  if (fs.sprint.velocity >= 80) {
    insights.push({
      type: "success",
      text: `FS velocity steady at ${fs.sprint.velocity}%, tracking well.`,
    })
  }

  // Build velocity chart data from both teams
  const maxLen = Math.max(asd.velocityHistory.length, fs.velocityHistory.length)
  const velocityChartData = Array.from({ length: maxLen }, (_, i) => ({
    sprint: asd.velocityHistory[i]?.sprintName ?? fs.velocityHistory[i]?.sprintName ?? `S-${maxLen - i}`,
    ASD: asd.velocityHistory[i]?.velocity ?? 0,
    FS: fs.velocityHistory[i]?.velocity ?? 0,
  }))

  const sprintCards = [
    { project: "ASD", sprint: asd.sprint, bugDensity: asd.bugDensity, blocked: asd.blocked },
    { project: "FS", sprint: fs.sprint, bugDensity: fs.bugDensity, blocked: fs.blocked },
  ]

  return (
    <div className="space-y-6">
      {insights.length > 0 && <InsightsCard insights={insights} />}

      {/* Sprint Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {sprintCards.map((s) => {
          const vel = s.sprint.velocity
          const bugPct = Math.round(s.bugDensity.ratio * 100)
          return (
            <Card key={s.project}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-[#6B7A94] uppercase tracking-wider">{s.project}</p>
                    <p className="text-[15px] font-semibold text-[#E8EFFF] mt-0.5">{s.sprint.name}</p>
                  </div>
                  <ScoreBox
                    label={t("eng.velocity")}
                    value={`${vel}%`}
                    sub={`${s.sprint.doneIssues}/${s.sprint.totalIssues} done`}
                    status={vel >= 80 ? "ok" : vel >= 65 ? "watch" : "stop"}
                  />
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] text-[#6B7A94]">{t("eng.sprintProgress")}</span>
                    <span className="text-[12px] font-medium text-[#E8EFFF]">{vel}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${vel}%`,
                        backgroundColor: vel >= 80 ? "#52C67E" : vel >= 65 ? "#F5A623" : "#F55D4C",
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-2 border-t border-[rgba(255,255,255,0.06)]">
                  <ScoreBox label={t("eng.activeItems")} value={s.sprint.activeItems} />
                  <ScoreBox
                    label={t("eng.bugDensity")}
                    value={`${bugPct}%`}
                    status={bugPct > 50 ? "stop" : bugPct > 35 ? "watch" : "ok"}
                  />
                  <ScoreBox
                    label={t("eng.blocked")}
                    value={s.blocked.count}
                    status={s.blocked.count > 5 ? "stop" : s.blocked.count > 0 ? "watch" : "ok"}
                  />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Velocity Chart */}
      <Card>
        <CardContent className="p-5">
          <p className="text-[13px] font-semibold text-[#E8EFFF] mb-4">{t("eng.velocityTrend")}</p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={velocityChartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="sprint" tick={{ fill: "#6B7A94", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "#6B7A94", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: "#6B7A94" }}
                  iconType="circle"
                  iconSize={8}
                />
                <Bar dataKey="ASD" fill="#4C8BF5" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="FS" fill="#A87EF5" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* -- Teams Tab ----------------------------------------------------- */

function WorkloadBar({ total, max = 10 }: { total: number; max?: number }) {
  const pct = Math.min((total / max) * 100, 100)
  const color = workloadColor(total)
  const bg = color === "green" ? "#52C67E" : color === "yellow" ? "#F5A623" : "#F55D4C"
  return (
    <div className="flex items-center gap-3 flex-1">
      <div className="flex-1 h-2 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: bg }} />
      </div>
      <span className="text-[12px] font-medium text-[#E8EFFF] w-6 text-right">{total}</span>
    </div>
  )
}

function TeamSection({ name, members }: { name: string; members: WorkloadEntry[] }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-[13px] font-semibold text-[#E8EFFF] mb-4">{name}</p>
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.person} className="flex items-center gap-3">
              <StatusDot status={workloadColor(m.total)} />
              <span className="text-[13px] text-[#C1CCDE] w-[180px] truncate">{m.person}</span>
              <WorkloadBar total={m.total} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function TeamsTab({ data }: { data: EngineeringApiResponse }) {
  const { t } = useI18n()
  const asdWorkload = data.teams.ASD.workload
  const fsWorkload = data.teams.FS.workload

  // Detect bottlenecks: anyone with total >= 7
  const allOverloaded = [
    ...asdWorkload.filter((w) => w.total >= 7).map((w) => ({ ...w, team: "ASD" })),
    ...fsWorkload.filter((w) => w.total >= 7).map((w) => ({ ...w, team: "FS" })),
  ]

  return (
    <div className="space-y-6">
      {/* Bottleneck callout */}
      {allOverloaded.length > 0 && (
        <Card className="border-l-[3px] border-l-[#F55D4C] bg-[rgba(245,93,76,0.04)]">
          <CardContent className="p-5">
            <p className="text-[13px] font-semibold text-[#F55D4C] mb-1">{t("eng.bottleneckDetected")}</p>
            <p className="text-[13px] text-[#C1CCDE]">
              {allOverloaded.map((w) => `${w.person}: ${w.total} items`).join(". ")}.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TeamSection name="ASD Team" members={asdWorkload} />
        <TeamSection name="FS Team" members={fsWorkload} />
      </div>
    </div>
  )
}

/* -- Bugs Tab ------------------------------------------------------ */

function BugsTab({ data }: { data: EngineeringApiResponse }) {
  const { t } = useI18n()
  const asdBugs = data.teams.ASD.bugDensity
  const fsBugs = data.teams.FS.bugDensity
  const asdPct = Math.round(asdBugs.ratio * 100)
  const fsPct = Math.round(fsBugs.ratio * 100)

  const insights: Insight[] = []
  if (fsPct > 50) {
    insights.push({
      type: "warning",
      text: `FS spends ${fsPct}% of capacity on bug-fixing, leaving minimal bandwidth for new features.`,
    })
  }
  if (asdPct > 35) {
    insights.push({
      type: "warning",
      text: `ASD bug density at ${asdPct}% -- nearly half of sprint capacity consumed by bugs.`,
    })
  }

  const bugChartData = [
    { project: "ASD", bugs: asdBugs.bugCount90d, features: asdBugs.totalCount90d - asdBugs.bugCount90d },
    { project: "FS", bugs: fsBugs.bugCount90d, features: fsBugs.totalCount90d - fsBugs.bugCount90d },
  ]

  return (
    <div className="space-y-6">
      {insights.length > 0 && <InsightsCard insights={insights} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <ScoreBox label={`ASD ${t("eng.bugDensity")}`} value={`${asdPct}%`} status={asdPct > 50 ? "stop" : asdPct > 35 ? "watch" : "ok"} sub={`${asdBugs.bugCount90d} bugs / 90d`} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox label={`FS ${t("eng.bugDensity")}`} value={`${fsPct}%`} status={fsPct > 50 ? "stop" : fsPct > 35 ? "watch" : "ok"} sub={`${fsBugs.bugCount90d} bugs / 90d`} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox label={`ASD ${t("eng.bugCount90d")}`} value={asdBugs.bugCount90d} status="watch" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox label={`FS ${t("eng.bugCount90d")}`} value={fsBugs.bugCount90d} status="watch" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <p className="text-[13px] font-semibold text-[#E8EFFF] mb-4">{t("eng.bugsVsFeatures")} (90 days)</p>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bugChartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="project" tick={{ fill: "#6B7A94", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6B7A94", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<BugChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#6B7A94" }} iconType="circle" iconSize={8} />
                <Bar dataKey="bugs" name={t("eng.bugs")} fill="#F55D4C" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="features" name="Features" fill="#4C8BF5" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* -- Epics Tab ----------------------------------------------------- */

function EpicsTab({ data }: { data: EngineeringApiResponse }) {
  const { t } = useI18n()
  const allEpics = [...(data.teams.ASD.epics ?? []), ...(data.teams.FS.epics ?? [])]
  const zombieCount = data.summary.zombieEpicCount

  return (
    <div className="space-y-6">
      {/* Zombie alert */}
      {zombieCount > 0 && (
        <Card className="border-l-[3px] border-l-[#F55D4C] bg-[rgba(245,93,76,0.04)]">
          <CardContent className="p-5">
            <p className="text-[13px] font-semibold text-[#F55D4C] mb-1">{t("eng.zombieEpics")}</p>
            <p className="text-[13px] text-[#C1CCDE]">
              {zombieCount} {t("eng.zombieDesc")}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {allEpics.map((e) => {
          const pct = e.progressPct ?? (e.total > 0 ? Math.round((e.done / e.total) * 100) : 0)
          return (
            <Card key={e.key}>
              <CardContent className="p-4 flex items-center gap-4">
                <span className="text-[11px] font-semibold text-[#6B7A94] uppercase w-8">{e.project}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#E8EFFF] truncate">
                    {e.summary}
                    {e.isZombie && (
                      <span className="ml-2 text-[11px] text-[#F55D4C] font-semibold">ZOMBIE</span>
                    )}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 h-2 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: progressColor(pct) }}
                      />
                    </div>
                    <span className="text-[12px] font-medium" style={{ color: progressColor(pct) }}>
                      {pct}%
                    </span>
                  </div>
                </div>
                <span className="text-[12px] text-[#6B7A94] whitespace-nowrap">
                  {e.done}/{e.total}
                </span>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/* -- Main Export ---------------------------------------------------- */

export function EngineeringPage() {
  const { t } = useI18n()
  const [data, setData] = useState<EngineeringApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchData = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch("/api/mcc/jira/engineering")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed")
        return r.json()
      })
      .then((d: EngineeringApiResponse) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const updatedLabel = data?.updatedAt
    ? `Last updated: ${minutesAgo(data.updatedAt)} min ago`
    : undefined

  return (
    <>
      <PageHeader
        title={t("eng.title")}
        subtitle={updatedLabel ?? t("eng.subtitle")}
        onRefresh={fetchData}
      />

      {loading ? (
        <LoadingSkeleton />
      ) : error || !data ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-[14px] text-[#6B7A94]">Failed to load engineering data. Please try again.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="sprint">
          <TabsList variant="line" className="mb-6">
            <TabsTrigger value="sprint">{t("eng.sprint")}</TabsTrigger>
            <TabsTrigger value="teams">{t("eng.teams")}</TabsTrigger>
            <TabsTrigger value="bugs">{t("eng.bugs")}</TabsTrigger>
            <TabsTrigger value="epics">{t("eng.epics")}</TabsTrigger>
          </TabsList>

          <TabsContent value="sprint">
            <SprintTab data={data} />
          </TabsContent>
          <TabsContent value="teams">
            <TeamsTab data={data} />
          </TabsContent>
          <TabsContent value="bugs">
            <BugsTab data={data} />
          </TabsContent>
          <TabsContent value="epics">
            <EpicsTab data={data} />
          </TabsContent>
        </Tabs>
      )}
    </>
  )
}
