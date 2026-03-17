import type { IPty } from 'node-pty'

export interface PtySession {
  pty: IPty
  output: string[]
  subscribers: Set<(data: string) => void>
  createdAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var __ptyStore: Map<string, PtySession> | undefined
}

if (!global.__ptyStore) {
  global.__ptyStore = new Map()
}

export const ptyStore = global.__ptyStore
