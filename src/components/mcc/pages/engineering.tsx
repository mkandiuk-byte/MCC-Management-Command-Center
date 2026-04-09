"use client"

import { useState } from "react"
import { PageHeader } from "@/components/mcc/page-header"
import { ScoreBox } from "@/components/mcc/score-box"
import { InsightsCard, type Insight } from "@/components/mcc/insights-card"
import { StatusDot } from "@/components/mcc/status-dot"
import { Card, CardContent } from "@/components/ui/card"
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

/* -- Types --------------------------------------------------------- */

interface SprintInfo {
  name: string
  project: string
  velocity: number
  avgVelocity: number
  activeItems: number
  bugDensity: number
  blocked: number
  cycleTimeMedian: number
}

interface TeamMember {
  name: string
  items: number
}

interface EpicInfo {
  name: string
  project: string
  done: number
  total: number
  zombie?: boolean
}

interface VelocityPoint {
  sprint: string
  ASD: number
  FS: number
}

/* -- Hardcoded Data ------------------------------------------------ */

const sprints: SprintInfo[] = [
  {
    name: "MB AP 20",
    project: "ASD",
    velocity: 61,
    avgVelocity: 87,
    activeItems: 106,
    bugDensity: 44,
    blocked: 12,
    cycleTimeMedian: 13,
  },
  {
    name: "MB FS 05",
    project: "FS",
    velocity: 88,
    avgVelocity: 91,
    activeItems: 95,
    bugDensity: 53,
    blocked: 0,
    cycleTimeMedian: 9,
  },
]

const velocityHistory: VelocityPoint[] = [
  { sprint: "S-4", ASD: 88, FS: 88 },
  { sprint: "S-3", ASD: 83, FS: 89 },
  { sprint: "S-2", ASD: 92, FS: 96 },
  { sprint: "S-1", ASD: 85, FS: 94 },
  { sprint: "Current", ASD: 61, FS: 88 },
]

const asdTeam: TeamMember[] = [
  { name: "Oleh Litvin", items: 10 },
  { name: "Tymofii Konopatov", items: 10 },
  { name: "Oleg Petrov", items: 5 },
  { name: "Andrii Laptiev", items: 4 },
  { name: "Yevhenii Onoshko", items: 4 },
]

const fsTeam: TeamMember[] = [
  { name: "Ruslan Kovalchuk", items: 3 },
  { name: "Andrii Baria", items: 3 },
  { name: "Yurii Pustovyi", items: 3 },
  { name: "Borys Rohulia", items: 2 },
  { name: "Vladyslav Shulzhenko", items: 1 },
]

const epics: EpicInfo[] = [
  { name: "Finance 2.0", project: "ASD", done: 31, total: 49 },
  { name: "Keitaro Manager", project: "ASD", done: 30, total: 33 },
  { name: "Landing Manager v0.1", project: "FS", done: 0, total: 3 },
  { name: "Service ID Check", project: "FS", done: 13, total: 15 },
  { name: "Meta Mind", project: "FS", done: 3, total: 8 },
  { name: "Offerwall", project: "FS", done: 12, total: 21 },
  { name: "FS Analytics Board", project: "FS", done: 3, total: 4 },
]

const zombieEpics = 8

/* -- Helpers ------------------------------------------------------- */

function workloadColor(items: number): "green" | "yellow" | "red" {
  if (items <= 3) return "green"
  if (items <= 6) return "yellow"
  return "red"
}

function progressColor(pct: number): string {
  if (pct >= 75) return "#52C67E"
  if (pct >= 25) return "#F5A623"
  return "#F55D4C"
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

/* -- Sprint Tab ---------------------------------------------------- */

function SprintTab() {
  const { t } = useI18n()
  const insights: Insight[] = [
    {
      type: "warning",
      text: "ASD velocity dropped to 61% (avg 87%). Investigate sprint planning or scope creep.",
    },
    {
      type: "warning",
      text: "12 items blocked in ASD, 7 assigned to Oleh Litvin.",
    },
    {
      type: "success",
      text: "FS velocity steady at 88%, tracking near average.",
    },
  ]

  return (
    <div className="space-y-6">
      <InsightsCard insights={insights} />

      {/* Sprint Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {sprints.map((s) => (
          <Card key={s.name}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-[#6B7A94] uppercase tracking-wider">{s.project}</p>
                  <p className="text-[15px] font-semibold text-[#E8EFFF] mt-0.5">{s.name}</p>
                </div>
                <ScoreBox
                  label={t("eng.velocity")}
                  value={`${s.velocity}%`}
                  sub={`avg ${s.avgVelocity}%`}
                  status={s.velocity >= 80 ? "ok" : s.velocity >= 65 ? "watch" : "stop"}
                />
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] text-[#6B7A94]">{t("eng.sprintProgress")}</span>
                  <span className="text-[12px] font-medium text-[#E8EFFF]">{s.velocity}%</span>
                </div>
                <div className="h-2 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${s.velocity}%`,
                      backgroundColor: s.velocity >= 80 ? "#52C67E" : s.velocity >= 65 ? "#F5A623" : "#F55D4C",
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-2 border-t border-[rgba(255,255,255,0.06)]">
                <ScoreBox label={t("eng.activeItems")} value={s.activeItems} />
                <ScoreBox
                  label={t("eng.bugDensity")}
                  value={`${s.bugDensity}%`}
                  status={s.bugDensity > 50 ? "stop" : s.bugDensity > 35 ? "watch" : "ok"}
                />
                <ScoreBox
                  label={t("eng.blocked")}
                  value={s.blocked}
                  status={s.blocked > 5 ? "stop" : s.blocked > 0 ? "watch" : "ok"}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Velocity Chart */}
      <Card>
        <CardContent className="p-5">
          <p className="text-[13px] font-semibold text-[#E8EFFF] mb-4">{t("eng.velocityTrend")}</p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={velocityHistory} barGap={4}>
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

function WorkloadBar({ items, max = 10 }: { items: number; max?: number }) {
  const pct = Math.min((items / max) * 100, 100)
  const color = workloadColor(items)
  const bg = color === "green" ? "#52C67E" : color === "yellow" ? "#F5A623" : "#F55D4C"
  return (
    <div className="flex items-center gap-3 flex-1">
      <div className="flex-1 h-2 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: bg }} />
      </div>
      <span className="text-[12px] font-medium text-[#E8EFFF] w-6 text-right">{items}</span>
    </div>
  )
}

function TeamSection({ name, members }: { name: string; members: TeamMember[] }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-[13px] font-semibold text-[#E8EFFF] mb-4">{name}</p>
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.name} className="flex items-center gap-3">
              <StatusDot status={workloadColor(m.items)} />
              <span className="text-[13px] text-[#C1CCDE] w-[180px] truncate">{m.name}</span>
              <WorkloadBar items={m.items} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function TeamsTab() {
  const { t } = useI18n()
  return (
    <div className="space-y-6">
      {/* Bottleneck callout */}
      <Card className="border-l-[3px] border-l-[#F55D4C] bg-[rgba(245,93,76,0.04)]">
        <CardContent className="p-5">
          <p className="text-[13px] font-semibold text-[#F55D4C] mb-1">{t("eng.bottleneckDetected")}</p>
          <p className="text-[13px] text-[#C1CCDE]">
            Oleh Litvin: 10 items, 4 stuck in review since May 2025. Tymofii Konopatov: 10 items as solo QA resource.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TeamSection name="ASD Team" members={asdTeam} />
        <TeamSection name="FS Team" members={fsTeam} />
      </div>
    </div>
  )
}

/* -- Bugs Tab ------------------------------------------------------ */

const bugData = [
  { project: "ASD", bugs: 114, features: 145 },
  { project: "FS", bugs: 105, features: 93 },
]

function BugsTab() {
  const { t } = useI18n()
  const insights: Insight[] = [
    {
      type: "warning",
      text: "FS spends 53% of capacity on bug-fixing, leaving minimal bandwidth for new features.",
    },
    {
      type: "warning",
      text: "ASD bug density at 44% -- nearly half of sprint capacity consumed by bugs.",
    },
  ]

  return (
    <div className="space-y-6">
      <InsightsCard insights={insights} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <ScoreBox label={`ASD ${t("eng.bugDensity")}`} value="44%" status="stop" sub="114 bugs / 90d" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox label={`FS ${t("eng.bugDensity")}`} value="53%" status="stop" sub="105 bugs / 90d" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox label={`ASD ${t("eng.bugCount90d")}`} value="114" status="watch" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ScoreBox label={`FS ${t("eng.bugCount90d")}`} value="105" status="watch" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <p className="text-[13px] font-semibold text-[#E8EFFF] mb-4">{t("eng.bugsVsFeatures")} (90 days)</p>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bugData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="project" tick={{ fill: "#6B7A94", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6B7A94", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
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

function EpicsTab() {
  const { t } = useI18n()
  return (
    <div className="space-y-6">
      {/* Zombie alert */}
      <Card className="border-l-[3px] border-l-[#F55D4C] bg-[rgba(245,93,76,0.04)]">
        <CardContent className="p-5">
          <p className="text-[13px] font-semibold text-[#F55D4C] mb-1">{t("eng.zombieEpics")}</p>
          <p className="text-[13px] text-[#C1CCDE]">
            {zombieEpics} {t("eng.zombieDesc")}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {epics.map((e) => {
          const pct = e.total > 0 ? Math.round((e.done / e.total) * 100) : 0
          return (
            <Card key={e.name}>
              <CardContent className="p-4 flex items-center gap-4">
                <span className="text-[11px] font-semibold text-[#6B7A94] uppercase w-8">{e.project}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#E8EFFF] truncate">{e.name}</p>
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
  return (
    <>
      <PageHeader
        title={t("eng.title")}
        subtitle={t("eng.subtitle")}
      />

      <Tabs defaultValue="sprint">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="sprint">{t("eng.sprint")}</TabsTrigger>
          <TabsTrigger value="teams">{t("eng.teams")}</TabsTrigger>
          <TabsTrigger value="bugs">{t("eng.bugs")}</TabsTrigger>
          <TabsTrigger value="epics">{t("eng.epics")}</TabsTrigger>
        </TabsList>

        <TabsContent value="sprint">
          <SprintTab />
        </TabsContent>
        <TabsContent value="teams">
          <TeamsTab />
        </TabsContent>
        <TabsContent value="bugs">
          <BugsTab />
        </TabsContent>
        <TabsContent value="epics">
          <EpicsTab />
        </TabsContent>
      </Tabs>
    </>
  )
}
