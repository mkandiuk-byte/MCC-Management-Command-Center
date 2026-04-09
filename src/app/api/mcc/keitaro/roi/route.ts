import { NextRequest, NextResponse } from 'next/server'

const KEITARO_URL = process.env.KEITARO_URL
const KEITARO_API_KEY = process.env.KEITARO_API_KEY

async function keitaroReport(body: object) {
  const res = await fetch(`${KEITARO_URL}/admin_api/v1/report/build`, {
    method: 'POST',
    headers: {
      'Api-Key': KEITARO_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

type TrafficLight = 'green' | 'yellow' | 'red'

// Houston traffic light thresholds based on CPA target ratio
function getTrafficLight(cpaRatio: number): TrafficLight {
  if (cpaRatio < 0.95) return 'green'
  if (cpaRatio <= 1.10) return 'yellow'
  return 'red'
}

interface RoiRow {
  grouping: string
  clicks: number
  conversions: number
  revenue: number
  cost: number
  profit: number
  roi: number
  cpa: number
  trafficLight: TrafficLight
}

function parseRows(rows: Record<string, unknown>[], groupKey: string, cpaTarget: number): RoiRow[] {
  return (rows ?? []).map((row) => {
    const cost = Number(row.cost ?? 0)
    const conversions = Number(row.conversions ?? 0)
    const cpa = conversions > 0 ? cost / conversions : 0
    const cpaRatio = cpaTarget > 0 ? cpa / cpaTarget : 0

    return {
      grouping: String(row[groupKey] ?? 'Unknown'),
      clicks: Number(row.clicks ?? 0),
      conversions,
      revenue: Number(row.revenue ?? 0),
      cost,
      profit: Number(row.profit ?? 0),
      roi: Number(row.roi ?? 0),
      cpa: Math.round(cpa * 100) / 100,
      trafficLight: getTrafficLight(cpaRatio),
    }
  })
}

function getMockData() {
  return {
    byGeo: [
      { grouping: 'AU', clicks: 15200, conversions: 228, revenue: 11400, cost: 5700, profit: 5700, roi: 100, cpa: 25.0, trafficLight: 'green' as TrafficLight },
      { grouping: 'NZ', clicks: 4800, conversions: 62, revenue: 3100, cost: 1800, profit: 1300, roi: 72, cpa: 29.0, trafficLight: 'yellow' as TrafficLight },
      { grouping: 'GB', clicks: 8900, conversions: 98, revenue: 4900, cost: 3200, profit: 1700, roi: 53, cpa: 32.7, trafficLight: 'red' as TrafficLight },
    ],
    byOffer: [
      { grouping: 'Offer A (Nutra)', clicks: 12000, conversions: 180, revenue: 9000, cost: 4100, profit: 4900, roi: 120, cpa: 22.8, trafficLight: 'green' as TrafficLight },
      { grouping: 'Offer B (Finance)', clicks: 9500, conversions: 110, revenue: 5500, cost: 3400, profit: 2100, roi: 62, cpa: 30.9, trafficLight: 'yellow' as TrafficLight },
      { grouping: 'Offer C (Sweeps)', clicks: 7400, conversions: 98, revenue: 4900, cost: 3200, profit: 1700, roi: 53, cpa: 32.7, trafficLight: 'red' as TrafficLight },
    ],
    daily: [
      { grouping: '2026-04-07', clicks: 3200, conversions: 48, revenue: 2400, cost: 1100, profit: 1300, roi: 118, cpa: 22.9, trafficLight: 'green' as TrafficLight },
      { grouping: '2026-04-06', clicks: 2900, conversions: 41, revenue: 2050, cost: 1050, profit: 1000, roi: 95, cpa: 25.6, trafficLight: 'yellow' as TrafficLight },
      { grouping: '2026-04-05', clicks: 3400, conversions: 52, revenue: 2600, cost: 1200, profit: 1400, roi: 117, cpa: 23.1, trafficLight: 'green' as TrafficLight },
    ],
    source: 'mock',
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const today = new Date().toISOString().split('T')[0]
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const from = searchParams.get('from') ?? thirtyDaysAgo
    const to = searchParams.get('to') ?? today
    const cpaTarget = Number(searchParams.get('cpa_target') ?? 30)

    if (!KEITARO_URL || !KEITARO_API_KEY) {
      return NextResponse.json(getMockData())
    }

    const baseParams = {
      range: { from, to, timezone: 'Europe/Kiev' },
      columns: [],
      metrics: ['clicks', 'conversions', 'revenue', 'cost', 'profit', 'roi'],
    }

    try {
      const [geoReport, offerReport, dailyReport] = await Promise.all([
        keitaroReport({
          ...baseParams,
          grouping: ['country'],
          sort: [{ name: 'profit', order: 'desc' }],
          limit: 30,
        }),
        keitaroReport({
          ...baseParams,
          grouping: ['offer_id'],
          sort: [{ name: 'profit', order: 'desc' }],
          limit: 30,
        }),
        keitaroReport({
          ...baseParams,
          grouping: ['day'],
          sort: [{ name: 'day', order: 'desc' }],
          limit: 30,
        }),
      ])

      return NextResponse.json({
        byGeo: parseRows(geoReport.rows, 'country', cpaTarget),
        byOffer: parseRows(offerReport.rows, 'offer_id', cpaTarget),
        daily: parseRows(dailyReport.rows, 'day', cpaTarget),
        source: 'keitaro_api',
      })
    } catch {
      return NextResponse.json(getMockData())
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
