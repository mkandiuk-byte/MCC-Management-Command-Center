"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { GitBranch, Layers, Wrench, Clock } from "lucide-react"

interface Stats {
  repos: number
  skills: number
  tools: number
  lastSync: string | null
  timestamp: string
}

function formatLastSync(line: string | null): string {
  if (!line) return "Never"
  const match = line.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/)
  if (match) {
    const d = new Date(match[0])
    return d.toLocaleString('ru-RU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  return line.slice(0, 40)
}

export function DashboardStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  const items = [
    { label: "Git Repos", value: stats?.repos, icon: GitBranch, color: "text-blue-400", isText: false },
    { label: "Claude Skills", value: stats?.skills, icon: Layers, color: "text-green-400", isText: false },
    { label: "Tool Docs", value: stats?.tools, icon: Wrench, color: "text-orange-400", isText: false },
    { label: "Last Sync", value: stats ? formatLastSync(stats.lastSync) : null, icon: Clock, color: "text-cyan-400", isText: true },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {items.map(item => (
        <Card key={item.label} className="bg-card/50">
          <CardHeader className="pb-1 pt-3 px-4">
            <div className="flex items-center gap-2">
              <item.icon className={`h-4 w-4 ${item.color}`} />
              <CardTitle className="text-xs font-medium text-muted-foreground">{item.label}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <span className={item.isText ? 'text-sm font-normal text-muted-foreground' : 'text-2xl font-bold'}>
                {item.value ?? '—'}
              </span>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
