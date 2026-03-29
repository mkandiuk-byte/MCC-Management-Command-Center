"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Square, Maximize2, Minimize2, Terminal } from "lucide-react"
import { toast } from "sonner"

type Status = 'idle' | 'connecting' | 'running' | 'dead'

const SESSION_KEY = 'claude-terminal-session-id'

interface ClaudeTerminalProps {
  autoStart?: boolean
  context?: string
}

export function ClaudeTerminal({ autoStart = true, context }: ClaudeTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<import('@xterm/xterm').Terminal | null>(null)
  const fitRef = useRef<import('@xterm/addon-fit').FitAddon | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [fullscreen, setFullscreen] = useState(false)

  const sendInput = useCallback((data: string) => {
    const id = sessionIdRef.current
    if (!id) return
    fetch('/api/terminal/input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, data }),
    }).catch(() => {})
  }, [])

  // Disconnect SSE only — PTY stays alive on server
  const disconnect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
  }, [])

  // Full kill — terminate PTY and clear stored session
  const killSession = useCallback((id?: string) => {
    disconnect()
    const target = id ?? sessionIdRef.current
    if (target) {
      fetch('/api/terminal', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: target }),
      }).catch(() => {})
      if (target === sessionIdRef.current) sessionIdRef.current = null
    }
    localStorage.removeItem(SESSION_KEY)
  }, [disconnect])

  const attachStream = useCallback((id: string, term: import('@xterm/xterm').Terminal) => {
    disconnect()
    const es = new EventSource(`/api/terminal/stream?id=${id}`)
    esRef.current = es
    es.onmessage = (e) => {
      try { term.write(JSON.parse(e.data)) }
      catch { term.write(e.data) }
    }
    es.onerror = () => {
      setStatus('dead')
      es.close()
    }
  }, [disconnect])

  const createTerminalUI = useCallback(async () => {
    const [{ Terminal: XTerm }, { FitAddon }] = await Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
    ])

    if (termRef.current) termRef.current.dispose()
    if (containerRef.current) containerRef.current.innerHTML = ''

    const term = new XTerm({
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      theme: {
        background: '#0d0d0d',
        foreground: '#e0e0e0',
        cursor: '#a0a0a0',
        selectionBackground: '#3a3a3a',
        black: '#1a1a1a',
        red: '#e06c75',
        green: '#98c379',
        yellow: '#e5c07b',
        blue: '#61afef',
        magenta: '#c678dd',
        cyan: '#56b6c2',
        white: '#abb2bf',
        brightBlack: '#5c6370',
        brightRed: '#e06c75',
        brightGreen: '#98c379',
        brightYellow: '#e5c07b',
        brightBlue: '#61afef',
        brightMagenta: '#c678dd',
        brightCyan: '#56b6c2',
        brightWhite: '#ffffff',
      },
      cursorBlink: true,
      allowTransparency: false,
      scrollback: 5000,
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    if (containerRef.current) term.open(containerRef.current)
    fit.fit()
    term.onData(sendInput)

    termRef.current = term
    fitRef.current = fit
    return term
  }, [sendInput])

  // Try to reconnect to an existing session (buffered output replays)
  const reconnect = useCallback(async (id: string): Promise<boolean> => {
    try {
      // Ping the stream — if session is dead, SSE will immediately error
      const res = await fetch(`/api/terminal/stream?id=${id}`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      })
      if (!res.ok) return false
      res.body?.cancel()
      return true
    } catch {
      return false
    }
  }, [])

  const start = useCallback(async (forceNew = false) => {
    if (!containerRef.current) return
    setStatus('connecting')

    const term = await createTerminalUI()

    // Try existing session first (unless force-new)
    if (!forceNew) {
      const savedId = localStorage.getItem(SESSION_KEY)
      if (savedId) {
        const alive = await reconnect(savedId)
        if (alive) {
          sessionIdRef.current = savedId
          setStatus('running')
          attachStream(savedId, term)
          return
        }
        // Session is dead — fall through to spawn new
        localStorage.removeItem(SESSION_KEY)
      }
    }

    // Spawn new PTY session
    let id: string
    try {
      const res = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to spawn terminal')
      id = data.id
    } catch (e) {
      term.writeln('\x1b[31mFailed to start terminal session\x1b[0m')
      setStatus('dead')
      return
    }

    sessionIdRef.current = id
    localStorage.setItem(SESSION_KEY, id)
    setStatus('running')
    attachStream(id, term)
  }, [attachStream, context, createTerminalUI, reconnect])

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(() => {
      if (fitRef.current && termRef.current && sessionIdRef.current) {
        fitRef.current.fit()
        const { cols, rows } = termRef.current
        fetch('/api/terminal/resize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: sessionIdRef.current, cols, rows }),
        }).catch(() => {})
      }
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (autoStart) start()
    // On unmount: only disconnect SSE stream, PTY stays alive on server
    return () => {
      disconnect()
      termRef.current?.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stop = () => {
    killSession()
    if (termRef.current) {
      termRef.current.writeln('\x1b[31m\r\n[Session terminated]\x1b[0m')
    }
    setStatus('dead')
    toast.info('Terminal session ended')
  }

  const restart = async () => {
    killSession()
    toast.info('Starting new session...')
    await start(true)
  }

  const statusColor = {
    idle: 'text-muted-foreground border-border',
    connecting: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
    running: 'text-green-400 border-green-400/30 bg-green-400/10',
    dead: 'text-red-400 border-red-400/30 bg-red-400/10',
  }[status]

  return (
    <div className={`flex flex-col ${fullscreen ? 'fixed inset-0 z-50 bg-background' : 'h-full min-h-0'}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-card shrink-0">
        <Terminal className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Claude Terminal</span>
        <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ml-1 ${statusColor}`}>
          {status}
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          {status === 'running' && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={stop} title="Stop session">
              <Square className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={restart} title="New session">
            <RefreshCw className={`h-3.5 w-3.5 ${status === 'connecting' ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFullscreen(f => !f)} title="Toggle fullscreen">
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-[#0d0d0d]">
        <div
          ref={containerRef}
          className="w-full h-full p-2"
          style={{ contain: 'strict' }}
        />
      </div>
    </div>
  )
}
