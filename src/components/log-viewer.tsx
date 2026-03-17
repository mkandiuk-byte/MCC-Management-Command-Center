"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { RefreshCw, ChevronDown } from "lucide-react"

const LOG_OPTIONS = [
  { id: 'sync', label: 'Sync Log' },
  { id: 'aap-panel', label: 'AAP Panel' },
  { id: 'aap-panel-error', label: 'Panel Errors' },
  { id: 'sita', label: 'Sita Monitor' },
]

function classifyLine(line: string): string {
  const lower = line.toLowerCase()
  if (lower.includes('error') || lower.includes('err ') || lower.includes('failed')) return 'text-red-400'
  if (lower.includes('warn') || lower.includes('warning')) return 'text-yellow-400'
  if (lower.includes('success') || lower.includes('done') || lower.includes('ok')) return 'text-green-400'
  if (lower.includes('info') || lower.includes('start')) return 'text-blue-400'
  return 'text-muted-foreground'
}

export function LogViewer() {
  const [activeLog, setActiveLog] = useState('sync')
  const [lines, setLines] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [logInfo, setLogInfo] = useState<{ total: number; path: string; exists: boolean } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadLog = useCallback(() => {
    fetch(`/api/logs?log=${activeLog}&lines=200`)
      .then(r => r.json())
      .then(data => {
        setLines(data.lines || [])
        setLogInfo({ total: data.total || 0, path: data.path || '', exists: data.exists ?? true })
      })
      .finally(() => setLoading(false))
  }, [activeLog])

  useEffect(() => {
    setLoading(true)
    setLines([])
    loadLog()
  }, [loadLog])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(loadLog, 3000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [autoRefresh, loadLog])

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Log selector tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {LOG_OPTIONS.map(opt => (
          <Button
            key={opt.id}
            variant={activeLog === opt.id ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveLog(opt.id)}
          >
            {opt.label}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Live' : 'Auto'}
          </Button>
          <Button variant="outline" size="sm" onClick={loadLog}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={scrollToBottom}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Log info bar */}
      {logInfo && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono truncate">{logInfo.path}</span>
          <Badge variant="outline" className="shrink-0">
            {lines.length}/{logInfo.total} lines
          </Badge>
          {!logInfo.exists && <Badge variant="destructive" className="shrink-0">not found</Badge>}
        </div>
      )}

      {/* Log content */}
      <ScrollArea className="flex-1 rounded-lg border bg-card/30">
        <div className="p-3 font-mono text-xs">
          {loading ? (
            <div className="space-y-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-4" style={{ width: `${50 + (i * 7) % 50}%` }} />
              ))}
            </div>
          ) : lines.length === 0 ? (
            <p className="text-muted-foreground">No log entries found.</p>
          ) : (
            lines.map((line, i) => (
              <div key={i} className={`leading-5 hover:bg-accent/20 px-1 rounded ${classifyLine(line)}`}>
                {line}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  )
}
