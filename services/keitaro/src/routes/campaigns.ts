import type { FastifyInstance } from 'fastify'
import { keitaroRequest, formatDate, detectCampaignType, extractGeo, type CampaignType } from '../lib/keitaro.js'

const TARGET_PAYBACK_MONTHS = 3
const MAX_PAYBACK_MONTHS = 4
const MIN_COST_FOR_DATA = 150
const MIN_CLICKS_FOR_DATA = 100

type CampaignStatus = 'success' | 'failed' | 'decision' | 'no_data'
type CostModel = 'cpc' | 'cpa' | 'cpm' | 'revshare' | 'fixed' | 'unknown'

interface CampaignStats {
  clicks: number; conversions: number; revenue: number; profit: number
  roi: number; cr: number; cpc: number; cpa: number; cost: number; leads: number; sales: number
}

interface OfferStat {
  name: string; clicks: number; conversions: number; revenue: number; profit: number
  roi: number; cr: number; cpa: number; cost: number; shareClicks: number
}

interface EnrichedCampaign {
  id: number; name: string; alias: string; state: string; group_id: number
  geo: string; campaignType: CampaignType; costModel: CostModel; domain: string
  trafficSourceId: number; rotationType: string; status: CampaignStatus
  stats: CampaignStats; paybackMonths: number | null; recommendation: string; offerBreakdown: OfferStat[]
}

interface KeitaroDashboardResponse {
  campaigns: EnrichedCampaign[]
  summary: { total: number; active: number; success: number; failed: number; decision: number; no_data: number }
  period: { from: string; to: string }; lastUpdated: string; error?: string
}

// Also handle campaign streams
interface StreamInfo {
  id: number; name: string; schema: string; status: string; position: number; weight: number; offerNames: string[]
}

let _cache: { data: KeitaroDashboardResponse; ts: number; periodKey: string } | null = null
const CACHE_TTL = 5 * 60 * 1000

function classifyCampaign(stats: CampaignStats, type: CampaignType): CampaignStatus {
  if (type !== 'offer') return 'no_data'
  const { cost, clicks, conversions, roi } = stats
  if (cost < MIN_COST_FOR_DATA || clicks < MIN_CLICKS_FOR_DATA) return 'no_data'
  if (conversions === 0) return 'failed'
  if (roi >= 0) return 'success'
  if (roi < -70) return 'failed'
  return 'decision'
}

function costModelLabel(m: CostModel): string {
  switch (m) {
    case 'cpc': return 'CPC (оплата за клік)'
    case 'cpm': return 'CPM (оплата за 1000 показів)'
    case 'cpa': return 'CPA (оплата за дію — трафік-сорс)'
    case 'revshare': return 'RevShare (% від доходу — трафік-сорс)'
    case 'fixed': return 'Fixed (фіксована вартість)'
    default: return 'невідома модель витрат'
  }
}

function buildAppRecommendation(stats: CampaignStats, costModel: CostModel): string {
  const { clicks, conversions, cost, cr, cpc } = stats
  const parts: string[] = []
  parts.push(`Кампанія ${costModelLabel(costModel)} (APP/PWA): основна задача — маршрутизація та фільтрація трафіку, CPA-аналітика не застосовується.`)
  if (clicks > 0) {
    const cpcNote = costModel === 'cpc' && cpc > 0 ? `, CPC $${cpc.toFixed(3)}` : ''
    const cpmNote = costModel === 'cpm' && cpc > 0 ? `, CPM $${(cpc * 1000).toFixed(2)}` : ''
    parts.push(`Трафік: ${clicks.toLocaleString()} кліків, витрати $${cost.toFixed(0)}${cpcNote}${cpmNote}.`)
    if (conversions > 0) parts.push(`Прохідність (FLOW): ${conversions.toLocaleString()} подій, CR ${cr.toFixed(2)}%.`)
    else parts.push(`Конверсії не відстежуються або рівні нулю — це нормально для routing-кампаній.`)
  }
  return parts.join(' ')
}

function buildInfraRecommendation(type: CampaignType, stats: CampaignStats, costModel: CostModel): string {
  const labels: Record<CampaignType, string> = {
    cloak: 'CLOAK (вхідна фільтрація)', offer_manager: 'OFFER MANAGER (розподіл між офферами)',
    funnel_owner: 'FUNNEL OWNER (редіректи на продукти)', default_app: 'DEFAULT APP (органічний трафік без параметрів)',
    app: 'APP/PWA', offer: 'OFFER', unknown: 'невідомий тип',
  }
  const costPart = costModel !== 'unknown' ? ` Модель витрат: ${costModelLabel(costModel)}.` : ''
  return `Інфраструктурна кампанія типу ${labels[type]}. Трафік: ${stats.clicks.toLocaleString()} кліків.${costPart} CPA/ROI аналітика не застосовується.`
}

function buildRecommendation(status: CampaignStatus, stats: CampaignStats, paybackMonths: number | null, costModel: CostModel): string {
  const { cost, conversions, cpa, roi, cr, clicks, cpc } = stats
  const parts: string[] = []
  if (costModel === 'cpc') parts.push(`Модель закупки трафіку: CPC ($${cpc > 0 ? cpc.toFixed(3) : '?'}/клік). Витрати залежать від кліків; дохід — від конверсій оффера.`)
  else if (costModel === 'revshare') parts.push(`Модель закупки трафіку: RevShare — трафік-сорс бере % від доходу. ROI розраховується після вирахування частки партнера.`)
  else if (costModel === 'cpm') parts.push(`Модель закупки трафіку: CPM (${cpc > 0 ? `$${(cpc * 1000).toFixed(2)}` : '?'}/1000 показів). Ефективність залежить від CTR лендінгу.`)
  else if (costModel === 'fixed') parts.push(`Модель закупки трафіку: Fixed (фіксовані витрати $${cost.toFixed(0)} незалежно від об'єму).`)
  if (conversions === 0) {
    parts.push(`За последние 90 дней нет ни одной конверсии при расходах $${cost.toFixed(0)}. Первым делом стоит проверить корректность передачи постбэка, соответствие оффера источнику трафика и наличие корректных landing pages в потоках.`)
  } else {
    if (roi >= 0) parts.push(`CPA $${cpa.toFixed(0)}, ROI ${roi.toFixed(0)}% — кампания прибыльна. Сравни CPA с эталонным показателем для этого гео. Если CPA ниже эталона — рекомендуется масштабировать бюджет.`)
    else parts.push(`CPA $${cpa.toFixed(0)}, ROI ${roi.toFixed(0)}%. Кампания убыточна. Сравни CPA с эталонным показателем для этого гео. Приоритеты: оптимизация ставок по сегментам, тест новых креативов.`)
  }
  if (paybackMonths !== null && conversions > 0) {
    if (paybackMonths <= TARGET_PAYBACK_MONTHS) parts.push(`Расчётная окупаемость — ${paybackMonths.toFixed(1)} мес.: укладывается в целевой норматив ${TARGET_PAYBACK_MONTHS} мес.`)
    else if (paybackMonths <= MAX_PAYBACK_MONTHS) parts.push(`Расчётная окупаемость — ${paybackMonths.toFixed(1)} мес.: на пределе допустимого (max ${MAX_PAYBACK_MONTHS} мес.). Требуется улучшение монетизации или снижение CPA на 15–20%.`)
    else if (paybackMonths <= 12) parts.push(`Расчётная окупаемость — ${paybackMonths.toFixed(1)} мес., что в ${(paybackMonths / TARGET_PAYBACK_MONTHS).toFixed(1)}× превышает норматив. При текущей динамике кампания не окупится в плановые сроки.`)
    else parts.push(`Расчётная окупаемость превышает 12 мес. (или не достигается вовсе). Кампания фундаментально убыточна в текущей конфигурации.`)
  }
  if (conversions > 0) {
    if (roi < -70) parts.push(`ROI ${roi.toFixed(0)}% — критически низкий. Рекомендуется немедленная пауза и пересмотр стратегии.`)
    else if (roi < -30) parts.push(`ROI ${roi.toFixed(0)}%: кампания в существенном минусе. Рассмотреть ротацию офферов, A/B-тест лендингов.`)
    else if (roi < 0) parts.push(`ROI ${roi.toFixed(0)}%: небольшой минус — возможна точечная оптимизация без полной остановки.`)
  }
  if (cr > 0 && cr < 1 && clicks > 500) parts.push(`CR ${cr.toFixed(2)}% ниже 1% при ${clicks.toLocaleString()} кликах — основной потенциал роста на этапе LP→конверсия.`)
  if (status === 'failed' && conversions > 0) parts.push(`Итог: кампания требует остановки или кардинальной перестройки до следующего теста.`)
  else if (status === 'decision') {
    if (roi >= 0) parts.push(`Итог: кампания прибыльна, но не достигает KPI по окупаемости. Продолжать с активной оптимизацией.`)
    else parts.push(`Итог: решение о продолжении зависит от LTV-модели.`)
  }
  return parts.join(' ')
}

const emptyStats = (): CampaignStats => ({ clicks: 0, conversions: 0, revenue: 0, profit: 0, roi: 0, cr: 0, cpc: 0, cpa: 0, cost: 0, leads: 0, sales: 0 })

export async function campaignsRoutes(app: FastifyInstance) {
  // GET /api/keitaro/campaigns
  app.get('/', async (req, reply) => {
    const { from, to } = req.query as { from?: string; to?: string }
    const today = new Date()
    const dateFrom = from || formatDate(new Date(today.getFullYear(), today.getMonth(), 1))
    const dateTo = to || formatDate(today)
    const periodKey = `${dateFrom}|${dateTo}`

    if (_cache && _cache.periodKey === periodKey && Date.now() - _cache.ts < CACHE_TTL) return _cache.data

    const KEITARO_URL = process.env.KEITARO_URL || ''
    const KEITARO_API_KEY = process.env.KEITARO_API_KEY || ''

    try {
      if (!KEITARO_URL || !KEITARO_API_KEY) {
        return { campaigns: [], summary: { total: 0, active: 0, success: 0, failed: 0, decision: 0, no_data: 0 }, period: { from: '', to: '' }, lastUpdated: new Date().toISOString(), error: 'KEITARO_URL or KEITARO_API_KEY not configured' }
      }

      const [campaignsRaw, reportRaw, offerReportRaw] = await Promise.all([
        keitaroRequest(KEITARO_URL, KEITARO_API_KEY, 'GET', '/campaigns') as Promise<unknown[]>,
        keitaroRequest(KEITARO_URL, KEITARO_API_KEY, 'POST', '/report/build', {
          range: { from: dateFrom, to: dateTo, timezone: 'Europe/Kyiv' },
          dimensions: ['campaign'],
          measures: ['clicks', 'conversions', 'revenue', 'profit', 'roi', 'cr', 'cpc', 'cpa', 'cost', 'leads', 'sales'],
          sort: [{ name: 'cost', order: 'DESC' }],
        }) as Promise<{ rows: Record<string, unknown>[] }>,
        keitaroRequest(KEITARO_URL, KEITARO_API_KEY, 'POST', '/report/build', {
          range: { from: dateFrom, to: dateTo, timezone: 'Europe/Kyiv' },
          dimensions: ['campaign', 'offer'],
          measures: ['clicks', 'conversions', 'revenue', 'profit', 'roi', 'cr', 'cpa', 'cost'],
          sort: [{ name: 'clicks', order: 'DESC' }], limit: 1000,
        }) as Promise<{ rows: Record<string, unknown>[] }>,
      ])

      const statsMap = new Map<string, CampaignStats>()
      for (const row of (reportRaw.rows ?? []) as Record<string, unknown>[]) {
        const name = String(row['campaign'] ?? '')
        if (!name) continue
        statsMap.set(name, {
          clicks: Number(row['clicks'] ?? 0), conversions: Number(row['conversions'] ?? 0),
          revenue: Number(row['revenue'] ?? 0), profit: Number(row['profit'] ?? 0),
          roi: Number(row['roi'] ?? 0), cr: Number(row['cr'] ?? 0), cpc: Number(row['cpc'] ?? 0),
          cpa: Number(row['cpa'] ?? 0), cost: Number(row['cost'] ?? 0),
          leads: Number(row['leads'] ?? 0), sales: Number(row['sales'] ?? 0),
        })
      }

      const offerMap = new Map<string, OfferStat[]>()
      for (const row of (offerReportRaw.rows ?? []) as Record<string, unknown>[]) {
        const campaignName = String(row['campaign'] ?? '')
        const offerName = String(row['offer'] ?? '').trim()
        if (!campaignName || !offerName) continue
        const stat: OfferStat = {
          name: offerName, clicks: Number(row['clicks'] ?? 0), conversions: Number(row['conversions'] ?? 0),
          revenue: Number(row['revenue'] ?? 0), profit: Number(row['profit'] ?? 0),
          roi: Number(row['roi'] ?? 0), cr: Number(row['cr'] ?? 0),
          cpa: Number(row['cpa'] ?? 0), cost: Number(row['cost'] ?? 0), shareClicks: 0,
        }
        if (!offerMap.has(campaignName)) offerMap.set(campaignName, [])
        offerMap.get(campaignName)!.push(stat)
      }
      for (const offers of offerMap.values()) {
        const total = offers.reduce((s, o) => s + o.clicks, 0)
        if (total > 0) offers.forEach((o) => { o.shareClicks = (o.clicks / total) * 100 })
      }

      const campaigns: EnrichedCampaign[] = (campaignsRaw as Array<Record<string, unknown>>).map((c) => {
        const name = String(c['name'] ?? '')
        const stats = statsMap.get(name) ?? emptyStats()
        const campaignType = detectCampaignType(name)
        const rawCostType = String(c['cost_type'] ?? '').toLowerCase().trim()
        const costModel: CostModel = ['cpc', 'cpa', 'cpm', 'revshare', 'fixed'].includes(rawCostType) ? rawCostType as CostModel : 'unknown'
        const domain = String(c['domain'] ?? '')
        const trafficSourceId = Number(c['traffic_source_id'] ?? 0)
        const rotationType = String(c['rotation'] ?? 'position')
        const status = classifyCampaign(stats, campaignType)
        const paybackMonths = campaignType === 'offer' && stats.revenue > 0 ? (stats.cost * 3) / stats.revenue : null
        let recommendation: string
        if (campaignType === 'app') recommendation = buildAppRecommendation(stats, costModel)
        else if (campaignType !== 'offer') recommendation = buildInfraRecommendation(campaignType, stats, costModel)
        else recommendation = buildRecommendation(status, stats, paybackMonths, costModel)
        return {
          id: Number(c['id']), name, alias: String(c['alias'] ?? ''), state: String(c['state'] ?? 'unknown'),
          group_id: Number(c['group_id'] ?? 0), geo: extractGeo(name), campaignType, costModel, domain,
          trafficSourceId, rotationType, status, stats, paybackMonths, recommendation,
          offerBreakdown: offerMap.get(name) ?? [],
        }
      })

      const activeCampaigns = campaigns.filter((c) => c.stats.cost > 0)
      activeCampaigns.sort((a, b) => {
        if (a.state === 'active' && b.state !== 'active') return -1
        if (b.state === 'active' && a.state !== 'active') return 1
        return b.stats.cost - a.stats.cost
      })

      const summary = {
        total: activeCampaigns.length,
        active: activeCampaigns.filter((c) => c.state === 'active').length,
        success: activeCampaigns.filter((c) => c.status === 'success').length,
        failed: activeCampaigns.filter((c) => c.status === 'failed').length,
        decision: activeCampaigns.filter((c) => c.status === 'decision').length,
        no_data: activeCampaigns.filter((c) => c.status === 'no_data').length,
      }

      const result: KeitaroDashboardResponse = { campaigns: activeCampaigns, summary, period: { from: dateFrom, to: dateTo }, lastUpdated: new Date().toISOString() }
      _cache = { data: result, ts: Date.now(), periodKey }
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[keitaro/campaigns]', message)
      return reply.status(500).send({ campaigns: [], summary: { total: 0, active: 0, success: 0, failed: 0, decision: 0, no_data: 0 }, period: { from: '', to: '' }, lastUpdated: new Date().toISOString(), error: message })
    }
  })

  // POST /api/keitaro/campaigns — bust cache
  app.post('/', async () => { _cache = null; return { ok: true } })

  // GET /api/keitaro/campaigns/:id/streams
  app.get('/:id/streams', async (req, reply) => {
    const { id } = req.params as { id: string }
    const KEITARO_URL = process.env.KEITARO_URL || ''
    const KEITARO_API_KEY = process.env.KEITARO_API_KEY || ''
    if (!KEITARO_URL || !KEITARO_API_KEY) return { streams: [], error: 'Not configured' }

    try {
      const raw = await keitaroRequest(KEITARO_URL, KEITARO_API_KEY, 'GET', `/campaigns/${id}/streams`) as Array<Record<string, unknown>>
      const streams: StreamInfo[] = (raw ?? []).map((s) => {
        const offersRaw = (s['offers'] as Array<Record<string, unknown>>) ?? []
        const offerNames = offersRaw.map((o) => String(o['offer_name'] ?? o['name'] ?? '').trim()).filter(Boolean)
        const rawSchema = String(s['schema'] ?? '').trim().toLowerCase()
        const schema = rawSchema === 'landings' ? 'landing' : rawSchema === 'prelandings' ? 'prelanding' : rawSchema === 'prelanding_landings' ? 'prelanding+landing' : rawSchema || 'landing'
        return { id: Number(s['id']), name: String(s['name'] ?? '').trim() || `Stream ${s['id']}`, schema, status: String(s['status'] ?? 'active'), position: Number(s['position'] ?? 0), weight: Number(s['weight'] ?? 100), offerNames }
      })
      streams.sort((a, b) => a.position - b.position)
      return { streams }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return reply.status(500).send({ streams: [], error: message })
    }
  })
}
