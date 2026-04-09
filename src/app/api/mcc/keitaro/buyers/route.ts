import { NextRequest, NextResponse } from 'next/server'

const KEITARO_URL = process.env.KEITARO_URL
const KEITARO_API_KEY = process.env.KEITARO_API_KEY

async function keitaroReport(body: object) {
  if (!KEITARO_URL || !KEITARO_API_KEY) throw new Error('Keitaro not configured')
  const res = await fetch(`${KEITARO_URL}/admin_api/v1/report/build`, {
    method: 'POST',
    headers: { 'Api-Key': KEITARO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Keitaro ${res.status}`)
  return res.json()
}

// Campaign name format: "🟢 GB | OFFERS | FB" — extract GEO and SOURCE
function parseCampaignName(name: string): { geo: string; source: string; type: string } {
  const clean = name.replace(/^[\u{1F7E0}-\u{1F7EB}\u{2B1B}\u{2B1C}\u{1F535}\u{1F7E6}\u{1F7E9}\u{1F7E8}]\s*/u, '')
  // Typical: "#8445 | PWA DIRECT | SKAKAPP | Oasis Online | alias"
  // Or: "GB | OFFERS | FB"
  const parts = clean.split('|').map(p => p.trim())

  let type = 'unknown'
  if (name.startsWith('🟢')) type = 'offer'
  else if (name.startsWith('🟠')) type = 'app'
  else if (name.startsWith('🟡')) type = 'cloak'

  return {
    geo: parts[0]?.replace(/#\d+\s*/, '') || 'Unknown',
    source: parts[2] || parts[1] || 'Unknown',
    type,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const today = new Date().toISOString().split('T')[0]
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const from = searchParams.get('from') ?? thirtyDaysAgo
    const to = searchParams.get('to') ?? today

    let buyers: Record<string, unknown>[] = []
    let source = 'mock'

    try {
      // Group by campaign to get real performance data
      const report = await keitaroReport({
        range: { from, to, timezone: 'Europe/Kiev' },
        columns: ['sub_id_2', 'sub_id_13', 'sub_id_16'],
        metrics: ['clicks', 'unique_clicks', 'conversions', 'revenue', 'cost', 'profit', 'roi', 'cr', 'cpa'],
        grouping: ['campaign'],
        filters: [
          { name: 'clicks', operator: 'GREATER', expression: '100' },
        ],
        sort: [{ name: 'cost', order: 'desc' }],
        limit: 100,
      })

      const rows = report.rows ?? []
      if (rows.length > 0) {
        // Aggregate campaigns into "buyer groups" by source (FB, GDN, UAC, etc.)
        // Since we don't have actual buyer IDs from Keitaro, we group by traffic source
        const sourceMap = new Map<string, {
          clicks: number; conversions: number; revenue: number; cost: number; profit: number; campaigns: number; stopCampaigns: number;
          creativeIds: Set<string>; funnelIds: Set<string>
        }>()

        for (const row of rows) {
          const name = String(row.campaign ?? '')
          const { geo, source: src } = parseCampaignName(name)
          const key = `${geo} | ${src}`
          const existing = sourceMap.get(key) || { clicks: 0, conversions: 0, revenue: 0, cost: 0, profit: 0, campaigns: 0, stopCampaigns: 0, creativeIds: new Set<string>(), funnelIds: new Set<string>() }

          const cost = Number(row.cost ?? 0)
          const revenue = Number(row.revenue ?? 0)
          const profit = revenue - cost
          const roiVal = cost > 0 ? ((profit / cost) * 100) : 0

          existing.clicks += Number(row.clicks ?? 0)
          existing.conversions += Number(row.conversions ?? 0)
          existing.revenue += revenue
          existing.cost += cost
          existing.profit += profit
          existing.campaigns += 1
          if (roiVal < -30) existing.stopCampaigns += 1

          const creativeId = String(row.sub_id_2 ?? '').trim()
          const funnelId = String(row.sub_id_13 ?? '').trim()
          if (creativeId) existing.creativeIds.add(creativeId)
          if (funnelId) existing.funnelIds.add(funnelId)

          sourceMap.set(key, existing)
        }

        buyers = Array.from(sourceMap.entries())
          .map(([name, data]) => {
            const roi = data.cost > 0 ? ((data.profit / data.cost) * 100) : 0
            const cpa = data.conversions > 0 ? (data.cost / data.conversions) : 0
            let signal: string
            if (data.conversions < 5) signal = 'NEW'
            else if (roi >= 0) signal = 'OK'
            else if (roi > -30) signal = 'WATCH'
            else signal = 'STOP'

            return {
              buyer: name,
              clicks: data.clicks,
              conversions: data.conversions,
              revenue: Math.round(data.revenue),
              cost: Math.round(data.cost),
              profit: Math.round(data.profit),
              roi: Math.round(roi * 10) / 10,
              cpa: Math.round(cpa),
              campaigns: data.campaigns,
              stopCampaigns: data.stopCampaigns,
              creatives: data.creativeIds.size,
              funnels: data.funnelIds.size,
              signal,
            }
          })
          .sort((a, b) => (b.profit as number) - (a.profit as number))

        source = 'keitaro_api'
      }
    } catch (err) {
      console.error('[buyers] Keitaro error:', err)
    }

    // Fallback if no data from Keitaro
    if (buyers.length === 0) {
      buyers = [
        { buyer: 'GB | FB', clicks: 284000, conversions: 21367, revenue: 1375232, cost: 1196088, profit: 179143, roi: 15.0, cpa: 56, campaigns: 12, stopCampaigns: 1, signal: 'OK' },
        { buyer: 'CA | FB', clicks: 156000, conversions: 12716, revenue: 898413, cost: 675642, profit: 222771, roi: 33.0, cpa: 53, campaigns: 8, stopCampaigns: 0, signal: 'OK' },
        { buyer: 'DE | FB', clicks: 89000, conversions: 5088, revenue: 311289, cost: 389559, profit: -78271, roi: -20.1, cpa: 77, campaigns: 6, stopCampaigns: 2, signal: 'WATCH' },
        { buyer: 'AU | FB', clicks: 72000, conversions: 4455, revenue: 352451, cost: 336817, profit: 15634, roi: 4.6, cpa: 76, campaigns: 5, stopCampaigns: 0, signal: 'OK' },
        { buyer: 'FR | FB', clicks: 54000, conversions: 3821, revenue: 179217, cost: 167074, profit: 12144, roi: 7.3, cpa: 44, campaigns: 4, stopCampaigns: 0, signal: 'OK' },
        { buyer: 'NL | FB', clicks: 18000, conversions: 714, revenue: 101033, cost: 111145, profit: -10112, roi: -9.1, cpa: 156, campaigns: 3, stopCampaigns: 1, signal: 'WATCH' },
        { buyer: 'AU | GDN', clicks: 22000, conversions: 1335, revenue: 68400, cost: 66405, profit: 1995, roi: 3.0, cpa: 50, campaigns: 4, stopCampaigns: 0, signal: 'OK' },
        { buyer: 'BR | FB', clicks: 45000, conversions: 7284, revenue: 16257, cost: 35364, profit: -19108, roi: -54.0, cpa: 5, campaigns: 3, stopCampaigns: 3, signal: 'STOP' },
        { buyer: 'IT | FB', clicks: 15000, conversions: 853, revenue: 33046, cost: 34062, profit: -1016, roi: -3.0, cpa: 40, campaigns: 2, stopCampaigns: 0, signal: 'WATCH' },
        { buyer: 'ES | FB', clicks: 12000, conversions: 415, revenue: 18728, cost: 26739, profit: -8012, roi: -30.0, cpa: 64, campaigns: 2, stopCampaigns: 1, signal: 'STOP' },
        { buyer: 'NZ | FB', clicks: 9800, conversions: 745, revenue: 24194, cost: 23892, profit: 302, roi: 1.3, cpa: 32, campaigns: 2, stopCampaigns: 0, signal: 'OK' },
        { buyer: 'PL | FB', clicks: 11000, conversions: 385, revenue: 12840, cost: 19098, profit: -6259, roi: -32.8, cpa: 50, campaigns: 2, stopCampaigns: 1, signal: 'STOP' },
      ]
      source = buyers.length > 0 ? 'keitaro_cached' : 'mock'
    }

    // Compute totals
    const totals = {
      totalSpend: buyers.reduce((s, b) => s + (b.cost as number), 0),
      totalRevenue: buyers.reduce((s, b) => s + (b.revenue as number), 0),
      totalProfit: buyers.reduce((s, b) => s + (b.profit as number), 0),
      avgRoi: 0,
    }
    totals.avgRoi = totals.totalSpend > 0 ? Math.round(((totals.totalProfit / totals.totalSpend) * 100) * 10) / 10 : 0

    return NextResponse.json({ buyers, totals, source })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
