import { NextRequest, NextResponse } from 'next/server'
import { ptyStore } from '@/lib/pty-store'

export async function POST(req: NextRequest) {
  const { id, cols, rows } = await req.json()
  if (!id || !cols || !rows) {
    return NextResponse.json({ error: 'id, cols, rows required' }, { status: 400 })
  }

  const session = ptyStore.get(id)
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  session.pty.resize(cols, rows)
  return NextResponse.json({ ok: true })
}
