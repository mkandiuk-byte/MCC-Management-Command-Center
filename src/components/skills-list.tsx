"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Search, Layers, Wrench, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface Skill {
  id: string
  name: string
  description: string
  argumentHint: string
  allowedTools: string
  context: string
  hasSkillMd: boolean
  path: string
}

function CreateSkillDialog({
  open,
  onClose,
  onCreated,
  existingNames = [],
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
  existingNames?: string[]
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [allowedTools, setAllowedTools] = useState("")
  const [argumentHint, setArgumentHint] = useState("")
  const [context, setContext] = useState("")
  const [loading, setLoading] = useState(false)

  const safeName = name.trim().replace(/[^a-zA-Z0-9\-_]/g, '-').replace(/^-+|-+$/g, '')
  const isDuplicate = Boolean(safeName) && existingNames.includes(safeName)

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/claude/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          allowedTools: allowedTools.trim() || undefined,
          argumentHint: argumentHint.trim() || undefined,
          context: context.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create skill')
      toast.success(`Created skill: ${data.id}`)
      setName("")
      setDescription("")
      setAllowedTools("")
      setArgumentHint("")
      setContext("")
      onCreated()
      onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create skill')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Skill</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="skill-name">Name *</Label>
            <Input
              id="skill-name"
              placeholder="e.g. my-skill"
              value={name}
              onChange={e => setName(e.target.value)}
              className={`font-mono text-sm ${isDuplicate ? 'border-destructive' : ''}`}
            />
            {isDuplicate
              ? <p className="text-xs text-destructive">Skill &quot;{safeName}&quot; already exists</p>
              : <p className="text-xs text-muted-foreground">Alphanumeric, hyphens, underscores only</p>
            }
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-desc">Description</Label>
            <Input
              id="skill-desc"
              placeholder="One-line description. Include USE WHEN trigger phrases."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-tools">Allowed Tools</Label>
            <Input
              id="skill-tools"
              placeholder="Bash, Read, Write"
              value={allowedTools}
              onChange={e => setAllowedTools(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-hint">Argument Hint</Label>
            <Input
              id="skill-hint"
              placeholder="[optional args]"
              value={argumentHint}
              onChange={e => setArgumentHint(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-ctx">Context</Label>
            <Input
              id="skill-ctx"
              placeholder="fork"
              value={context}
              onChange={e => setContext(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={loading || !name.trim() || isDuplicate}>
            {loading ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SkillsList() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const loadSkills = () => {
    fetch('/api/claude/skills')
      .then(r => r.json())
      .then(data => setSkills(data.skills || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadSkills() }, [])

  const deleteSkill = async (id: string, name: string) => {
    if (!confirm(`Delete skill "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    try {
      const res = await fetch('/api/claude/skills', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete')
      toast.success(`Deleted skill: ${name}`)
      setSkills(prev => prev.filter(s => s.id !== id))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete skill')
    } finally {
      setDeleting(null)
    }
  }

  const filtered = skills.filter(s =>
    !filter ||
    s.name.toLowerCase().includes(filter.toLowerCase()) ||
    s.description.toLowerCase().includes(filter.toLowerCase())
  )

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search skills..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="pl-8"
          />
        </div>
        <Badge variant="outline">{filtered.length} skills</Badge>
        <Button size="sm" className="ml-auto" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Skill
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(skill => (
          <Card key={skill.id} className="hover:bg-accent/30 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Layers className="h-4 w-4 text-green-400 shrink-0" />
                  <CardTitle className="text-sm truncate">{skill.name}</CardTitle>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {skill.context === 'fork' && (
                    <Badge variant="secondary" className="text-[10px]">fork</Badge>
                  )}
                  {!skill.hasSkillMd && (
                    <Badge variant="destructive" className="text-[10px]">No SKILL.md</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => deleteSkill(skill.id, skill.name)}
                    disabled={deleting === skill.id}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {skill.description && (
                <CardDescription className="text-xs line-clamp-2 mt-1">
                  {skill.description}
                </CardDescription>
              )}
            </CardHeader>
            {(skill.argumentHint || skill.allowedTools) && (
              <CardContent className="pt-0 pb-3">
                <div className="space-y-1">
                  {skill.argumentHint && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="font-mono bg-muted px-1 rounded">{skill.argumentHint}</span>
                    </div>
                  )}
                  {skill.allowedTools && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Wrench className="h-3 w-3" />
                      <span>{skill.allowedTools}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <CreateSkillDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={loadSkills}
        existingNames={skills.map(s => s.id)}
      />
    </div>
  )
}
