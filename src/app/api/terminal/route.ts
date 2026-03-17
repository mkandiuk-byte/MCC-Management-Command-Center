import { NextRequest, NextResponse } from 'next/server'
import os from 'os'
import { randomUUID } from 'crypto'
import { ptyStore } from '@/lib/pty-store'

const CLAUDE_WORKSPACE = process.env.CLAUDE_PATH ?? ''
const HOME = os.homedir()

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const targetCwd = body.cwd || CLAUDE_WORKSPACE
  const context = body.context as string | undefined

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pty = require('node-pty')

  // Use HOME as starting cwd — more reliable in launchd/service contexts
  // The shell will cd to target directory after startup
  const shell = '/bin/zsh'
  const id = randomUUID()

  let proc
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    return NextResponse.json({ error: `Failed to spawn shell: ${msg}` }, { status: 500 })
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

  proc.onExit(() => {
    ptyStore.delete(id)
  })

  ptyStore.set(id, session)

  // Navigate to target dir, then start Claude
  setTimeout(() => {
    if (!ptyStore.has(id)) return
    proc.write(`cd "${targetCwd}" && clear\n`)
    setTimeout(() => {
      if (!ptyStore.has(id)) return
      proc.write('claude --dangerously-skip-permissions\n')
      if (context) {
        setTimeout(() => {
          if (!ptyStore.has(id)) return
          proc.write(context + '\n')
        }, 5000)
      }
    }, 600)
  }, 400)

  return NextResponse.json({ id })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}))
  const session = ptyStore.get(id)
  if (!session) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  session.pty.kill()
  ptyStore.delete(id)
  return NextResponse.json({ ok: true })
}
