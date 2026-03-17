import { NextRequest, NextResponse } from 'next/server'
import { ptyStore } from '@/lib/pty-store'

export async function POST(req: NextRequest) {
  const { id, data } = await req.json()
  if (!id || data === undefined) {
    return NextResponse.json({ error: 'id and data required' }, { status: 400 })
  }

  const session = ptyStore.get(id)
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  session.pty.write(data)
  return NextResponse.json({ ok: true })
}
