"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus } from "lucide-react"
import { toast } from "sonner"

export function CreateInstructionDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(false)
  const [nameError, setNameError] = useState("")

  const handleCreate = async () => {
    if (!name.trim()) return
    setNameError("")
    setLoading(true)
    try {
      const res = await fetch('/api/claude/instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim() || undefined,
          content: content.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create instruction file')
      toast.success(`Created: ${data.name}`)
      setName("")
      setCategory("")
      setContent("")
      setOpen(false)
      onCreated?.()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create instruction file'
      if (msg.toLowerCase().includes('already exists')) {
        setNameError(msg)
      } else {
        toast.error(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        New Instruction
      </Button>

      <Dialog open={open} onOpenChange={v => !v && setOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Instruction File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="instr-name">File Name</Label>
              <Input
                id="instr-name"
                placeholder="e.g. my-instructions"
                value={name}
                onChange={e => { setName(e.target.value); setNameError("") }}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                className={`font-mono text-sm ${nameError ? 'border-destructive' : ''}`}
              />
              {nameError
                ? <p className="text-xs text-destructive">{nameError}</p>
                : <p className="text-xs text-muted-foreground">.md extension will be added automatically</p>
              }
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="instr-category">Category (optional)</Label>
              <Input
                id="instr-category"
                placeholder="e.g. Root instructions"
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Subdirectory inside Instructions/. Leave empty for root.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="instr-content">Initial Content (optional)</Label>
              <Textarea
                id="instr-content"
                placeholder="# My Instructions&#10;&#10;Content here..."
                value={content}
                onChange={e => setContent(e.target.value)}
                className="font-mono text-sm min-h-[120px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={loading || !name.trim()}>
              {loading ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
