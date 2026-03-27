import type { IPty } from 'node-pty'

export interface PtySession {
  pty: IPty
  output: string[]
  subscribers: Set<(data: string) => void>
  createdAt: number
}

// Global PTY store — survives individual request lifecycles
export const ptyStore = new Map<string, PtySession>()

// Cleanup stale sessions older than 2 hours
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000
  for (const [id, session] of ptyStore) {
    if (session.createdAt < cutoff) {
      try { session.pty.kill() } catch { /* already dead */ }
      ptyStore.delete(id)
    }
  }
}, 10 * 60 * 1000)
