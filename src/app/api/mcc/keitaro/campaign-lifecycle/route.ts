import { NextRequest, NextResponse } from 'next/server'

const KEITARO_URL = process.env.KEITARO_URL
const KEITARO_API_KEY = process.env.KEITARO_API_KEY

type LifecycleStage = 'test' | 'active' | 'scaled' | 'killed' | 'optimized'

interface CampaignEntry {
  id: number
  name: string
  state: string
  stage: LifecycleStage
  spend: number
  revenue: number
  profit: number
  roi: number
  clicks: number
  conversions: number
  createdAt: string
  lifespanDays: number
}

async function keitaroFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (!KEITARO_URL || !KEITARO_API_KEY) throw new Error('Keitaro not configured')
  const res = await fetch(`${KEITARO_URL}${path}`, {
    ...options,
    headers: {
      'Api-Key': KEITARO_API_KEY,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Keitaro ${res.status}: ${path}`)
  return res.json()
}

async function keitaroReport(body: object) {
  return keitaroFetch<{ rows?: Record<string, unknown>[] }>('/admin_api/v1/report/build', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function classifyStage(campaign: {
  state: string
  spend: number
  roi: number
  lifespanDays: number
  createdAt: string
}): LifecycleStage {
  const { state, spend, roi, lifespanDays } = campaign

  // Killed: inactive campaigns
  if (state !== 'active') return 'killed'

  // Test: very new or low spend and recent
  if (lifespanDays < 3 || (spend < 500 && lifespanDays < 7)) return 'test'

  // Optimized: profitable, mature, meaningful spend
  if (roi > 0 && lifespanDays > 14 && spend > 500) return 'optimized'

  // Scaled: high spend, running for a while
  if (spend > 1000 && lifespanDays > 7) return 'scaled'

  // Active: everything else that's active
  return 'active'
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const today = new Date().toISOString().split('T')[0]
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const from = searchParams.get('from') ?? thirtyDaysAgo
    const to = searchParams.get('to') ?? today

    // Fetch campaigns list and 30-day report in parallel
    const [campaignsList, report] = await Promise.all([
      keitaroFetch<Array<{ id: number; name: string; state: string; created_at?: string }>>(
        '/admin_api/v1/campaigns?limit=500'
      ),
      keitaroReport({
        range: { from, to, timezone: 'Europe/Kiev' },
        columns: [],
        metrics: ['clicks', 'conversions', 'revenue', 'cost', 'profit', 'roi'],
        grouping: ['campaign'],
        sort: [{ name: 'cost', order: 'desc' }],
        limit: 500,
      }),
    ])

    const now = Date.now()
    const rows = report.rows ?? []

    // Build a map of report data keyed by campaign name
    const reportMap = new Map<string, Record<string, unknown>>()
    for (const row of rows) {
      const name = String(row.campaign ?? '')
      if (name) reportMap.set(name, row)
    }

    // Build a lookup of campaign metadata by name
    const campaignMeta = new Map<string, { id: number; state: string; createdAt: string }>()
    for (const c of campaignsList) {
      campaignMeta.set(c.name, {
        id: c.id,
        state: c.state,
        createdAt: c.created_at ?? today,
      })
    }

    const campaigns: CampaignEntry[] = []

    // Merge report rows with campaign metadata
    const allNames = new Set([...reportMap.keys(), ...campaignMeta.keys()])
    for (const name of allNames) {
      const meta = campaignMeta.get(name)
      const row = reportMap.get(name)

      const id = meta?.id ?? 0
      const state = meta?.state ?? 'active'
      const createdAt = meta?.createdAt ?? today
      const lifespanDays = Math.max(1, Math.floor((now - new Date(createdAt).getTime()) / 86400000))

      const spend = Number(row?.cost ?? 0)
      const revenue = Number(row?.revenue ?? 0)
      const profit = revenue - spend
      const roi = spend > 0 ? (profit / spend) * 100 : 0

      const stage = classifyStage({ state, spend, roi, lifespanDays, createdAt })

      campaigns.push({
        id,
        name,
        state,
        stage,
        spend: Math.round(spend),
        revenue: Math.round(revenue),
        profit: Math.round(profit),
        roi: Math.round(roi * 10) / 10,
        clicks: Number(row?.clicks ?? 0),
        conversions: Number(row?.conversions ?? 0),
        createdAt,
        lifespanDays,
      })
    }

    // Group by stage
    const stageGroups: Record<LifecycleStage, CampaignEntry[]> = {
      test: [],
      active: [],
      scaled: [],
      killed: [],
      optimized: [],
    }

    for (const c of campaigns) {
      stageGroups[c.stage].push(c)
    }

    // Sort each stage by spend descending
    for (const stage of Object.keys(stageGroups) as LifecycleStage[]) {
      stageGroups[stage].sort((a, b) => b.spend - a.spend)
    }

    // Stage counts
    const stages = {
      test: stageGroups.test.length,
      active: stageGroups.active.length,
      scaled: stageGroups.scaled.length,
      killed: stageGroups.killed.length,
      optimized: stageGroups.optimized.length,
    }

    // Totals
    const totals = {
      totalCampaigns: campaigns.length,
      totalSpend: campaigns.reduce((s, c) => s + c.spend, 0),
      totalRevenue: campaigns.reduce((s, c) => s + c.revenue, 0),
      totalProfit: campaigns.reduce((s, c) => s + c.profit, 0),
      avgRoi: 0,
    }
    totals.avgRoi = totals.totalSpend > 0
      ? Math.round(((totals.totalProfit / totals.totalSpend) * 100) * 10) / 10
      : 0

    // Top 10 per stage for the response
    const topCampaigns: Record<LifecycleStage, CampaignEntry[]> = {
      test: stageGroups.test.slice(0, 10),
      active: stageGroups.active.slice(0, 10),
      scaled: stageGroups.scaled.slice(0, 10),
      killed: stageGroups.killed.slice(0, 10),
      optimized: stageGroups.optimized.slice(0, 10),
    }

    return NextResponse.json({
      stages,
      campaigns: topCampaigns,
      totals,
      source: 'keitaro_api',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[campaign-lifecycle] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
