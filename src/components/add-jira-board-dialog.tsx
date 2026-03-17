"use client"

import { useState } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface Props {
  open: boolean
  onClose: () => void
  onAdded: () => void
  existingBoardIds?: number[]
}

export function AddJiraBoardDialog({ open, onClose, onAdded, existingBoardIds = [] }: Props) {
  const [url, setUrl] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [loading, setLoading] = useState(false)

  const isValidUrl = /\/projects\/[A-Z0-9]+\/boards\/\d+/.test(url)
  const extractedId = url.match(/\/boards\/(\d+)/)?.[1]
  const isDuplicate = Boolean(extractedId) && existingBoardIds.includes(Number(extractedId))

  const handleAdd = async () => {
    if (!url.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/jira/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), displayName: displayName.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add board')
      toast.success(`Added board: ${data.board.displayName}`)
      setUrl("")
      setDisplayName("")
      onAdded()
      onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Jira Board</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="board-url">Board URL</Label>
            <Input
              id="board-url"
              placeholder="https://company.atlassian.net/jira/software/c/projects/KEY/boards/123"
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="font-mono text-xs"
              onKeyDown={e => e.key === 'Enter' && isValidUrl && handleAdd()}
            />
            {url && !isValidUrl && (
              <p className="text-xs text-destructive">
                URL must contain <span className="font-mono">/projects/KEY/boards/ID</span>
              </p>
            )}
            {url && isValidUrl && !isDuplicate && (
              <p className="text-xs text-green-400">Valid board URL</p>
            )}
            {isDuplicate && (
              <p className="text-xs text-destructive">This board is already added (ID: {extractedId})</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="board-name">
              Display Name <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="board-name"
              placeholder="Defaults to board name from Jira"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={loading || !isValidUrl || isDuplicate}
          >
            {loading ? 'Adding...' : 'Add Board'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
