import type { FastifyInstance } from 'fastify'
import { keitaroRequest, formatDate } from '../lib/keitaro.js'

const MIN_COST_FOR_DATA = 150
const MIN_CLICKS_FOR_DATA = 100

type OfferStatus = 'success' | 'failed' | 'decision' | 'no_data'

interface OfferStats {
  clicks: number; conversions: number; revenue: number; profit: number
  roi: number; cr: number; cpa: number; cost: number
}

interface FunnelStat {
  streamId: number; streamName: string; campaignName: string; campaignId: number
  schema: string; streamType: string; weight: number; streamStatus: string
  clicks: number; conversions: number; revenue: number; profit: number
  roi: number; cr: number; cpa: number; cost: number; recommendation: string
}

interface OfferView {
  name: string; status: OfferStatus; stats: OfferStats; recommendation: string; funnels: FunnelStat[]
}

interface OffersResponse {
  offers: OfferView[]; period: { from: string; to: string }; lastUpdated: string; error?: string
}

let _cache: { data: OffersResponse; ts: number; periodKey: string } | null = null
const CACHE_TTL = 15 * 60 * 1000

function classifyOffer(stats: OfferStats): OfferStatus {
  const { cost, clicks, conversions, roi } = stats
  if (cost < MIN_COST_FOR_DATA || clicks < MIN_CLICKS_FOR_DATA) return 'no_data'
  if (conversions === 0) return 'failed'
  if (roi >= 0) return 'success'
  if (roi < -70) return 'failed'
  return 'decision'
}

function buildOfferRecommendation(status: OfferStatus, stats: OfferStats): string {
  const { cost, conversions, cpa, roi, cr, clicks } = stats
  const parts: string[] = []
  if (conversions === 0) {
    parts.push(`Нет конверсий при расходах $${cost.toFixed(0)}. Проверь постбэк и соответствие оффера источнику трафика.`)
  } else {
    if (roi >= 0) parts.push(`CPA $${cpa.toFixed(0)}, ROI ${roi.toFixed(0)}% — оффер прибыльный. Если CPA ниже эталона по гео — масштабируй бюджет.`)
    else parts.push(`CPA $${cpa.toFixed(0)}, ROI ${roi.toFixed(0)}% — оффер убыточен. Оптимизируй ставки и тестируй новые воронки.`)
  }
  if (cr > 0 && cr < 1 && clicks > 500) {
    parts.push(`CR ${cr.toFixed(2)}% — ниже 1% при ${clicks.toLocaleString()} кликах. Основной потенциал — аудит лендинга и тест схем воронок.`)
  }
  if (status === 'failed' && conversions > 0) parts.push(`Итог: требует остановки или кардинальной перестройки воронок.`)
  else if (status === 'decision') parts.push(`Итог: продолжать с активной оптимизацией воронок — анализ ниже.`)
  else if (status === 'success') parts.push(`Итог: масштабировать лучшие воронки, отключить убыточные.`)
  return parts.join(' ')
}

function buildFunnelRecommendation(f: Omit<FunnelStat, 'recommendation'>): string {
  const { clicks, conversions, roi, cr, cpa, cost, schema, weight, streamType } = f
  const parts: string[] = []
  const isForced = streamType === 'forced'
  if (isForced) {
    parts.push(`Поток типа forced — получает трафик по условию фильтров, а не через весовую ротацию. Вес (${weight}%) у такого потока не управляет объёмом трафика.`)
  } else {
    if (weight === 100) parts.push(`Поток типа position с весом 100% — получает весь трафик кампании.`)
    else if (weight === 0) parts.push(`Поток типа position с весом 0% — исключён из ротации, трафика нет.`)
    else parts.push(`Поток типа position с весом ${weight}% — получает ${weight}% трафика кампании через ротацию.`)
  }
  const schemaDesc: Record<string, string> = {
    'landing': 'схема Landing: трафик идёт напрямую на лендинг',
    'prelanding': 'схема Pre-landing: трафик проходит через прелендинг без лендинга',
    'prelanding+landing': 'схема Pre-landing → Landing: трафик сначала попадает на прелендинг, затем на лендинг',
    'direct': 'схема Direct: трафик уходит напрямую на оффер без LP',
  }
  parts.push(`Сетап воронки: ${schemaDesc[schema.toLowerCase()] ?? `схема ${schema}`}.`)
  if (clicks === 0) { parts.push('Трафика через эту воронку в текущем периоде нет.'); return parts.join(' ') }
  parts.push(`Трафик: ${clicks.toLocaleString()} кликов, расход $${cost.toFixed(0)}.`)
  if (conversions === 0) {
    if (clicks > 50) parts.push(`Конверсий нет. ${isForced ? 'Проверь корректность фильтров и постбэк для этого оффера.' : 'Проверь соответствие LP офферу и корректность постбэка.'}`)
  } else {
    if (cr >= 10) parts.push(`CR ${cr.toFixed(2)}% — очень высокий, лендинг хорошо конвертит на этом трафике.`)
    else if (cr >= 3) parts.push(`CR ${cr.toFixed(2)}% — хороший показатель конверсии.`)
    else if (cr >= 1) parts.push(`CR ${cr.toFixed(2)}% — средний CR, есть потенциал роста на этапе лендинга.`)
    else parts.push(`CR ${cr.toFixed(2)}% — низкий, основные потери на этапе лендинга. Тест другого LP или схемы воронки.`)
    if (roi >= 50) {
      parts.push(`ROI ${roi.toFixed(0)}%, CPA $${cpa.toFixed(0)} — воронка очень прибыльная.`)
      if (!isForced && weight < 50) parts.push(`Вес ${weight}% низкий — увеличь вес для масштабирования объёма.`)
    } else if (roi >= 0) {
      parts.push(`ROI ${roi.toFixed(0)}%, CPA $${cpa.toFixed(0)} — воронка прибыльная.`)
      if (!isForced && weight < 50) parts.push(`Вес ${weight}% — рассмотри увеличение веса для роста объёма.`)
    } else if (roi < -50) {
      parts.push(`ROI ${roi.toFixed(0)}%, CPA $${cpa.toFixed(0)} — воронка критически убыточна. Рекомендуется отключить или заменить схему.`)
    } else {
      parts.push(`ROI ${roi.toFixed(0)}%, CPA $${cpa.toFixed(0)} — убыток, но не критичный. Тест другой схемы или прелендинга может исправить конверсию.`)
    }
  }
  return parts.join(' ')
}

async function buildOffersData(dateFrom: string, dateTo: string): Promise<OffersResponse> {
  const KEITARO_URL = process.env.KEITARO_URL || ''
  const KEITARO_API_KEY = process.env.KEITARO_API_KEY || ''
  if (!KEITARO_URL || !KEITARO_API_KEY) {
    return { offers: [], period: { from: '', to: '' }, lastUpdated: new Date().toISOString(), error: 'KEITARO_URL or KEITARO_API_KEY not configured' }
  }

  const [campaignsRaw, offersListRaw, offerReportRaw, streamReportRaw] = await Promise.all([
    keitaroRequest(KEITARO_URL, KEITARO_API_KEY, 'GET', '/campaigns') as Promise<Array<Record<string, unknown>>>,
    keitaroRequest(KEITARO_URL, KEITARO_API_KEY, 'GET', '/offers') as Promise<Array<Record<string, unknown>>>,
    keitaroRequest(KEITARO_URL, KEITARO_API_KEY, 'POST', '/report/build', {
      range: { from: dateFrom, to: dateTo, timezone: 'Europe/Kyiv' },
      dimensions: ['offer'],
      measures: ['clicks', 'conversions', 'revenue', 'profit', 'roi', 'cr', 'cpa', 'cost'],
      sort: [{ name: 'clicks', order: 'DESC' }], limit: 500,
    }) as Promise<{ rows: Record<string, unknown>[] }>,
    keitaroRequest(KEITARO_URL, KEITARO_API_KEY, 'POST', '/report/build', {
      range: { from: dateFrom, to: dateTo, timezone: 'Europe/Kyiv' },
      dimensions: ['campaign', 'stream'],
      measures: ['clicks', 'conversions', 'revenue', 'profit', 'roi', 'cr', 'cpa', 'cost'],
      sort: [{ name: 'clicks', order: 'DESC' }], limit: 2000,
    }) as Promise<{ rows: Record<string, unknown>[] }>,
  ])

  const campaignIdMap = new Map<string, number>()
  for (const c of campaignsRaw ?? []) campaignIdMap.set(String(c['name'] ?? ''), Number(c['id']))

  const offerIdToName = new Map<number, string>()
  for (const o of offersListRaw ?? []) offerIdToName.set(Number(o['id']), String(o['name'] ?? '').trim())

  const streamStatsMap = new Map<string, Map<string, OfferStats>>()
  for (const row of streamReportRaw.rows ?? []) {
    const campaignName = String(row['campaign'] ?? '')
    const streamName = String(row['stream'] ?? '')
    if (!campaignName || !streamName) continue
    if (!streamStatsMap.has(campaignName)) streamStatsMap.set(campaignName, new Map())
    streamStatsMap.get(campaignName)!.set(streamName, {
      clicks: Number(row['clicks'] ?? 0), conversions: Number(row['conversions'] ?? 0),
      revenue: Number(row['revenue'] ?? 0), profit: Number(row['profit'] ?? 0),
      roi: Number(row['roi'] ?? 0), cr: Number(row['cr'] ?? 0),
      cpa: Number(row['cpa'] ?? 0), cost: Number(row['cost'] ?? 0),
    })
  }

  const activeCampaignNames = new Set<string>()
  for (const row of streamReportRaw.rows ?? []) {
    const name = String(row['campaign'] ?? '')
    if (name) activeCampaignNames.add(name)
  }

  interface StreamSetup {
    id: number; schema: string; streamType: string; weight: number; streamStatus: string; offerNames: string[]
  }
  const streamSetupMap = new Map<string, Map<string, StreamSetup>>()
  const campaignList = [...activeCampaignNames]
    .map((name) => ({ name, id: campaignIdMap.get(name) }))
    .filter((c): c is { name: string; id: number } => !!c.id)

  const CONCURRENCY = 50
  for (let i = 0; i < campaignList.length; i += CONCURRENCY) {
    const batch = campaignList.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(({ name, id }) =>
        keitaroRequest(KEITARO_URL, KEITARO_API_KEY, 'GET', `/campaigns/${id}/streams`)
          .then((raw) => ({ name, raw: raw as Array<Record<string, unknown>> }))
      )
    )
    for (const result of results) {
      if (result.status !== 'fulfilled') continue
      const { name, raw } = result.value
      const setupByCampaign = new Map<string, StreamSetup>()
      for (const s of raw ?? []) {
        const offersRaw = (s['offers'] as Array<Record<string, unknown>>) ?? []
        const offerNames = offersRaw.map((o) => {
          const byId = offerIdToName.get(Number(o['offer_id']))
          if (byId) return byId
          return String(o['offer_name'] ?? o['name'] ?? '').trim()
        }).filter(Boolean)
        const streamName = String(s['name'] ?? '').trim() || `Stream ${s['id']}`
        const rawSchema = String(s['schema'] ?? '').trim().toLowerCase()
        const schema = rawSchema === 'landings' ? 'landing'
          : rawSchema === 'prelandings' ? 'prelanding'
          : rawSchema === 'prelanding_landings' ? 'prelanding+landing'
          : rawSchema || 'landing'
        setupByCampaign.set(streamName, {
          id: Number(s['id']), schema,
          streamType: String(s['type'] ?? 'position').trim() || 'position',
          weight: Number(s['weight'] ?? 100),
          streamStatus: String(s['status'] ?? 'active'),
          offerNames,
        })
      }
      streamSetupMap.set(name, setupByCampaign)
    }
  }

  const offerMap = new Map<string, OfferView>()
  for (const row of offerReportRaw.rows ?? []) {
    const name = String(row['offer'] ?? '').trim()
    if (!name) continue
    const stats: OfferStats = {
      clicks: Number(row['clicks'] ?? 0), conversions: Number(row['conversions'] ?? 0),
      revenue: Number(row['revenue'] ?? 0), profit: Number(row['profit'] ?? 0),
      roi: Number(row['roi'] ?? 0), cr: Number(row['cr'] ?? 0),
      cpa: Number(row['cpa'] ?? 0), cost: Number(row['cost'] ?? 0),
    }
    const status = classifyOffer(stats)
    offerMap.set(name, { name, status, stats, recommendation: buildOfferRecommendation(status, stats), funnels: [] })
  }

  for (const [campaignName, setupMap] of streamSetupMap) {
    const campaignId = campaignIdMap.get(campaignName) ?? 0
    const statsByCampaign = streamStatsMap.get(campaignName)
    for (const [streamName, setup] of setupMap) {
      const streamStats = statsByCampaign?.get(streamName)
      for (const offerName of setup.offerNames) {
        const offer = offerMap.get(offerName)
        if (!offer) continue
        const funnelBase: Omit<FunnelStat, 'recommendation'> = {
          streamId: setup.id, streamName, campaignName, campaignId,
          schema: setup.schema, streamType: setup.streamType, weight: setup.weight,
          streamStatus: setup.streamStatus,
          clicks: streamStats?.clicks ?? 0, conversions: streamStats?.conversions ?? 0,
          revenue: streamStats?.revenue ?? 0, profit: streamStats?.profit ?? 0,
          roi: streamStats?.roi ?? 0, cr: streamStats?.cr ?? 0,
          cpa: streamStats?.cpa ?? 0, cost: streamStats?.cost ?? 0,
        }
        offer.funnels.push({ ...funnelBase, recommendation: buildFunnelRecommendation(funnelBase) })
      }
    }
  }

  for (const offer of offerMap.values()) offer.funnels.sort((a, b) => b.clicks - a.clicks)
  const offers = [...offerMap.values()].filter((o) => o.stats.clicks > 0 || o.funnels.length > 0)

  return { offers, period: { from: dateFrom, to: dateTo }, lastUpdated: new Date().toISOString() }
}

export async function offersRoutes(app: FastifyInstance) {
  // GET /api/keitaro/offers
  app.get('/', async (req, reply) => {
    const { from, to } = req.query as { from?: string; to?: string }
    const today = new Date()
    const dateFrom = from || formatDate(new Date(today.getFullYear(), today.getMonth(), 1))
    const dateTo = to || formatDate(today)
    const periodKey = `${dateFrom}|${dateTo}`

    if (_cache && _cache.periodKey === periodKey && Date.now() - _cache.ts < CACHE_TTL) {
      return _cache.data
    }
    try {
      const data = await buildOffersData(dateFrom, dateTo)
      if (!data.error) _cache = { data, ts: Date.now(), periodKey }
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[keitaro/offers]', message)
      return reply.status(500).send({ offers: [], period: { from: '', to: '' }, lastUpdated: new Date().toISOString(), error: message })
    }
  })

  // POST /api/keitaro/offers — bust cache
  app.post('/', async () => {
    _cache = null
    return { ok: true }
  })
}
