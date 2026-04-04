import { NextRequest } from 'next/server'
import { spawn } from 'child_process'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyRow {
  date:       string
  clicks:     number
  adSpend:    number
  totalCost:  number
  leads:      number
  ftds:       number
  revenue:    number
  profit:     number
  roi:        number | null
}

interface BreakdownRow {
  key:       string
  name:      string | null
  clicks:    number
  adSpend:   number
  totalCost: number
  leads:     number
  ftds:      number
  revenue:   number
  profit:    number
  roi:       number | null
  signal:    string
}

interface Totals {
  clicks:         number
  adSpend:        number
  techCost:       number
  totalCost:      number
  leads:          number
  ftds:           number
  revenue:        number
  revenuePending: number
  revenueTotal:   number
  profit:         number
  profitTotal:    number
  roi:            number | null
  roiTotal:       number | null
  cpl:            number | null
  cpa:            number | null
  cpc:            number
  signal:         string
}

interface AnalyzeBody {
  groupBy:   'offer_id' | 'ad_campaign_id'
  id:        string
  name:      string | null
  period:    { from: string; to: string }
  totals:    Totals
  daily:     DailyRow[]
  breakdown: BreakdownRow[]
  locale?:   string
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

const LANG_INSTRUCTION: Record<string, string> = {
  en: 'Write in English.',
  ru: 'Пиши на русском языке.',
  uk: 'Пиши українською мовою.',
}

function buildPrompt(body: AnalyzeBody): string {
  const { groupBy, id, name, period, totals, daily, breakdown, locale } = body

  const cr    = totals.leads > 0 ? ((totals.ftds / totals.leads) * 100).toFixed(1) : '0.0'
  const label = name ? `${name} (${id})` : id
  const gLabel = groupBy === 'offer_id' ? 'Offer' : 'Ad Campaign'
  const langInstruction = LANG_INSTRUCTION[locale ?? 'en'] ?? LANG_INSTRUCTION['en']

  const lines: string[] = []

  lines.push(`You are a Senior Web Traffic Analyst with 10+ years experience in performance marketing. Analyze the following data and provide sharp, direct insights. Structure your response with: ## Summary, ## Key Findings, ## Conversion Funnel Analysis, ## Recommendations. Be specific with numbers. ${langInstruction}`)
  lines.push(`IMPORTANT BUSINESS CONTEXT: This is a performance marketing business where offer approvals can take up to 30+ days. "Pending" revenue is NOT a risk — it represents real earned revenue that is simply awaiting formal approval. Always treat Revenue Total (approved + pending) as the actual factual revenue when assessing profitability, ROI, and performance. Never flag pending revenue as uncertain or risky.`)
  lines.push('')
  lines.push(`--- DATA ---`)
  lines.push(`Analyzing: ${label} [${gLabel}]`)
  lines.push(`Period: ${period.from} — ${period.to}`)
  lines.push('')
  lines.push('TOTALS:')
  lines.push(`Clicks: ${totals.clicks.toLocaleString()} | Leads: ${totals.leads.toLocaleString()} | FTDs: ${totals.ftds.toLocaleString()} | CR: ${cr}%`)
  lines.push(`Ad Spend: $${totals.adSpend.toFixed(0)} | Tech Cost: $${totals.techCost.toFixed(0)} | Total Cost: $${totals.totalCost.toFixed(0)}`)
  lines.push(`Revenue (actual): $${totals.revenueTotal.toFixed(0)} [approved: $${totals.revenue.toFixed(0)} + pending: $${totals.revenuePending.toFixed(0)}]`)
  lines.push(`Profit (actual): $${totals.profitTotal.toFixed(0)} | ROI (actual): ${totals.roiTotal != null ? totals.roiTotal.toFixed(1) + '%' : 'N/A'}`)
  lines.push(`CPL: ${totals.cpl != null ? '$' + totals.cpl.toFixed(0) : 'N/A'} | CPA: ${totals.cpa != null ? '$' + totals.cpa.toFixed(0) : 'N/A'} | CPC: $${totals.cpc.toFixed(2)}`)
  lines.push(`Signal: ${totals.signal}`)
  lines.push('')

  const dailySlice = [...daily].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14).reverse()
  if (dailySlice.length > 0) {
    lines.push(`DAILY TREND (last ${dailySlice.length} days):`)
    for (const d of dailySlice) {
      const roiStr = d.roi != null ? `roi=${d.roi.toFixed(1)}%` : 'roi=N/A'
      lines.push(`  ${d.date}: clicks=${d.clicks}, leads=${d.leads}, FTDs=${d.ftds}, rev=$${d.revenue.toFixed(0)}, spend=$${d.totalCost.toFixed(0)}, ${roiStr}`)
    }
    lines.push('')
  }

  const bLabel = groupBy === 'offer_id' ? 'AD CAMPAIGN' : 'OFFER'
  const topBreakdown = [...breakdown].sort((a, b) => b.totalCost - a.totalCost).slice(0, 10)
  if (topBreakdown.length > 0) {
    lines.push(`TOP ${bLabel} BREAKDOWN (by spend):`)
    for (const b of topBreakdown) {
      const displayName = b.name ? `${b.name} (${b.key})` : b.key
      const roiStr = b.roi != null ? `roi=${b.roi.toFixed(1)}%` : 'roi=N/A'
      lines.push(`  ${displayName}: spend=$${b.totalCost.toFixed(0)}, FTDs=${b.ftds}, rev=$${b.revenue.toFixed(0)}, ${roiStr}, signal=${b.signal}`)
    }
  }

  return lines.join('\n')
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: AnalyzeBody = await req.json()
    const prompt = buildPrompt(body)

    const readable = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()

        // Strip ANTHROPIC_API_KEY so claude CLI uses OAuth (Max plan), not API credits
        const { ANTHROPIC_API_KEY: _omit, ...envWithoutKey } = process.env as Record<string, string>
        const claudeBin = process.env.CLAUDE_BIN || 'claude'
        const proc = spawn(claudeBin, [
          '-p', prompt,
          '--output-format', 'text',
        ], {
          env: { ...envWithoutKey, HOME: process.env.CLAUDE_HOME || process.env.HOME || '/root' },
        })

        proc.stdout.on('data', (chunk: Buffer) => {
          controller.enqueue(encoder.encode(chunk.toString()))
        })

        proc.stderr.on('data', (chunk: Buffer) => {
          console.error('[analyze] claude stderr:', chunk.toString())
        })

        proc.on('close', (code: number) => {
          if (code !== 0) console.error('[analyze] claude exited with code', code)
          controller.close()
        })

        proc.on('error', (err: Error) => {
          console.error('[analyze] spawn error:', err)
          controller.error(err)
        })
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    console.error('[analyze/ad-performance]', err)
    return new Response('Analysis failed', { status: 500 })
  }
}
