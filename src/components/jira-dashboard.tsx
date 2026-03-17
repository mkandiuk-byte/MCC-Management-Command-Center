"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Plus, Kanban } from "lucide-react"
import { JiraBoard } from "@/components/jira-board"
import { AddJiraBoardDialog } from "@/components/add-jira-board-dialog"

interface BoardConfig {
  id: string
  boardId: number
  projectKey: string
  displayName: string
  url: string
}


export function JiraDashboard() {
  const [boards, setBoards] = useState<BoardConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  const loadBoards = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/jira/config')
      const data = await res.json()
      setBoards(data.boards ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  const scrolledRef = useRef(false)

  useEffect(() => { loadBoards() }, [loadBoards])

  // Scroll to anchor after boards load
  useEffect(() => {
    if (loading || scrolledRef.current) return
    const hash = window.location.hash
    if (!hash) return
    const el = document.querySelector(hash)
    if (el) {
      scrolledRef.current = true
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [loading])

  const handleRenamed = (boardId: number, name: string) => {
    setBoards(prev => prev.map(b => b.boardId === boardId ? { ...b, displayName: name } : b))
  }

  const handleRemoved = (boardId: number) => {
    setBoards(prev => prev.filter(b => b.boardId !== boardId))
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={loadBoards} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh All
        </Button>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Board
        </Button>
        {boards.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline">{boards.length} {boards.length === 1 ? 'board' : 'boards'}</Badge>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : boards.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
          <Kanban className="h-12 w-12 opacity-40" />
          <div className="text-center">
            <p className="font-medium text-foreground">No Jira boards configured</p>
            <p className="text-sm mt-1">Add a board to start tracking your teams</p>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Board
          </Button>
        </div>
      ) : (
        /* Boards grid — one board per row (full width for the table) */
        <div className="space-y-6">
          {boards.map(board => (
            <JiraBoard
              key={board.boardId}
              board={board}
              onRemoved={() => handleRemoved(board.boardId)}
              onRenamed={handleRenamed}
            />
          ))}
        </div>
      )}

      <AddJiraBoardDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={loadBoards}
        existingBoardIds={boards.map(b => b.boardId)}
      />
    </div>
  )
}
