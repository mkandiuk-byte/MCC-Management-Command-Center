import type { FastifyInstance } from 'fastify'
import { sql } from '../lib/db.js'
import { parseOfferName, normalizeSchema, deriveMetrics, formatDate } from '../lib/helpers.js'

const CACHE_TTL = 15 * 60 * 1000
let _cache: { data: unknown; ts: number; key: string } | null = null

type OfferStatus = 'success' | 'failed' | 'decision' | 'no_data'

const MIN_COST   = 150
const MIN_CLICKS = 100

function classifyOffer(cost: number, clicks: number, conversions: number, roi: number): OfferStatus {
  if (cost < MIN_COST || clicks < MIN_CLICKS) return 'no_data'
  if (conversions === 0) return 'failed'
  if (roi >= 0) return 'success'
  if (roi < -70) return 'failed'
  return 'decision'
}

function buildOfferRecommendation(
  status: OfferStatus,
  cost: number, clicks: number, conversions: number,
  cpa: number, roi: number, cr: number,
): string {
  const parts: string[] = []
  if (conversions === 0) {
    parts.push(`Нема конверсій при витратах $${cost.toFixed(0)}. Перевір постбэк і відповідність оффера джерелу.`)
  } else {
    if (roi >= 0) parts.push(`CPA $${cpa.toFixed(0)}, ROI ${roi.toFixed(0)}% — оффер прибутковий. Якщо CPA нижче еталону по гео — масштабуй.`)
    else parts.push(`CPA $${cpa.toFixed(0)}, ROI ${roi.toFixed(0)}% — оффер збитковий. Оптимізуй ставки та тестуй нові воронки.`)
  }
  if (cr > 0 && cr < 1 && clicks > 500) {
    parts.push(`CR ${cr.toFixed(2)}% нижче 1% при ${clicks.toLocaleString()} кліках — аудит лендінгу.`)
  }
  if (status === 'failed' && conversions > 0) {
    parts.push('Підсумок: вимагає зупинки або перебудови воронок.')
  }
  return parts.join(' ')
}

export async function offersRoutes(app: FastifyInstance) {
  // GET /api/analytics/offers
  app.get('/', async (req, reply) => {
    const q = req.query as Record<string, string>
    const today    = new Date()
    const dateFrom = q.from || formatDate(new Date(today.getFullYear(), today.getMonth(), 1))
    const dateTo   = q.to   || formatDate(today)
    const cacheKey = `${dateFrom}|${dateTo}`

    if (_cache && _cache.key === cacheKey && Date.now() - _cache.ts < CACHE_TTL) return _cache.data

    try {
      // ── Query 1: offer-level stats (from agg_clicks) ────────────────────────
      // ── Query 2: funnel breakdown stream→offer (from transform_events_cleaned)
      const [offerRows, funnelRows] = await Promise.all([
        sql`
          SELECT
            COALESCE(o.id, a.offer_id)::bigint        AS offer_id,
            COALESCE(o.name, a.offer_name, 'Unknown') AS offer_name,
            o.payout_value::float,
            o.payout_type,
            o.payout_upsell,
            o.country,
            COUNT(*)::int                              AS clicks,
            SUM(a.is_lead::int)::int                   AS leads,
            SUM(a.is_sale::int)::int                   AS sales,
            (SUM(a.is_lead::int) + SUM(a.is_sale::int))::int AS conversions,
            COALESCE(SUM(a.revenue), 0)::float         AS revenue,
            COALESCE(SUM(a.cost), 0)::float            AS cost,
            COALESCE(SUM(a.tech_cost), 0)::float       AS tech_cost
          FROM agg_clicks a
          LEFT JOIN raw_keitaro_offers o ON o.id = a.offer_id
          WHERE a.datetime >= ${dateFrom}::timestamptz
            AND a.datetime <  ${dateTo}::timestamptz + INTERVAL '1 day'
          GROUP BY
            COALESCE(o.id, a.offer_id),
            COALESCE(o.name, a.offer_name, 'Unknown'),
            o.payout_value, o.payout_type, o.payout_upsell, o.country
          ORDER BY clicks DESC
          LIMIT 500
        `,
        sql`
          SELECT
            e.offer_id,
            e.stream_id,
            e.campaign_id,
            s.name                              AS stream_name,
            s.schema                            AS stream_schema,
            s.type                              AS stream_type,
            s.weight::int                       AS weight,
            s.state                             AS stream_status,
            c.name                              AS campaign_name,
            COUNT(*)::int                       AS clicks,
            SUM(CASE WHEN e.status = 'approved' THEN 1 ELSE 0 END)::int AS conversions,
            COALESCE(SUM(e.revenue), 0)::float  AS revenue,
            COALESCE(SUM(e.cost), 0)::float     AS cost
          FROM transform_events_cleaned e
          LEFT JOIN raw_keitaro_streams    s ON s.id = e.stream_id
          LEFT JOIN raw_keitaro_campaigns  c ON c.id = e.campaign_id
          WHERE e.datetime >= ${dateFrom}::timestamptz
            AND e.datetime <  ${dateTo}::timestamptz + INTERVAL '1 day'
            AND e.offer_id   IS NOT NULL
            AND e.stream_id  IS NOT NULL
          GROUP BY
            e.offer_id, e.stream_id, e.campaign_id,
            s.name, s.schema, s.type, s.weight, s.state, c.name
          ORDER BY clicks DESC
          LIMIT 5000
        `,
      ])

      // ── Build funnel map (offer_id → funnels[]) ─────────────────────────────
      const funnelMap = new Map<string, unknown[]>()
      for (const f of funnelRows) {
        const key = String(f.offer_id)
        if (!funnelMap.has(key)) funnelMap.set(key, [])
        const fm = deriveMetrics(f.clicks, f.conversions, f.revenue, f.cost)
        funnelMap.get(key)!.push({
          streamId:     Number(f.stream_id),
          streamName:   f.stream_name ?? `Stream ${f.stream_id}`,
          campaignName: f.campaign_name ?? '',
          campaignId:   Number(f.campaign_id),
          schema:       normalizeSchema(f.stream_schema ?? ''),
          streamType:   f.stream_type ?? 'position',
          weight:       f.weight ?? 100,
          streamStatus: f.stream_status ?? 'active',
          clicks:       f.clicks,
          conversions:  f.conversions,
          revenue:      f.revenue,
          cost:         f.cost,
          profit:       fm.profit,
          roi:          fm.roi,
          cr:           fm.cr,
          cpa:          fm.cpa,
          recommendation: fm.roi >= 0
            ? `ROI ${fm.roi.toFixed(0)}% — воронка прибуткова.`
            : `ROI ${fm.roi.toFixed(0)}% — воронка збиткова.`,
        })
      }

      // ── Build landingTypeBenchmark groups ────────────────────────────────────
      // Group by brand+geo, compute per-landingType averages
      interface LTGroup { cr: number[]; roi: number[]; cpa: number[] }
      const ltGroups = new Map<string, Map<string, LTGroup>>()

      for (const r of offerRows) {
        const meta = parseOfferName(r.offer_name)
        const groupKey = `${meta.brand}|${meta.geo}`
        if (!ltGroups.has(groupKey)) ltGroups.set(groupKey, new Map())
        const gm = ltGroups.get(groupKey)!
        if (!gm.has(meta.landingType)) gm.set(meta.landingType, { cr: [], roi: [], cpa: [] })
        const m = deriveMetrics(r.clicks, r.conversions, r.revenue, r.cost)
        gm.get(meta.landingType)!.cr.push(m.cr)
        gm.get(meta.landingType)!.roi.push(m.roi)
        gm.get(meta.landingType)!.cpa.push(m.cpa)
      }

      const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

      // ── Build offer views ────────────────────────────────────────────────────
      const offers = offerRows.map(r => {
        const meta  = parseOfferName(r.offer_name)
        const m     = deriveMetrics(r.clicks, r.conversions, r.revenue, r.cost)
        const status = classifyOffer(r.cost, r.clicks, r.conversions, m.roi)

        const groupKey = `${meta.brand}|${meta.geo}`
        const ltBench  = ltGroups.get(groupKey)
        const landingTypeBenchmark = ltBench
          ? [...ltBench.entries()].map(([lt, d]) => ({
              landingType: lt,
              avgCR:  avg(d.cr),
              avgROI: avg(d.roi),
              avgCPA: avg(d.cpa),
              count:  d.cr.length,
            })).sort((a, b) => b.avgROI - a.avgROI)
          : undefined

        const acceptRate = r.leads > 0 ? (r.sales / r.leads) * 100 : null

        return {
          name:   r.offer_name,
          status,
          stats: {
            clicks:      r.clicks,
            conversions: r.conversions,
            leads:       r.leads,
            sales:       r.sales,
            revenue:     r.revenue,
            cost:        r.cost,
            profit:      m.profit,
            roi:         m.roi,
            cr:          m.cr,
            cpa:         m.cpa,
          },
          recommendation: buildOfferRecommendation(status, r.cost, r.clicks, r.conversions, m.cpa, m.roi, m.cr),
          funnels: funnelMap.get(String(r.offer_id)) ?? [],
          meta: {
            brand:        meta.brand,
            geo:          meta.geo,
            source:       meta.source,
            landingType:  meta.landingType,
            tier:         meta.tier,
            variant:      meta.variant,
            convAction:   meta.convAction,
            network:      meta.network,
            bonus:        '',
            country:      r.country ? [r.country] : [],
            payoutUpsell: r.payout_upsell ?? false,
            payoutValue:  r.payout_value ?? 0,
            payoutType:   r.payout_type ?? '',
          },
          signals: { acceptRate, landingTypeBenchmark },
        }
      })

      const data = {
        offers,
        period:      { from: dateFrom, to: dateTo },
        lastUpdated: new Date().toISOString(),
      }
      _cache = { data, ts: Date.now(), key: cacheKey }
      return data

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[analytics/offers]', message)
      return reply.status(500).send({
        offers: [], period: { from: dateFrom, to: dateTo },
        lastUpdated: new Date().toISOString(), error: message,
      })
    }
  })

  app.post('/', async () => { _cache = null; return { ok: true } })
}
