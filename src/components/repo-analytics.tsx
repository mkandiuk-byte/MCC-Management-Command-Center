'use client'

import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { format, formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Contributor {
  login: string
  avatar: string
  commits: number
}

interface PREntry {
  number: number
  title: string
  date: string
  url: string
}

interface TimelineEntry {
  month: string
  prs: number
  merges: number
}

interface RepoStats {
  createdAt: string
  totalPRs: number
  totalMerges: number
  lastPR: PREntry | null
  lastMerge: PREntry | null
  contributors: Contributor[]
  prTimeline: TimelineEntry[]
}

interface RepoAnalyticsProps {
  stats: RepoStats
}

function CustomAreaTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

function CustomBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-semibold">{label}</p>
      <p className="text-indigo-400">{payload[0]?.value} commits</p>
    </div>
  )
}

export function RepoAnalytics({ stats }: RepoAnalyticsProps) {
  const topContributors = [...stats.contributors]
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 10)

  const createdLabel = (() => {
    try {
      return format(new Date(stats.createdAt), 'dd MMM yyyy')
    } catch {
      return stats.createdAt
    }
  })()

  return (
    <div className="space-y-6">
      {/* PR Timeline */}
      {stats.prTimeline.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">PR Activity — last 12 months</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={stats.prTimeline} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPRs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMerges" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  className="fill-muted-foreground"
                />
                <Tooltip content={<CustomAreaTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="prs"
                  name="PRs"
                  stroke="#6366f1"
                  fill="url(#colorPRs)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Area
                  type="monotone"
                  dataKey="merges"
                  name="Merges"
                  stroke="#10b981"
                  fill="url(#colorMerges)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Contributors */}
      {topContributors.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(topContributors.length * 40, 200)}>
              <BarChart
                data={topContributors}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  className="fill-muted-foreground"
                />
                <YAxis
                  type="category"
                  dataKey="login"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                  className="fill-muted-foreground"
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
                <Bar
                  dataKey="commits"
                  name="Commits"
                  fill="#6366f1"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Repository age note */}
      <p className="text-xs text-muted-foreground">
        Repository created: {createdLabel}
      </p>
    </div>
  )
}
