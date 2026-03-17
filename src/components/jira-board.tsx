"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  RefreshCw, Settings, X, ExternalLink, ChevronDown, ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { JiraTaskCards, type JiraTask } from "@/components/jira-task-cards"

interface BoardConfig {
  id: string
  boardId: number
  projectKey: string
  displayName: string
  url: string
}

interface Sprint {
  id: number
  name: string
  startDate?: string
  endDate?: string
  noActiveSprint?: boolean
}

interface Props {
  board: BoardConfig
  onRemoved: () => void
  onRenamed: (boardId: number, name: string) => void
}

export function JiraBoard({ board, onRemoved, onRenamed }: Props) {
  const [sprint, setSprint] = useState<Sprint | null>(null)
  const [tasks, setTasks] = useState<JiraTask[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(true)

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editName, setEditName] = useState(board.displayName)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jira/boards/${board.boardId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setSprint(data.sprint)
      setTasks(data.tasks ?? [])
      if (isRefresh) toast.success(`Refreshed ${board.displayName}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
      if (isRefresh) toast.error(msg)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [board.boardId, board.displayName])

  useEffect(() => { fetchData() }, [fetchData])

  const saveEdit = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/jira/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId: board.boardId, displayName: editName }),
      })
      if (!res.ok) throw new Error('Failed')
      onRenamed(board.boardId, editName)
      setEditOpen(false)
      toast.success('Board renamed')
    } catch {
      toast.error('Failed to rename board')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch('/api/jira/config', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId: board.boardId }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success(`Removed ${board.displayName}`)
      onRemoved()
    } catch {
      toast.error('Failed to remove board')
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  // Stat badges
  const working = tasks.filter(t => t.prStatus === 'working_on').length
  const inReview = tasks.filter(t => t.prStatus === 'open' || t.prStatus === 'draft').length
  const merged   = tasks.filter(t => t.prStatus === 'merged').length

  return (
    <>
      <div id={`board-${board.boardId}`} className="rounded-xl border border-border bg-card overflow-hidden">
        {/* ── Board header ── */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/20 group">

          {/* Collapse toggle */}
          <Button
            variant="ghost" size="icon" className="h-7 w-7 shrink-0"
            onClick={() => setOpen(v => !v)}
          >
            {open
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            }
          </Button>

          {/* Board name + meta — clickable to toggle */}
          <button
            className="flex items-center gap-2 flex-1 min-w-0 text-left"
            onClick={() => setOpen(v => !v)}
          >
            <span className="font-semibold text-sm">{board.displayName}</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">{board.projectKey}</Badge>
            {sprint && (
              <Badge
                variant={sprint.noActiveSprint ? "outline" : "secondary"}
                className={`text-[10px] h-4 px-1 shrink-0 ${sprint.noActiveSprint ? 'text-muted-foreground border-dashed' : ''}`}
              >{sprint.name}</Badge>
            )}
          </button>

          {/* Stat badges */}
          {!loading && !error && tasks.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-muted-foreground">{tasks.length} issues</span>
              {working > 0 && (
                <Badge className="bg-yellow-400/10 text-yellow-400 border-yellow-400/30 text-[10px] h-4 px-1">{working} wip</Badge>
              )}
              {inReview > 0 && (
                <Badge className="bg-blue-400/10 text-blue-400 border-blue-400/30 text-[10px] h-4 px-1">{inReview} review</Badge>
              )}
              {merged > 0 && (
                <Badge className="bg-green-400/10 text-green-400 border-green-400/30 text-[10px] h-4 px-1">{merged} merged</Badge>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => { setEditName(board.displayName); setEditOpen(true) }}
              title="Rename"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <a href={board.url} target="_blank" rel="noreferrer">
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Open in Jira">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
            <Button
              variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
              title="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* ── Tasks area ── */}
        {open && (
          <div className="p-4">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-36" />
                ))}
              </div>
            ) : error ? (
              <p className="text-xs text-destructive py-3">{error}</p>
            ) : (
              <JiraTaskCards tasks={tasks} />
            )}
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}
      <Dialog open={editOpen} onOpenChange={v => !v && setEditOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Rename Board</DialogTitle></DialogHeader>
          <div className="py-2">
            <p className="text-xs text-muted-foreground font-mono mb-2">{board.projectKey} · Board #{board.boardId}</p>
            <Input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveEdit()}
              placeholder="Display name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={saveEdit} disabled={saving || !editName.trim()}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={v => !v && setDeleteOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove Board</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Remove <span className="font-semibold text-foreground">{board.displayName}</span>?
            <br />Only removes the local config — Jira data is not affected.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
