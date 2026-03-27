import type { FastifyInstance } from 'fastify'
import os from 'os'
import { randomUUID } from 'crypto'
import { ptyStore } from '../pty-store.js'

const CLAUDE_WORKSPACE = process.env.CLAUDE_PATH ?? ''
const HOME = os.homedir()

export async function terminalRoutes(app: FastifyInstance) {
  // POST /api/terminal — create session
  app.post('/', async (req, reply) => {
    const body = (req.body ?? {}) as { cwd?: string; context?: string }
    const targetCwd = body.cwd || CLAUDE_WORKSPACE

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pty = require('node-pty')
    const shell = '/bin/zsh'
    const id = randomUUID()

    let proc
    try {
      const { CLAUDECODE: _cc, ...cleanEnv } = process.env
      proc = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 220,
        rows: 50,
        cwd: HOME,
        env: {
          ...cleanEnv,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          HOME,
          SHELL: shell,
          PATH: `/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH || ''}`,
        },
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.status(500).send({ error: `Failed to spawn shell: ${msg}` })
    }

    const session = {
      pty: proc,
      output: [] as string[],
      subscribers: new Set<(data: string) => void>(),
      createdAt: Date.now(),
    }

    proc.onData((data: string) => {
      if (session.output.length > 2000) session.output.shift()
      session.output.push(data)
      session.subscribers.forEach(fn => fn(data))
    })

    proc.onExit(() => { ptyStore.delete(id) })

    ptyStore.set(id, session)

    setTimeout(() => {
      if (!ptyStore.has(id)) return
      proc.write(`cd "${targetCwd}" && clear\n`)
      setTimeout(() => {
        if (!ptyStore.has(id)) return
        proc.write('claude --dangerously-skip-permissions\n')
        if (body.context) {
          setTimeout(() => {
            if (!ptyStore.has(id)) return
            proc.write(body.context + '\n')
          }, 5000)
        }
      }, 600)
    }, 400)

    return { id }
  })

  // DELETE /api/terminal — kill session
  app.delete('/', async (req, reply) => {
    const { id } = (req.body ?? {}) as { id?: string }
    const session = ptyStore.get(id ?? '')
    if (!session) return reply.status(404).send({ ok: false, error: 'Not found' })
    session.pty.kill()
    ptyStore.delete(id!)
    return { ok: true }
  })

  // GET /api/terminal/stream?id=... — SSE stream
  app.get('/stream', async (req, reply) => {
    const id = (req.query as { id?: string }).id
    if (!id) return reply.status(400).send('Missing id')

    const session = ptyStore.get(id)
    if (!session) return reply.status(404).send('Session not found')

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')
    reply.raw.flushHeaders()

    const send = (data: string) => {
      try {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
      } catch { /* client disconnected */ }
    }

    // Flush buffered output
    for (const chunk of session.output) send(chunk)

    session.subscribers.add(send)

    req.raw.on('close', () => {
      session.subscribers.delete(send)
    })

    // Keep connection open
    await new Promise<void>(resolve => req.raw.on('close', resolve))
  })

  // POST /api/terminal/input
  app.post('/input', async (req, reply) => {
    const { id, data } = (req.body ?? {}) as { id?: string; data?: string }
    if (!id || data === undefined) return reply.status(400).send({ error: 'id and data required' })
    const session = ptyStore.get(id)
    if (!session) return reply.status(404).send({ error: 'Session not found' })
    session.pty.write(data)
    return { ok: true }
  })

  // POST /api/terminal/resize
  app.post('/resize', async (req, reply) => {
    const { id, cols, rows } = (req.body ?? {}) as { id?: string; cols?: number; rows?: number }
    if (!id || !cols || !rows) return reply.status(400).send({ error: 'id, cols, rows required' })
    const session = ptyStore.get(id)
    if (!session) return reply.status(404).send({ error: 'Session not found' })
    session.pty.resize(cols, rows)
    return { ok: true }
  })
}
