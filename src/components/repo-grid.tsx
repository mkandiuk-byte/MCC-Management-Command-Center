"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  GitBranch, GitCommit, Clock, AlertCircle,
  CheckCircle2, Search, RefreshCw, ExternalLink,
  ArrowUp, ArrowDown, FolderPlus, Folder, Trash2, Plus,
  GitFork, Download
} from "lucide-react"
import { toast } from "sonner"

interface RepoInfo {
  id: string
  name: string
  path: string
  branch: string
  lastCommitHash: string
  lastCommitMessage: string
  lastCommitDate: string
  ahead: number
  behind: number
  isDirty: boolean
  hasRemote: boolean
  scanDir: string
  error?: string
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = (now.getTime() - date.getTime()) / 1000
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  } catch { return '' }
}

function RepoCard({ repo, onPulled }: { repo: RepoInfo; onPulled: () => void }) {
  const isHealthy = !repo.error && !repo.isDirty && repo.behind === 0
  const [pulling, setPulling] = useState(false)

  const openInPycharm = () => {
    fetch(`/api/actions/open-vscode?path=${encodeURIComponent(repo.path)}`, { method: 'POST' })
      .then(() => toast.success(`Opened ${repo.name} in PyCharm`))
      .catch(() => toast.error('Failed to open PyCharm'))
  }

  const pullRepo = async () => {
    setPulling(true)
    try {
      const res = await fetch('/api/repos/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath: repo.path }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Pull failed')
      toast.success(`Pulled ${repo.name}: ${data.output || 'up to date'}`)
      onPulled()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Pull failed')
    } finally {
      setPulling(false)
    }
  }

  return (
    <Card className={`hover:bg-accent/30 transition-colors ${repo.error ? 'border-destructive/50' : ''}`}>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {repo.error
              ? <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              : <CheckCircle2 className={`h-4 w-4 shrink-0 ${isHealthy ? 'text-green-400' : 'text-yellow-400'}`} />
            }
            <CardTitle className="text-sm truncate">{repo.name}</CardTitle>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {repo.hasRemote && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={pullRepo}
                disabled={pulling}
                title="git pull --ff-only"
              >
                <Download className={`h-3 w-3 ${pulling ? 'animate-bounce' : ''}`} />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={openInPycharm}>
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        {repo.error ? (
          <p className="text-xs text-destructive">{repo.error}</p>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <GitBranch className="h-3 w-3 shrink-0" />
              <span className="font-mono">{repo.branch}</span>
              {repo.isDirty && <Badge variant="outline" className="text-[10px] h-4 px-1 text-yellow-400 border-yellow-400/40">dirty</Badge>}
              {repo.ahead > 0 && (
                <span className="flex items-center gap-0.5 text-green-400">
                  <ArrowUp className="h-3 w-3" />{repo.ahead}
                </span>
              )}
              {repo.behind > 0 && (
                <span className="flex items-center gap-0.5 text-orange-400">
                  <ArrowDown className="h-3 w-3" />{repo.behind}
                </span>
              )}
            </div>
            {repo.lastCommitHash && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <GitCommit className="h-3 w-3 shrink-0 mt-0.5" />
                <span className="truncate leading-tight">{repo.lastCommitMessage}</span>
              </div>
            )}
            {repo.lastCommitDate && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                <span className="font-mono text-[11px]">{repo.lastCommitHash}</span>
                <span className="ml-auto">{timeAgo(repo.lastCommitDate)}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function CloneRepoDialog({
  open,
  onClose,
  onCloned,
  existingNames = [],
}: {
  open: boolean
  onClose: () => void
  onCloned: () => void
  existingNames?: string[]
}) {
  const [url, setUrl] = useState("")
  const [name, setName] = useState("")
  const [targetDir, setTargetDir] = useState("")
  const [loading, setLoading] = useState(false)

  const derivedName = name.trim() || url.trim().split('/').pop()?.replace(/\.git$/, '') || ''
  const isNameDuplicate = Boolean(derivedName) && existingNames.some(n => n.toLowerCase() === derivedName.toLowerCase())

  const handleClone = async () => {
    if (!url.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/repos/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          name: name.trim() || undefined,
          targetDir: targetDir.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Clone failed')
      toast.success(`Cloned ${data.name} to ${data.path}`)
      setUrl("")
      setName("")
      setTargetDir("")
      onCloned()
      onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Clone failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Clone Repository</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="clone-url">Repository URL *</Label>
            <Input
              id="clone-url"
              placeholder="https://github.com/org/repo.git"
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clone-name">Name (optional)</Label>
            <Input
              id="clone-name"
              placeholder="Defaults to repo name from URL"
              value={name}
              onChange={e => setName(e.target.value)}
              className={`font-mono text-sm ${isNameDuplicate ? 'border-destructive' : ''}`}
            />
            {isNameDuplicate && (
              <p className="text-xs text-destructive">Repository &quot;{derivedName}&quot; already exists</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clone-target">Target Directory</Label>
            <Input
              id="clone-target"
              value={targetDir}
              onChange={e => setTargetDir(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleClone} disabled={loading || !url.trim() || isNameDuplicate}>
            {loading ? 'Cloning...' : 'Clone'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ManageDirsDialog({
  open,
  onClose,
  scanDirs,
  onAdded,
  onRemoved,
}: {
  open: boolean
  onClose: () => void
  scanDirs: string[]
  onAdded: () => void
  onRemoved: () => void
}) {
  const [newDir, setNewDir] = useState("")
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  const isDirDuplicate = Boolean(newDir.trim()) && scanDirs.includes(newDir.trim())

  const addDir = async () => {
    if (!newDir.trim() || isDirDuplicate) return
    setAdding(true)
    try {
      const res = await fetch('/api/repos/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir: newDir.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success(`Added: ${newDir.trim()}`)
      setNewDir("")
      onAdded()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to add directory')
    } finally {
      setAdding(false)
    }
  }

  const removeDir = async (dir: string) => {
    setRemoving(dir)
    try {
      const res = await fetch('/api/repos/config', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success(`Removed: ${dir}`)
      onRemoved()
    } catch {
      toast.error('Failed to remove directory')
    } finally {
      setRemoving(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Scan Directories</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            {scanDirs.length === 0 && (
              <p className="text-sm text-muted-foreground">No directories configured.</p>
            )}
            {scanDirs.map(dir => (
              <div key={dir} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs font-mono flex-1 truncate">{dir}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => removeDir(dir)}
                  disabled={removing === dir}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <div className="flex gap-2">
              <Input
                placeholder="/path/to/repos or ~/projects"
                value={newDir}
                onChange={e => setNewDir(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addDir()}
                className={`text-xs font-mono ${isDirDuplicate ? 'border-destructive' : ''}`}
              />
              <Button size="sm" onClick={addDir} disabled={adding || !newDir.trim() || isDirDuplicate}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {isDirDuplicate && (
              <p className="text-xs text-destructive">This directory is already in the list</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RepoGrid() {
  const [repos, setRepos] = useState<RepoInfo[]>([])
  const [scanDirs, setScanDirs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [cloneOpen, setCloneOpen] = useState(false)

  const load = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    fetch('/api/repos')
      .then(r => r.json())
      .then(data => {
        setRepos(data.repos || [])
        setScanDirs(data.scanDirs || [])
        if (isRefresh) toast.success(`Refreshed ${data.repos?.length || 0} repos`)
      })
      .catch(() => isRefresh && toast.error('Failed to refresh repos'))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }

  useEffect(() => { load() }, [])

  const filtered = repos.filter(r =>
    !filter || r.name.toLowerCase().includes(filter.toLowerCase())
  )

  const dirtyCount = repos.filter(r => r.isDirty).length
  const errorCount = repos.filter(r => r.error).length
  const behindCount = repos.filter(r => r.behind > 0).length

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1 max-w-sm" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter repos..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
          <FolderPlus className="h-4 w-4 mr-2" />
          Manage Dirs
        </Button>
        <Button variant="outline" size="sm" onClick={() => setCloneOpen(true)}>
          <GitFork className="h-4 w-4 mr-2" />
          Clone Repo
        </Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto flex-wrap">
          <Badge variant="outline">{filtered.length} repos</Badge>
          {dirtyCount > 0 && <Badge className="bg-yellow-400/10 text-yellow-400 border-yellow-400/30">{dirtyCount} dirty</Badge>}
          {behindCount > 0 && <Badge className="bg-orange-400/10 text-orange-400 border-orange-400/30">{behindCount} behind</Badge>}
          {errorCount > 0 && <Badge variant="destructive">{errorCount} errors</Badge>}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(repo => (
          <RepoCard key={repo.id} repo={repo} onPulled={() => load(true)} />
        ))}
      </div>

      <ManageDirsDialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        scanDirs={scanDirs}
        onAdded={() => load(true)}
        onRemoved={() => load(true)}
      />

      <CloneRepoDialog
        open={cloneOpen}
        onClose={() => setCloneOpen(false)}
        onCloned={() => load(true)}
        existingNames={repos.map(r => r.name)}
      />
    </div>
  )
}
