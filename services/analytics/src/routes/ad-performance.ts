import type { FastifyInstance } from 'fastify'
import { cacheGet, cacheSet } from '../lib/redis.js'
import { sql } from '../lib/db.js'
import { formatDate } from '../lib/helpers.js'


// Stop signal classification
// STOP:  roi_total < -30% (even with pending still in loss)
// WATCH: roi_approved < 0 but roi_total > -30% (pending may save it)
// OK:    revenue_approved > total_cost (profitable now)
// NEW:   < 5 FTDs (not enough data)
function classifySignal(
  ftds: number,
  roi: number | null,
  roiTotal: number | null,
): 'STOP' | 'WATCH' | 'OK' | 'NEW' {
  if (ftds < 5) return 'NEW'
  if (roi !== null && roi >= 0) return 'OK'
  if (roiTotal !== null && roiTotal < -30) return 'STOP'
  return 'WATCH'
}

export async function adPerformanceRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const q = req.query as Record<string, string>
    const today       = new Date()
    const defaultFrom = formatDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000))
    const dateFrom    = q.from     || defaultFrom
    const dateTo      = q.to       || formatDate(today)
    const minSpend    = parseFloat(q.min_spend || '500')
    const buyerId     = q.buyer_id || null
    const groupBy     = q.group_by === 'offer_id' ? 'offer_id' : 'ad_campaign_id'
    const cacheKey    = `adperf:${dateFrom}|${dateTo}|${minSpend}|${buyerId ?? ''}|${groupBy}`

    const cached = await cacheGet(cacheKey)
    if (cached) return cached

    try {
      let rows: Record<string, unknown>[]

      if (groupBy === 'offer_id') {
        rows = await sql`
          WITH scaleo_rev AS (
            SELECT
              aff_click_id,
              SUM(CASE WHEN conversion_status = 'Approved' THEN payout ELSE 0 END)   AS approved_rev,
              SUM(CASE WHEN conversion_status = 'Pending'  THEN payout ELSE 0 END)   AS pending_rev,
              MAX(CASE WHEN goal_type_name = 'REG'
                        AND conversion_status != 'Rejected' THEN 1 ELSE 0 END)::int  AS has_lead,
              MAX(CASE WHEN goal_type_name IN ('DEP','ANYDEP')
                        AND conversion_status != 'Rejected' THEN 1 ELSE 0 END)::int  AS has_ftd
            FROM raw_scaleo_conversions
            GROUP BY aff_click_id
          )
          SELECT
            COALESCE(o.id, a.offer_id)::bigint                                        AS group_key,
            COALESCE(o.name, a.offer_name, 'Unknown')                                 AS group_name,
            COUNT(*)::int                                                              AS clicks,
            ROUND(SUM(a.marketing_cost), 2)                                           AS ad_spend,
            ROUND(SUM(a.tech_cost), 2)                                                AS tech_cost,
            ROUND(SUM(a.marketing_cost + a.tech_cost), 2)                             AS total_cost,
            SUM(COALESCE(s.has_lead, 0))::int                                         AS leads,
            SUM(COALESCE(s.has_ftd,  0))::int                                         AS ftds,
            ROUND(COALESCE(SUM(s.approved_rev), 0), 2)                                AS revenue,
            ROUND(COALESCE(SUM(s.pending_rev),  0), 2)                                AS revenue_pending,
            ROUND(COALESCE(SUM(s.approved_rev + s.pending_rev), 0), 2)                AS revenue_total,
            ROUND(COALESCE(SUM(s.approved_rev), 0)
                  - SUM(a.marketing_cost + a.tech_cost), 2)                           AS profit,
            ROUND(COALESCE(SUM(s.approved_rev + s.pending_rev), 0)
                  - SUM(a.marketing_cost + a.tech_cost), 2)                           AS profit_total,
            CASE WHEN SUM(a.marketing_cost + a.tech_cost) > 0
              THEN ROUND((COALESCE(SUM(s.approved_rev), 0)
                   - SUM(a.marketing_cost + a.tech_cost))
                   / SUM(a.marketing_cost + a.tech_cost) * 100, 1) END                AS roi,
            CASE WHEN SUM(a.marketing_cost + a.tech_cost) > 0
              THEN ROUND((COALESCE(SUM(s.approved_rev + s.pending_rev), 0)
                   - SUM(a.marketing_cost + a.tech_cost))
                   / SUM(a.marketing_cost + a.tech_cost) * 100, 1) END                AS roi_total,
            CASE WHEN SUM(COALESCE(s.has_lead, 0)) > 0
              THEN ROUND(SUM(a.marketing_cost) / SUM(COALESCE(s.has_lead, 0)), 2)
            END                                                                        AS cpl,
            CASE WHEN SUM(COALESCE(s.has_ftd, 0)) > 0
              THEN ROUND(SUM(a.marketing_cost) / SUM(COALESCE(s.has_ftd, 0)), 2)
            END                                                                        AS cpa,
            ROUND(SUM(a.marketing_cost) / COUNT(*), 2)                                AS cpc
          FROM agg_clicks a
          LEFT JOIN raw_keitaro_offers o ON o.id = a.offer_id
          LEFT JOIN scaleo_rev s ON s.aff_click_id = a.sub_id
          WHERE a.datetime >= ${dateFrom}::timestamptz
            AND a.datetime <  ${dateTo}::timestamptz + INTERVAL '1 day'
            AND a.offer_id IS NOT NULL
            ${buyerId ? sql`AND a.buyer_id = ${buyerId}` : sql``}
          GROUP BY COALESCE(o.id, a.offer_id), COALESCE(o.name, a.offer_name, 'Unknown')
          HAVING SUM(a.marketing_cost + a.tech_cost) >= ${minSpend}
          ORDER BY SUM(a.marketing_cost + a.tech_cost) DESC
          LIMIT 500
        `
      } else {
        rows = await sql`
          WITH scaleo_rev AS (
            SELECT
              aff_click_id,
              SUM(CASE WHEN conversion_status = 'Approved' THEN payout ELSE 0 END)   AS approved_rev,
              SUM(CASE WHEN conversion_status = 'Pending'  THEN payout ELSE 0 END)   AS pending_rev,
              MAX(CASE WHEN goal_type_name = 'REG'
                        AND conversion_status != 'Rejected' THEN 1 ELSE 0 END)::int  AS has_lead,
              MAX(CASE WHEN goal_type_name IN ('DEP','ANYDEP')
                        AND conversion_status != 'Rejected' THEN 1 ELSE 0 END)::int  AS has_ftd
            FROM raw_scaleo_conversions
            GROUP BY aff_click_id
          ),
          campaign_agg AS (
            SELECT
              a.ad_campaign_id                                                           AS group_key,
              NULL::text                                                                 AS group_name,
              COUNT(*)::int                                                              AS clicks,
              ROUND(SUM(a.marketing_cost), 2)                                           AS ad_spend,
              ROUND(SUM(a.tech_cost), 2)                                                AS tech_cost,
              ROUND(SUM(a.marketing_cost + a.tech_cost), 2)                             AS total_cost,
              SUM(COALESCE(s.has_lead, 0))::int                                         AS leads,
              SUM(COALESCE(s.has_ftd,  0))::int                                         AS ftds,
              ROUND(COALESCE(SUM(s.approved_rev), 0), 2)                                AS revenue,
              ROUND(COALESCE(SUM(s.pending_rev),  0), 2)                                AS revenue_pending,
              ROUND(COALESCE(SUM(s.approved_rev + s.pending_rev), 0), 2)                AS revenue_total,
              ROUND(COALESCE(SUM(s.approved_rev), 0)
                    - SUM(a.marketing_cost + a.tech_cost), 2)                           AS profit,
              ROUND(COALESCE(SUM(s.approved_rev + s.pending_rev), 0)
                    - SUM(a.marketing_cost + a.tech_cost), 2)                           AS profit_total,
              CASE WHEN SUM(a.marketing_cost + a.tech_cost) > 0
                THEN ROUND((COALESCE(SUM(s.approved_rev), 0)
                     - SUM(a.marketing_cost + a.tech_cost))
                     / SUM(a.marketing_cost + a.tech_cost) * 100, 1) END                AS roi,
              CASE WHEN SUM(a.marketing_cost + a.tech_cost) > 0
                THEN ROUND((COALESCE(SUM(s.approved_rev + s.pending_rev), 0)
                     - SUM(a.marketing_cost + a.tech_cost))
                     / SUM(a.marketing_cost + a.tech_cost) * 100, 1) END                AS roi_total,
              CASE WHEN SUM(COALESCE(s.has_lead, 0)) > 0
                THEN ROUND(SUM(a.marketing_cost) / SUM(COALESCE(s.has_lead, 0)), 2)
              END                                                                        AS cpl,
              CASE WHEN SUM(COALESCE(s.has_ftd, 0)) > 0
                THEN ROUND(SUM(a.marketing_cost) / SUM(COALESCE(s.has_ftd, 0)), 2)
              END                                                                        AS cpa,
              ROUND(SUM(a.marketing_cost) / COUNT(*), 2)                                AS cpc,
              MAX(a.buyer_id)                                                            AS buyer_id
            FROM agg_clicks a
            LEFT JOIN scaleo_rev s ON s.aff_click_id = a.sub_id
            WHERE a.datetime >= ${dateFrom}::timestamptz
              AND a.datetime <  ${dateTo}::timestamptz + INTERVAL '1 day'
              AND a.ad_campaign_id IS NOT NULL AND a.ad_campaign_id != ''
              ${buyerId ? sql`AND a.buyer_id = ${buyerId}` : sql``}
            GROUP BY a.ad_campaign_id
            HAVING SUM(a.marketing_cost + a.tech_cost) >= ${minSpend}
          )
          SELECT c.*, db.username AS buyer_name
          FROM campaign_agg c
          LEFT JOIN dict_buyers db ON db.buyer_id = c.buyer_id
          ORDER BY c.total_cost DESC
          LIMIT 500
        `
      }

      const campaigns = rows.map(r => {
        const roi      = r.roi      != null ? Number(r.roi)       : null
        const roiTotal = r.roi_total != null ? Number(r.roi_total) : null
        const ftds     = Number(r.ftds)
        return {
          groupKey:        String(r.group_key),
          groupName:       r.group_name ? String(r.group_name) : null,
          clicks:          Number(r.clicks),
          adSpend:         Number(r.ad_spend),
          techCost:        Number(r.tech_cost),
          totalCost:       Number(r.total_cost),
          leads:           Number(r.leads),
          ftds,
          revenue:         Number(r.revenue),
          revenuePending:  Number(r.revenue_pending),
          revenueTotal:    Number(r.revenue_total),
          profit:          Number(r.profit),
          profitTotal:     Number(r.profit_total),
          roi,
          roiTotal,
          cpl:             r.cpl  != null ? Number(r.cpl)  : null,
          cpa:             r.cpa  != null ? Number(r.cpa)  : null,
          cpc:             Number(r.cpc),
          cvr:             Number(r.leads) > 0 ? Math.round(Number(r.ftds) / Number(r.leads) * 1000) / 10 : null,
          buyerId:         r.buyer_id   ? String(r.buyer_id)   : null,
          buyerName:       r.buyer_name ? String(r.buyer_name) : null,
          signal:          classifySignal(ftds, roi, roiTotal),
        }
      })

      const totals = {
        campaigns:      campaigns.length,
        totalSpend:     campaigns.reduce((s, c) => s + c.totalCost,      0),
        totalRevenue:   campaigns.reduce((s, c) => s + c.revenue,        0),
        totalPending:   campaigns.reduce((s, c) => s + c.revenuePending, 0),
        totalProfit:    campaigns.reduce((s, c) => s + c.profit,         0),
        totalFtds:      campaigns.reduce((s, c) => s + c.ftds,           0),
        stopCount:      campaigns.filter(c => c.signal === 'STOP').length,
        watchCount:     campaigns.filter(c => c.signal === 'WATCH').length,
        okCount:        campaigns.filter(c => c.signal === 'OK').length,
      }

      const data = { campaigns, totals, period: { from: dateFrom, to: dateTo }, groupBy }
      await cacheSet(cacheKey, data)
      return data

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[analytics/ad-performance]', message)
      return reply.status(500).send({ campaigns: [], error: message })
    }
  })
}
