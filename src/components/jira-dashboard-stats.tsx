"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Kanban, ExternalLink, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { BoardStats } from "@aap/types"

interface StatsResponse {
  boards: BoardStats[]
  totals: { total: number; inProgress: number; done: number; merged: number; open: number }
}

function Pill({ label, value, cls }: { label: string; value: number; cls: string }) {
  if (value === 0) return null
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border ${cls}`}>
      <span className="font-bold">{value}</span>
      <span className="opacity-80">{label}</span>
    </span>
  )
}

function BoardCard({ board }: { board: BoardStats }) {
  const hasSprint = Boolean(board.sprintName)
  const router = useRouter()

  return (
    <div
      className="rounded-lg border border-border/60 bg-card/40 px-4 py-3 space-y-2.5 cursor-pointer hover:border-border hover:bg-card/60 transition-colors"
      onClick={() => router.push(`/jira#board-${board.boardId}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate">{board.displayName}</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">{board.projectKey}</Badge>
          </div>
          {board.sprintName && (
            <p className={`text-[11px] mt-0.5 truncate ${board.sprintName === 'All Issues' ? 'text-muted-foreground/60 italic' : 'text-muted-foreground'}`}>
              {board.sprintName}
            </p>
          )}
          {board.error && (
            <p className="text-[11px] text-destructive mt-0.5">Error loading data</p>
          )}
        </div>
        <a href={board.url} target="_blank" rel="noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5" onClick={e => e.stopPropagation()}>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Status pills */}
      {hasSprint && !board.error && (
        <>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border border-border/50 text-muted-foreground">
              <span className="font-bold text-foreground">{board.total}</span>
              <span>total</span>
            </span>
            <Pill label="todo"     value={board.todo}       cls="bg-zinc-400/10  text-zinc-300  border-zinc-400/25" />
            <Pill label="in prog"  value={board.inProgress} cls="bg-blue-400/10  text-blue-300  border-blue-400/25" />
            <Pill label="done"     value={board.done}       cls="bg-green-400/10 text-green-300 border-green-400/25" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Pill label="no PR"    value={board.working_on} cls="bg-yellow-400/10 text-yellow-300 border-yellow-400/25" />
            <Pill label="draft"    value={board.draft}      cls="bg-zinc-400/10  text-zinc-300   border-zinc-400/25" />
            <Pill label="review"   value={board.open}       cls="bg-blue-400/10  text-blue-300   border-blue-400/25" />
            <Pill label="merged"   value={board.merged}     cls="bg-green-400/10 text-green-300  border-green-400/25" />
            <Pill label="closed"   value={board.closed}     cls="bg-red-400/10   text-red-300    border-red-400/25" />
          </div>

          {/* Assignees */}
          {board.assignees.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5 border-t border-border/30">
              {board.assignees.map(a => (
                <div key={a.name} className="flex items-center gap-1" title={`${a.name} · ${a.count} issue${a.count > 1 ? 's' : ''}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.avatar} alt={a.name} className="h-4 w-4 rounded-full" />
                  <span className="text-[10px] text-muted-foreground">{a.count}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

    </div>
  )
}

export function JiraDashboardStats() {
  const [data, setData] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    fetch('/api/jira/stats')
      .then(r => r.json())
      .then((d: StatsResponse) => {
        setData(d)
        if (d?.boards && 'setAppBadge' in navigator) {
          const prCount = d.boards.reduce((sum, b) => sum + b.draft + b.open + b.merged + b.closed, 0)
          // Only clear badge if GitHub data looks valid (not all-zero due to rate limiting).
          // If every board with issues shows 0 PRs found, GitHub search likely failed — keep stale badge.
          const totalIssues = d.boards.reduce((s, b) => s + b.total, 0)
          const githubDataValid = prCount > 0 || totalIssues === 0 ||
            d.boards.some(b => b.error)
          if (prCount > 0) {
            navigator.setAppBadge(prCount).catch(() => {})
          } else if (githubDataValid) {
            navigator.clearAppBadge?.().catch(() => {})
          }
          // else: totalIssues > 0 but prCount = 0 and no errors → rate-limited, keep current badge
        }
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false) })
  }

  useEffect(() => {
    load()
    const id = setInterval(() => load(true), 60_000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Kanban className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Jira Boards</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    )
  }

  if (!data?.boards.length) return null

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <Kanban className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Jira Boards</span>
        {/* Overall totals */}
        {data.totals.total > 0 && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-xs text-muted-foreground">{data.totals.total} issues across {data.boards.length} {data.boards.length === 1 ? 'board' : 'boards'}</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/jira" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            View all →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.boards.map(board => (
          <BoardCard key={board.boardId} board={board} />
        ))}
      </div>
    </div>
  )
}
