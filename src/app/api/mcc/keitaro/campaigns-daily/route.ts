import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const KEITARO_URL = process.env.KEITARO_URL
const KEITARO_API_KEY = process.env.KEITARO_API_KEY

// ---------------------------------------------------------------------------
// In-memory cache (5 min TTL)
// ---------------------------------------------------------------------------
let cache: { data: unknown; ts: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toDateStr(iso: string): string {
  return iso.slice(0, 10)
}

function last30DaysDates(): string[] {
  const dates: string[] = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

const SOURCE_EMOJI_MAP: Record<string, string> = {
  '\uD83D\uDFE6': 'FB',
  '\uD83D\uDFE9': 'GDN',
  '\uD83D\uDFE8': 'UAC',
  '\uD83D\uDFE5': 'TikTok',
  '\uD83D\uDFEA': 'Native',
  '\uD83D\uDFE7': 'Push',
  '\u2B1C': 'Other',
}

function parseSource(name: string): string {
  // Check for emoji prefix
  for (const [emoji, source] of Object.entries(SOURCE_EMOJI_MAP)) {
    if (name.startsWith(emoji)) return source
  }
  // Check for common text markers
  const lower = name.toLowerCase()
  if (lower.includes('[fb]') || lower.includes('facebook')) return 'FB'
  if (lower.includes('[gdn]') || lower.includes('google')) return 'GDN'
  if (lower.includes('[uac]')) return 'UAC'
  if (lower.includes('[tt]') || lower.includes('tiktok')) return 'TikTok'
  if (lower.includes('[native]')) return 'Native'
  if (lower.includes('[push]')) return 'Push'
  return 'Other'
}

// ---------------------------------------------------------------------------
// Fallback data
// ---------------------------------------------------------------------------
function fallbackData() {
  const dates = last30DaysDates()
  return {
    campaignsPerDay: dates.map((date) => ({
      date,
      created: Math.floor(Math.random() * 20) + 5,
      killed: Math.floor(Math.random() * 8),
    })),
    campaignsBySource: { FB: 5000, GDN: 800, UAC: 400, TikTok: 200, Native: 100, Push: 50, Other: 300 },
    totalActive: 8463,
    totalKilled30d: 120,
    totalCreated30d: 450,
    avgCreatedPerDay: 15,
    avgKilledPerDay: 4,
    killRate: 26.7,
    updatedAt: new Date().toISOString(),
    source: 'fallback' as const,
  }
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------
export async function GET() {
  // Return cache if fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  try {
    if (!KEITARO_URL || !KEITARO_API_KEY) {
      throw new Error('Keitaro not configured')
    }

    // Fetch all campaigns
    const res = await fetch(`${KEITARO_URL}/admin_api/v1/campaigns?limit=500`, {
      headers: {
        'Api-Key': KEITARO_API_KEY,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`Keitaro ${res.status}`)
    const campaigns: any[] = await res.json()

    const dates = last30DaysDates()
    const dateSet = new Set(dates)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

    // Group created campaigns by day (last 30 days)
    const createdByDay: Record<string, number> = {}
    for (const d of dates) createdByDay[d] = 0

    // Group killed campaigns by day (use updated_at for killed date)
    const killedByDay: Record<string, number> = {}
    for (const d of dates) killedByDay[d] = 0

    let totalActive = 0
    let totalKilled30d = 0
    let totalCreated30d = 0
    const sourceMap: Record<string, number> = {}

    for (const c of campaigns) {
      // Count by source
      const source = parseSource(c.name ?? '')
      sourceMap[source] = (sourceMap[source] ?? 0) + 1

      // Active count
      if (c.state === 'active') {
        totalActive++
      }

      // Created in last 30 days
      const createdDate = c.created_at ? toDateStr(c.created_at) : null
      if (createdDate && dateSet.has(createdDate)) {
        createdByDay[createdDate] = (createdByDay[createdDate] ?? 0) + 1
        totalCreated30d++
      }

      // Killed in last 30 days (state not active, updated_at in range)
      if (c.state !== 'active' && c.updated_at && c.updated_at >= thirtyDaysAgo) {
        totalKilled30d++
        const killedDate = toDateStr(c.updated_at)
        if (dateSet.has(killedDate)) {
          killedByDay[killedDate] = (killedByDay[killedDate] ?? 0) + 1
        }
      }
    }

    const campaignsPerDay = dates.map((date) => ({
      date,
      created: createdByDay[date] ?? 0,
      killed: killedByDay[date] ?? 0,
    }))

    const avgCreatedPerDay = totalCreated30d > 0 ? Math.round((totalCreated30d / 30) * 10) / 10 : 0
    const avgKilledPerDay = totalKilled30d > 0 ? Math.round((totalKilled30d / 30) * 10) / 10 : 0
    const killRate = totalCreated30d > 0
      ? Math.round((totalKilled30d / totalCreated30d) * 1000) / 10
      : 0

    const data = {
      campaignsPerDay,
      campaignsBySource: sourceMap,
      totalActive,
      totalKilled30d,
      totalCreated30d,
      avgCreatedPerDay,
      avgKilledPerDay,
      killRate,
      updatedAt: new Date().toISOString(),
      source: 'keitaro' as const,
    }

    cache = { data, ts: Date.now() }
    return NextResponse.json(data)
  } catch (err) {
    console.error('[mcc/keitaro/campaigns-daily]', err)
    const data = fallbackData()
    cache = { data, ts: Date.now() }
    return NextResponse.json(data)
  }
}
