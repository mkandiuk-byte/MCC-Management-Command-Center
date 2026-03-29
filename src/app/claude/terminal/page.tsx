"use client"

import { useEffect, useState, useRef } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ClaudeTerminal } from "@/components/claude-terminal"

interface RepoInfo {
  name: string
  branch: string
  isDirty: boolean
  behind: number
  ahead: number
  error?: string
}

interface McpServer {
  name: string
  scope: 'user' | 'project' | 'cloud'
  type?: string
}

function buildContext(repos: RepoInfo[], mcpServers: McpServer[]): string {
  const dirty = repos.filter(r => r.isDirty)
  const behind = repos.filter(r => r.behind > 0)
  const errors = repos.filter(r => r.error)

  const lines = [
    'You are running inside AAP Panel — a local admin dashboard for the development workspace.',
    '',
    `📁 Repos scanned: ${repos.length} total` +
      (dirty.length ? `, ${dirty.length} dirty (${dirty.map(r => r.name).join(', ')})` : '') +
      (behind.length ? `, ${behind.length} behind remote` : '') +
      (errors.length ? `, ${errors.length} with errors` : ''),
    '',
    `🔌 MCP Servers configured: ${mcpServers.length}` +
      ` (${mcpServers.filter(s => s.scope === 'user').length} user, ` +
      `${mcpServers.filter(s => s.scope === 'project').length} project, ` +
      `${mcpServers.filter(s => s.scope === 'cloud').length} cloud)`,
    '',
    `Working directory: ${process.env.CLAUDE_PATH ?? ''}`,
    '',
    'How can I help you with the workspace?',
  ]
  return lines.join('\n')
}

export default function ClaudeTerminalPage() {
  const [context, setContext] = useState<string | undefined>(undefined)
  const [ready, setReady] = useState(false)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    Promise.all([
      fetch('/api/repos').then(r => r.json()).catch(() => ({ repos: [] })),
      fetch('/api/claude/mcp').then(r => r.json()).catch(() => ({ servers: [] })),
    ]).then(([repoData, mcpData]) => {
      const ctx = buildContext(repoData.repos || [], mcpData.servers || [])
      setContext(ctx)
      setReady(true)
    })
  }, [])

  return (
    <div className="flex flex-col" style={{ height: '100vh' }}>
      <header className="flex items-center gap-2 px-6 py-4 border-b shrink-0">
        <SidebarTrigger />
        <div>
          <h1 className="text-xl font-semibold">Claude Terminal</h1>
          <p className="text-sm text-muted-foreground">Interactive Claude session with workspace context</p>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-hidden">
        {ready
          ? <ClaudeTerminal autoStart context={context} />
          : (
            <div className="flex items-center justify-center h-full gap-2 text-muted-foreground text-sm">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Loading workspace context...
            </div>
          )
        }
      </div>
    </div>
  )
}
