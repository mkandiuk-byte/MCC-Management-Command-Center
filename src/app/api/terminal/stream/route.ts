import { NextRequest } from 'next/server'
import { ptyStore } from '@/lib/pty-store'

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) {
    return new Response('Missing id', { status: 400 })
  }

  const session = ptyStore.get(id)
  if (!session) {
    return new Response('Session not found', { status: 404 })
  }

  const encoder = new TextEncoder()
  const stream = new TransformStream<Uint8Array, Uint8Array>()
  const writer = stream.writable.getWriter()

  const send = (data: string) => {
    try {
      writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
    } catch {
      // writer closed
    }
  }

  // Flush buffered output
  for (const chunk of session.output) {
    send(chunk)
  }

  // Subscribe to new data
  session.subscribers.add(send)

  req.signal.addEventListener('abort', () => {
    session.subscribers.delete(send)
    writer.close().catch(() => {})
  })

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
