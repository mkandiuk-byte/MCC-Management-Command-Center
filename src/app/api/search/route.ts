import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/search-store'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ results: [] })

  try {
    const store = await getStore()
    const results = await store.searchLex(q, { limit: 30 })
    return NextResponse.json({ results })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    // If no index yet, return empty
    if (msg.includes('no such table') || msg.includes('empty')) {
      return NextResponse.json({ results: [], needsIndex: true })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/search — trigger reindex
export async function POST() {
  try {
    const store = await getStore()
    let indexed = 0
    await store.update({
      onProgress: ({ current }: { current: number }) => { indexed = current },
    })
    return NextResponse.json({ ok: true, indexed })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
