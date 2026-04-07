import type { FastifyInstance } from 'fastify'
import { cacheGet, cacheSet } from '../lib/redis.js'
import { sql } from '../lib/db.js'
import { formatDate } from '../lib/helpers.js'

export interface OfferQuality {
  offerId:        string
  offerName:      string
  totalDep:       number
  approved:       number
  pending:        number
  rejected:       number
  approvalRate:   number | null  // Approved / (Approved + Rejected) * 100
  rejectionRate:  number | null  // Rejected / (Approved + Rejected) * 100
  avgDaysApprove: number | null
}

export interface RevenueDeltaRow {
  adCampaignId:   string
  clicks:         number
  keitaroRevenue: number
  scaleoRevenue:  number
  delta:          number
  deltaPct:       number | null
}

export async function trafficQualityRoutes(app: FastifyInstance) {

  // GET /api/analytics/traffic-quality/offers
  app.get('/offers', async (req, reply) => {
    const q        = req.query as Record<string, string>
    const today    = new Date()
    const dateFrom = q.from     || formatDate(new Date(today.getTime() - 90 * 86400000))
    const dateTo   = q.to       || formatDate(today)
    const buyerId  = q.buyer_id || null
    const cacheKey = `traffic-quality-offers:${dateFrom}|${dateTo}|${buyerId ?? ''}`

    const cached = await cacheGet<OfferQuality[]>(cacheKey)
    if (cached) return cached

    try {
      const rows = await sql`
        SELECT
          rsc.offer_id,
          rsc.offer_name,
          COUNT(*)                                                                    AS total_dep,
          COUNT(*) FILTER (WHERE rsc.conversion_status = 'Approved')                 AS approved,
          COUNT(*) FILTER (WHERE rsc.conversion_status = 'Pending')                  AS pending,
          COUNT(*) FILTER (WHERE rsc.conversion_status = 'Rejected')                 AS rejected,
          ROUND(
            CAST(100.0 * COUNT(*) FILTER (WHERE rsc.conversion_status = 'Approved')
              / NULLIF(COUNT(*) FILTER (WHERE rsc.conversion_status IN ('Approved','Rejected')), 0)
            AS numeric), 1
          )                                                                           AS approval_rate,
          ROUND(
            CAST(100.0 * COUNT(*) FILTER (WHERE rsc.conversion_status = 'Rejected')
              / NULLIF(COUNT(*) FILTER (WHERE rsc.conversion_status IN ('Approved','Rejected')), 0)
            AS numeric), 1
          )                                                                           AS rejection_rate,
          ROUND(
            CAST(AVG(
              CASE WHEN rsc.conversion_status = 'Approved' AND rsc.changed_timestamp > rsc.added_timestamp
                THEN EXTRACT(EPOCH FROM (rsc.changed_timestamp - rsc.added_timestamp)) / 86400.0
              END
            ) AS numeric), 1
          )                                                                           AS avg_days_approve
        FROM raw_scaleo_conversions rsc
        WHERE rsc.added_timestamp >= ${dateFrom}::timestamptz
          AND rsc.added_timestamp <  ${dateTo}::timestamptz + INTERVAL '1 day'
          AND rsc.goal_type_name = 'DEP'
          ${buyerId ? sql`AND rsc.buyer_id = ${buyerId}` : sql``}
        GROUP BY rsc.offer_id, rsc.offer_name
        HAVING COUNT(*) >= 5
        ORDER BY COUNT(*) DESC
        LIMIT 300
      `

      const result: OfferQuality[] = rows.map(r => ({
        offerId:        String(r.offer_id),
        offerName:      String(r.offer_name ?? ''),
        totalDep:       Number(r.total_dep),
        approved:       Number(r.approved),
        pending:        Number(r.pending),
        rejected:       Number(r.rejected),
        approvalRate:   r.approval_rate   != null ? Number(r.approval_rate)    : null,
        rejectionRate:  r.rejection_rate  != null ? Number(r.rejection_rate)   : null,
        avgDaysApprove: r.avg_days_approve != null ? Number(r.avg_days_approve) : null,
      }))

      await cacheSet(cacheKey, result, 600)
      return result

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      app.log.error('[traffic-quality/offers] ' + message)
      return reply.status(500).send({ error: message })
    }
  })

  // GET /api/analytics/traffic-quality/revenue-delta
  app.get('/revenue-delta', async (req, reply) => {
    const q        = req.query as Record<string, string>
    const today    = new Date()
    const dateFrom = q.from     || formatDate(new Date(today.getTime() - 30 * 86400000))
    const dateTo   = q.to       || formatDate(today)
    const buyerId  = q.buyer_id || null
    const cacheKey = `traffic-quality-delta:${dateFrom}|${dateTo}|${buyerId ?? ''}`

    const cached = await cacheGet<RevenueDeltaRow[]>(cacheKey)
    if (cached) return cached

    try {
      const rows = await sql`
        SELECT
          a.ad_campaign_id,
          COUNT(*)::int                                                AS clicks,
          ROUND(COALESCE(SUM(a.revenue), 0)::numeric, 2)              AS keitaro_revenue,
          ROUND(COALESCE(SUM(a.scaleo_revenue), 0)::numeric, 2)       AS scaleo_revenue,
          ROUND((COALESCE(SUM(a.scaleo_revenue), 0)
               - COALESCE(SUM(a.revenue), 0))::numeric, 2)            AS delta,
          CASE WHEN COALESCE(SUM(a.revenue), 0) > 0
            THEN ROUND(
              ((COALESCE(SUM(a.scaleo_revenue), 0) - COALESCE(SUM(a.revenue), 0))
               / SUM(a.revenue) * 100)::numeric, 1)
          END                                                          AS delta_pct
        FROM agg_clicks a
        WHERE a.datetime >= ${dateFrom}::timestamptz
          AND a.datetime <  ${dateTo}::timestamptz + INTERVAL '1 day'
          AND a.ad_campaign_id IS NOT NULL AND a.ad_campaign_id != ''
          AND (COALESCE(a.revenue, 0) > 0 OR COALESCE(a.scaleo_revenue, 0) > 0)
          ${buyerId ? sql`AND a.buyer_id = ${buyerId}` : sql``}
        GROUP BY a.ad_campaign_id
        HAVING COALESCE(SUM(a.revenue), 0) + COALESCE(SUM(a.scaleo_revenue), 0) > 0
        ORDER BY ABS(COALESCE(SUM(a.scaleo_revenue), 0) - COALESCE(SUM(a.revenue), 0)) DESC
        LIMIT 200
      `

      const result: RevenueDeltaRow[] = rows.map(r => ({
        adCampaignId:   String(r.ad_campaign_id),
        clicks:         Number(r.clicks),
        keitaroRevenue: Number(r.keitaro_revenue),
        scaleoRevenue:  Number(r.scaleo_revenue),
        delta:          Number(r.delta),
        deltaPct:       r.delta_pct != null ? Number(r.delta_pct) : null,
      }))

      await cacheSet(cacheKey, result, 600)
      return result

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      app.log.error('[traffic-quality/revenue-delta] ' + message)
      return reply.status(500).send({ error: message })
    }
  })
}
