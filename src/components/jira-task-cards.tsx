"use client"

import React, { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { ExternalLink, Clock, GitPullRequest, User, Search, X } from "lucide-react"

export type PRStatus = 'working_on' | 'open' | 'draft' | 'merged' | 'closed'

export interface JiraTask {
  key: string
  summary: string
  status: string
  statusCategory: string
  assignee: { name: string; avatar: string } | null
  estimate: string
  timespent: string
  issueUrl: string
  pr: { url: string; number: number; title: string; repo: string; status: PRStatus } | null
  prStatus: PRStatus
}

const PR_BADGE: Record<PRStatus, React.ReactElement> = {
  working_on: <Badge className="bg-yellow-400/10 text-yellow-400 border-yellow-400/30 text-[10px] h-5 px-1.5">Working on</Badge>,
  draft:       <Badge className="bg-zinc-400/10  text-zinc-400  border-zinc-400/30  text-[10px] h-5 px-1.5">Draft</Badge>,
  open:        <Badge className="bg-blue-400/10  text-blue-400  border-blue-400/30  text-[10px] h-5 px-1.5">In Review</Badge>,
  merged:      <Badge className="bg-green-400/10 text-green-400 border-green-400/30 text-[10px] h-5 px-1.5">Merged</Badge>,
  closed:      <Badge className="bg-red-400/10   text-red-400   border-red-400/30   text-[10px] h-5 px-1.5">Closed</Badge>,
}

const STATUS_COLORS: Record<string, string> = {
  new:           'bg-zinc-400/15 text-zinc-300 border-zinc-400/30',
  indeterminate: 'bg-blue-400/15 text-blue-300 border-blue-400/30',
  done:          'bg-green-400/15 text-green-300 border-green-400/30',
}

// ── Task Detail Modal ────────────────────────────────────────────────────

function TaskModal({ task, onClose }: { task: JiraTask; onClose: () => void }) {
  const statusColor = STATUS_COLORS[task.statusCategory] ?? 'bg-muted text-muted-foreground border-border'

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <a
              href={task.issueUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-blue-400 hover:underline flex items-center gap-1"
              onClick={e => e.stopPropagation()}
            >
              {task.key}
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
            <Badge variant="outline" className={`text-[10px] h-5 px-1.5 border ${statusColor}`}>
              {task.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Summary */}
          <p className="text-sm leading-relaxed text-foreground">{task.summary}</p>

          {/* PR Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-24 shrink-0">PR Status</span>
            {task.pr ? (
              <a href={task.pr.url} target="_blank" rel="noreferrer">
                {PR_BADGE[task.prStatus]}
              </a>
            ) : (
              PR_BADGE['working_on']
            )}
          </div>

          {/* Assignee */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-24 shrink-0">Assignee</span>
            {task.assignee ? (
              <div className="flex items-center gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={task.assignee.avatar} alt={task.assignee.name} className="h-5 w-5 rounded-full" />
                <span className="text-sm">{task.assignee.name}</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Unassigned</span>
            )}
          </div>

          {/* Time */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-24 shrink-0">Estimate</span>
            <span className="text-sm font-mono">{task.estimate}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-24 shrink-0">Time spent</span>
            <span className="text-sm font-mono">{task.timespent}</span>
          </div>

          {/* PR Details */}
          {task.pr && (
            <div className="rounded-md border border-border/50 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <GitPullRequest className="h-3.5 w-3.5" />
                Pull Request
              </div>
              <a
                href={task.pr.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-400 hover:underline block"
              >
                #{task.pr.number} · {task.pr.title}
              </a>
              <p className="text-xs text-muted-foreground">{task.pr.repo}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Task Card ────────────────────────────────────────────────────────────

function TaskCard({ task, onClick }: { task: JiraTask; onClick: () => void }) {
  const statusColor = STATUS_COLORS[task.statusCategory] ?? 'bg-muted text-muted-foreground border-border'

  return (
    <Card className="hover:bg-accent/20 transition-colors cursor-pointer" onClick={onClick}>
      <CardContent className="p-3 space-y-2.5">

        {/* Row 1: Key + Jira status + PR badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <a
              href={task.issueUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs font-semibold text-blue-400 hover:underline flex items-center gap-0.5 shrink-0"
              onClick={e => e.stopPropagation()}
            >
              {task.key}
              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
            </a>
            <Badge variant="outline" className={`text-[10px] h-5 px-1.5 border ${statusColor}`}>
              {task.status}
            </Badge>
          </div>
          {task.pr ? (
            <a href={task.pr.url} target="_blank" rel="noreferrer" className="shrink-0" onClick={e => e.stopPropagation()}>
              {PR_BADGE[task.prStatus]}
            </a>
          ) : (
            <span className="shrink-0">{PR_BADGE['working_on']}</span>
          )}
        </div>

        {/* Row 2: Summary */}
        <p className="text-sm leading-snug text-foreground/90 line-clamp-2">
          {task.summary}
        </p>

        {/* Row 3: Assignee */}
        <div className="flex items-center gap-1.5">
          {task.assignee ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={task.assignee.avatar}
                alt={task.assignee.name}
                className="h-5 w-5 rounded-full shrink-0"
              />
              <span className="text-xs text-muted-foreground truncate">{task.assignee.name}</span>
            </>
          ) : (
            <>
              <User className="h-4 w-4 text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground/50">Unassigned</span>
            </>
          )}
        </div>

        {/* Row 4: Estimate / Fact */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0" />
            <span>Est: <span className="font-mono text-foreground/70">{task.estimate}</span></span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0 opacity-60" />
            <span>Fact: <span className="font-mono text-foreground/70">{task.timespent}</span></span>
          </div>
        </div>

        {/* Row 5: PR details (if exists) */}
        {task.pr && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-t border-border/40 pt-2">
            <GitPullRequest className="h-3 w-3 shrink-0" />
            <a
              href={task.pr.url}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors truncate"
              title={task.pr.title}
              onClick={e => e.stopPropagation()}
            >
              #{task.pr.number} · {task.pr.repo.split('/')[1] ?? task.pr.repo}
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Swimlane ─────────────────────────────────────────────────────────────

function Swimlane({ projectKey, tasks, onCardClick, showHeader }: {
  projectKey: string
  tasks: JiraTask[]
  onCardClick: (task: JiraTask) => void
  showHeader: boolean
}) {
  return (
    <div className="space-y-2">
      {showHeader && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{projectKey}</span>
          <span className="text-xs text-muted-foreground">({tasks.length})</span>
          <div className="flex-1 h-px bg-border/40" />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {tasks.map(task => (
          <TaskCard key={task.key} task={task} onClick={() => onCardClick(task)} />
        ))}
      </div>
    </div>
  )
}

// ── Filters ──────────────────────────────────────────────────────────────

const selectCls = "h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"

// ── Main Component ────────────────────────────────────────────────────────

interface Props {
  tasks: JiraTask[]
}

export function JiraTaskCards({ tasks }: Props) {
  const [search, setSearch] = useState("")
  const [assigneeFilter, setAssigneeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [prStatusFilter, setPrStatusFilter] = useState("all")
  const [selectedTask, setSelectedTask] = useState<JiraTask | null>(null)

  // Unique values for dropdowns
  const assignees = useMemo(() => {
    const names = tasks.map(t => t.assignee?.name).filter(Boolean) as string[]
    return [...new Set(names)].sort()
  }, [tasks])

  const statuses = useMemo(() => [...new Set(tasks.map(t => t.status))].sort(), [tasks])

  // Filter
  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (search) {
        const q = search.toLowerCase()
        if (!t.key.toLowerCase().includes(q) && !t.summary.toLowerCase().includes(q)) return false
      }
      if (assigneeFilter !== "all") {
        const name = t.assignee?.name ?? ""
        if (assigneeFilter === "__unassigned__" ? name !== "" : name !== assigneeFilter) return false
      }
      if (statusFilter !== "all" && t.status !== statusFilter) return false
      if (prStatusFilter !== "all" && t.prStatus !== prStatusFilter) return false
      return true
    })
  }, [tasks, search, assigneeFilter, statusFilter, prStatusFilter])

  // Group by project key (swimlanes)
  const swimlanes = useMemo(() => {
    const groups = new Map<string, JiraTask[]>()
    for (const t of filtered) {
      const pk = t.key.split('-')[0]
      if (!groups.has(pk)) groups.set(pk, [])
      groups.get(pk)!.push(t)
    }
    return groups
  }, [filtered])

  const hasFilters = Boolean(search) || assigneeFilter !== "all" || statusFilter !== "all" || prStatusFilter !== "all"
  const showSwimlaneHeaders = swimlanes.size > 1

  if (!tasks.length) {
    return <p className="text-xs text-muted-foreground py-6 text-center">No issues in this sprint</p>
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search key or summary…"
            className="h-8 pl-8 text-xs"
          />
          {search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Assignee */}
        <select
          value={assigneeFilter}
          onChange={e => setAssigneeFilter(e.target.value)}
          className={selectCls}
        >
          <option value="all">All assignees</option>
          <option value="__unassigned__">Unassigned</option>
          {assignees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        {/* Jira status */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className={selectCls}
        >
          <option value="all">All statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* PR status */}
        <select
          value={prStatusFilter}
          onChange={e => setPrStatusFilter(e.target.value)}
          className={selectCls}
        >
          <option value="all">All PR statuses</option>
          <option value="working_on">Working on</option>
          <option value="draft">Draft</option>
          <option value="open">In Review</option>
          <option value="merged">Merged</option>
          <option value="closed">Closed</option>
        </select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs px-2"
            onClick={() => {
              setSearch("")
              setAssigneeFilter("all")
              setStatusFilter("all")
              setPrStatusFilter("all")
            }}
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}

        {hasFilters && (
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} of {tasks.length}
          </span>
        )}
      </div>

      {/* Swimlanes */}
      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No issues match the filters</p>
      ) : (
        <div className="space-y-6">
          {[...swimlanes.entries()].map(([pk, ptasks]) => (
            <Swimlane
              key={pk}
              projectKey={pk}
              tasks={ptasks}
              onCardClick={setSelectedTask}
              showHeader={showSwimlaneHeaders}
            />
          ))}
        </div>
      )}

      {/* Task detail modal */}
      {selectedTask && (
        <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  )
}
