"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Terminal, Key, Plus, Trash2, RefreshCw, Cloud, User, FolderCode, Globe } from "lucide-react"
import { toast } from "sonner"

interface McpServer {
  name: string
  command?: string
  args: string[]
  env: string[]
  scope: 'user' | 'project' | 'cloud'
  type?: string
  url?: string
}

const SCOPE_META = {
  user: { label: 'User', icon: User, color: 'text-blue-400 border-blue-400/30 bg-blue-400/10' },
  project: { label: 'Project', icon: FolderCode, color: 'text-green-400 border-green-400/30 bg-green-400/10' },
  cloud: { label: 'Cloud', icon: Cloud, color: 'text-purple-400 border-purple-400/30 bg-purple-400/10' },
}

function ScopeBadge({ scope }: { scope: 'user' | 'project' | 'cloud' }) {
  const meta = SCOPE_META[scope]
  const Icon = meta.icon
  return (
    <Badge variant="outline" className={`text-[10px] h-4 px-1.5 gap-1 ${meta.color}`}>
      <Icon className="h-2.5 w-2.5" />
      {meta.label}
    </Badge>
  )
}

function AddServerDialog({
  open,
  onClose,
  onAdded,
  existingNames = [],
}: {
  open: boolean
  onClose: () => void
  onAdded: () => void
  existingNames?: string[]
}) {
  const [name, setName] = useState("")
  const [command, setCommand] = useState("")
  const [argsStr, setArgsStr] = useState("")
  const [scope, setScope] = useState<'project' | 'user'>('user')
  const [serverType, setServerType] = useState<'stdio' | 'http'>('stdio')
  const [url, setUrl] = useState("")
  const [saving, setSaving] = useState(false)

  const reset = () => { setName(""); setCommand(""); setArgsStr(""); setUrl("") }
  const isDuplicate = Boolean(name.trim()) && existingNames.includes(name.trim())

  const save = async () => {
    if (!name.trim()) { toast.error("Name is required"); return }
    if (serverType === 'http' && !url.trim()) { toast.error("URL is required for HTTP type"); return }
    if (serverType === 'stdio' && !command.trim()) { toast.error("Command is required"); return }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        scope,
        type: serverType,
      }
      if (serverType === 'http') {
        body.url = url.trim()
      } else {
        body.command = command.trim()
        body.args = argsStr.trim() ? argsStr.split(/\s+/).filter(Boolean) : []
      }
      const res = await fetch('/api/claude/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success(`Added: ${name.trim()}`)
      reset()
      onAdded()
      onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to add server')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add MCP Server</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Name *</label>
            <Input
              placeholder="e.g. my-server"
              value={name}
              onChange={e => setName(e.target.value)}
              className={isDuplicate ? 'border-destructive' : ''}
            />
            {isDuplicate && (
              <p className="text-xs text-destructive">Server &quot;{name.trim()}&quot; already exists</p>
            )}
          </div>

          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Scope</label>
              <div className="flex gap-1">
                {(['user', 'project'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    className={`flex-1 text-xs px-2 py-1.5 rounded-md border transition-colors ${
                      scope === s
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-input hover:bg-accent'
                    }`}
                  >
                    {s === 'user' ? 'User (global)' : 'Project'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Type</label>
              <div className="flex gap-1">
                {(['stdio', 'http'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setServerType(t)}
                    className={`flex-1 text-xs px-2 py-1.5 rounded-md border transition-colors ${
                      serverType === t
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-input hover:bg-accent'
                    }`}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {serverType === 'http' ? (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">URL *</label>
              <Input
                placeholder="http://localhost:8000/mcp/"
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Command *</label>
                <Input
                  placeholder="e.g. npx, node, uvx"
                  value={command}
                  onChange={e => setCommand(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Arguments</label>
                <Input
                  placeholder="-y @package/server arg2 arg3"
                  value={argsStr}
                  onChange={e => setArgsStr(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => { reset(); onClose() }}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving || isDuplicate}>
            {saving ? 'Adding...' : 'Add Server'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ServerCard({
  server,
  onDelete,
}: {
  server: McpServer
  onDelete: (name: string) => void
}) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (server.scope === 'cloud') {
      toast.info('Cloud connectors are managed via claude.ai settings')
      return
    }
    if (!confirm(`Remove MCP server "${server.name}"?`)) return
    setDeleting(true)
    try {
      const res = await fetch('/api/claude/mcp', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: server.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success(`Removed: ${server.name}`)
      onDelete(server.name)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove server')
    } finally {
      setDeleting(false)
    }
  }

  const cmdLine = server.type === 'http'
    ? server.url
    : `${server.command || ''} ${(server.args || []).slice(0, 3).join(' ')}${(server.args || []).length > 3 ? ` ...+${server.args.length - 3}` : ''}`

  return (
    <Card className="hover:bg-accent/20 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {server.type === 'http' || server.scope === 'cloud'
              ? <Globe className="h-4 w-4 text-purple-400 shrink-0" />
              : <Terminal className="h-4 w-4 text-red-400 shrink-0" />
            }
            <CardTitle className="text-sm truncate">{server.name}</CardTitle>
            <ScopeBadge scope={server.scope} />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={`h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive ${server.scope === 'cloud' ? 'opacity-30 cursor-not-allowed' : ''}`}
            onClick={handleDelete}
            disabled={deleting || server.scope === 'cloud'}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        {cmdLine && (
          <CardDescription className="text-xs font-mono truncate mt-1">
            {cmdLine}
          </CardDescription>
        )}
      </CardHeader>
      {server.env && server.env.length > 0 && (
        <CardContent className="pt-0 pb-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Key className="h-3 w-3 shrink-0" />
            <span className="truncate">Env: {server.env.join(', ')}</span>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export function McpServersList() {
  const [servers, setServers] = useState<McpServer[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    fetch('/api/claude/mcp')
      .then(r => r.json())
      .then(data => {
        setServers(data.servers || [])
        if (isRefresh) toast.success(`Refreshed — ${data.servers?.length || 0} servers`)
      })
      .catch(() => isRefresh && toast.error('Failed to refresh'))
      .finally(() => { setLoading(false); setRefreshing(false) })
  }

  useEffect(() => { load() }, [])

  const handleDelete = (name: string) => setServers(prev => prev.filter(s => s.name !== name))

  const userCount = servers.filter(s => s.scope === 'user').length
  const projectCount = servers.filter(s => s.scope === 'project').length
  const cloudCount = servers.filter(s => s.scope === 'cloud').length

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <Badge variant="outline">{servers.length} total</Badge>
          {userCount > 0 && <Badge variant="outline" className="text-blue-400 border-blue-400/30 bg-blue-400/10">{userCount} user</Badge>}
          {projectCount > 0 && <Badge variant="outline" className="text-green-400 border-green-400/30 bg-green-400/10">{projectCount} project</Badge>}
          {cloudCount > 0 && <Badge variant="outline" className="text-purple-400 border-purple-400/30 bg-purple-400/10">{cloudCount} cloud</Badge>}
        </div>
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Server
        </Button>
      </div>

      {servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Terminal className="h-8 w-8 mb-3 opacity-40" />
          <p className="text-sm">No MCP servers configured</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />Add your first server
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {servers.map(server => (
            <ServerCard key={`${server.scope}-${server.name}`} server={server} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <AddServerDialog open={addOpen} onClose={() => setAddOpen(false)} onAdded={() => load()} existingNames={servers.map(s => s.name)} />
    </div>
  )
}
