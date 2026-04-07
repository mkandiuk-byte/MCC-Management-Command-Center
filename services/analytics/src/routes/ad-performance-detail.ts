import type { FastifyInstance } from 'fastify'
import { cacheGet, cacheSet } from '../lib/redis.js'
import { sql } from '../lib/db.js'
import { formatDate } from '../lib/helpers.js'


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

export async function adPerformanceDetailRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const q = req.query as Record<string, string>
    const today       = new Date()
    const defaultFrom = formatDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000))
    const id          = q.id       || ''
    const groupBy     = q.group_by === 'offer_id' ? 'offer_id' : 'ad_campaign_id'
    const dateFrom    = q.from     || defaultFrom
    const dateTo      = q.to       || formatDate(today)
    const cacheKey    = `adperf-detail:${id}|${groupBy}|${dateFrom}|${dateTo}`

    if (!id) {
      return reply.status(400).send({ error: 'Missing required query param: id' })
    }

    const cached = await cacheGet(cacheKey)
    if (cached) return cached

    try {
      // ── Totals ──────────────────────────────────────────────────────────────
      let totalsRows: Record<string, unknown>[]

      if (groupBy === 'offer_id') {
        const offerId = parseInt(id, 10)
        totalsRows = await sql`
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
            MAX(COALESCE(o.name, a.offer_name))                                        AS group_name
          FROM agg_clicks a
          LEFT JOIN raw_keitaro_offers o ON o.id = a.offer_id
          LEFT JOIN scaleo_rev s ON s.aff_click_id = a.sub_id
          WHERE a.datetime >= ${dateFrom}::timestamptz
            AND a.datetime <  ${dateTo}::timestamptz + INTERVAL '1 day'
            AND COALESCE(o.id, a.offer_id) = ${offerId}
        `
      } else {
        totalsRows = await sql`
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
            NULL::text                                                                 AS group_name
          FROM agg_clicks a
          LEFT JOIN scaleo_rev s ON s.aff_click_id = a.sub_id
          WHERE a.datetime >= ${dateFrom}::timestamptz
            AND a.datetime <  ${dateTo}::timestamptz + INTERVAL '1 day'
            AND a.ad_campaign_id = ${id}
        `
      }

      const t = totalsRows[0] ?? {}
      const tRoi      = t.roi      != null ? Number(t.roi)       : null
      const tRoiTotal = t.roi_total != null ? Number(t.roi_total) : null
      const tFtds     = Number(t.ftds ?? 0)

      const totals = {
        clicks:         Number(t.clicks        ?? 0),
        adSpend:        Number(t.ad_spend      ?? 0),
        techCost:       Number(t.tech_cost     ?? 0),
        totalCost:      Number(t.total_cost    ?? 0),
        leads:          Number(t.leads         ?? 0),
        ftds:           tFtds,
        revenue:        Number(t.revenue       ?? 0),
        revenuePending: Number(t.revenue_pending ?? 0),
        revenueTotal:   Number(t.revenue_total ?? 0),
        profit:         Number(t.profit        ?? 0),
        profitTotal:    Number(t.profit_total  ?? 0),
        roi:            tRoi,
        roiTotal:       tRoiTotal,
        cpl:            t.cpl != null ? Number(t.cpl) : null,
        cpa:            t.cpa != null ? Number(t.cpa) : null,
        cpc:            Number(t.cpc ?? 0),
        signal:         classifySignal(tFtds, tRoi, tRoiTotal),
      }

      const name: string | null = t.group_name ? String(t.group_name) : null

      // ── Daily ───────────────────────────────────────────────────────────────
      let dailyRows: Record<string, unknown>[]

      if (groupBy === 'offer_id') {
        const offerId = parseInt(id, 10)
        dailyRows = await sql`
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
            DATE(a.datetime)::text                                                     AS date,
            COUNT(*)::int                                                              AS clicks,
            ROUND(SUM(a.marketing_cost), 2)                                           AS ad_spend,
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
            MAX(db.username)                                                           AS buyer_name
          FROM agg_clicks a
          LEFT JOIN raw_keitaro_offers o ON o.id = a.offer_id
          LEFT JOIN scaleo_rev s ON s.aff_click_id = a.sub_id
          LEFT JOIN dict_buyers db ON db.buyer_id = a.buyer_id
          WHERE a.datetime >= ${dateFrom}::timestamptz
            AND a.datetime <  ${dateTo}::timestamptz + INTERVAL '1 day'
            AND COALESCE(o.id, a.offer_id) = ${offerId}
          GROUP BY DATE(a.datetime)
          ORDER BY DATE(a.datetime)
        `
      } else {
        dailyRows = await sql`
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
            DATE(a.datetime)::text                                                     AS date,
            COUNT(*)::int                                                              AS clicks,
            ROUND(SUM(a.marketing_cost), 2)                                           AS ad_spend,
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
            MAX(db.username)                                                           AS buyer_name
          FROM agg_clicks a
          LEFT JOIN scaleo_rev s ON s.aff_click_id = a.sub_id
          LEFT JOIN dict_buyers db ON db.buyer_id = a.buyer_id
          WHERE a.datetime >= ${dateFrom}::timestamptz
            AND a.datetime <  ${dateTo}::timestamptz + INTERVAL '1 day'
            AND a.ad_campaign_id = ${id}
          GROUP BY DATE(a.datetime)
          ORDER BY DATE(a.datetime)
        `
      }

      const daily = dailyRows.map(r => ({
        date:           String(r.date),
        buyer:          r.buyer_name ? String(r.buyer_name) : null,
        clicks:         Number(r.clicks),
        adSpend:        Number(r.ad_spend),
        totalCost:      Number(r.total_cost),
        leads:          Number(r.leads),
        ftds:           Number(r.ftds),
        cvr:            Number(r.leads) > 0 ? Math.round(Number(r.ftds) / Number(r.leads) * 1000) / 10 : null,
        revenue:        Number(r.revenue),
        revenuePending: Number(r.revenue_pending ?? 0),
        revenueTotal:   Number(r.revenue_total ?? 0),
        profit:         Number(r.profit),
        profitTotal:    Number(r.profit_total ?? 0),
        roi:            r.roi      != null ? Number(r.roi)       : null,
        roiTotal:       r.roi_total != null ? Number(r.roi_total) : null,
        cpl:            r.cpl != null ? Number(r.cpl) : null,
        cpa:            r.cpa != null ? Number(r.cpa) : null,
      }))

      // ── Breakdown ───────────────────────────────────────────────────────────
      let breakdownRows: Record<string, unknown>[]

      if (groupBy === 'offer_id') {
        // viewing an offer → breakdown by ad_campaign_id
        const offerId = parseInt(id, 10)
        breakdownRows = await sql`
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
            a.ad_campaign_id                                                           AS break_key,
            NULL::text                                                                 AS break_name,
            MAX(db.username)                                                           AS buyer_name,
            COUNT(*)::int                                                              AS clicks,
            ROUND(SUM(a.marketing_cost), 2)                                           AS ad_spend,
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
                   / SUM(a.marketing_cost + a.tech_cost) * 100, 1) END                AS roi_total
          FROM agg_clicks a
          LEFT JOIN raw_keitaro_offers o ON o.id = a.offer_id
          LEFT JOIN scaleo_rev s ON s.aff_click_id = a.sub_id
          LEFT JOIN dict_buyers db ON db.buyer_id = a.buyer_id
          WHERE a.datetime >= ${dateFrom}::timestamptz
            AND a.datetime <  ${dateTo}::timestamptz + INTERVAL '1 day'
            AND COALESCE(o.id, a.offer_id) = ${offerId}
            AND a.ad_campaign_id IS NOT NULL AND a.ad_campaign_id != ''
          GROUP BY a.ad_campaign_id
          ORDER BY SUM(a.marketing_cost + a.tech_cost) DESC
        `
      } else {
        // viewing a campaign → breakdown by offer_id + offer name
        breakdownRows = await sql`
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
            COALESCE(o.id, a.offer_id)::bigint                                        AS break_key,
            COALESCE(o.name, a.offer_name)                                             AS break_name,
            MAX(db.username)                                                           AS buyer_name,
            COUNT(*)::int                                                              AS clicks,
            ROUND(SUM(a.marketing_cost), 2)                                           AS ad_spend,
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
                   / SUM(a.marketing_cost + a.tech_cost) * 100, 1) END                AS roi_total
          FROM agg_clicks a
          LEFT JOIN raw_keitaro_offers o ON o.id = a.offer_id
          LEFT JOIN scaleo_rev s ON s.aff_click_id = a.sub_id
          LEFT JOIN dict_buyers db ON db.buyer_id = a.buyer_id
          WHERE a.datetime >= ${dateFrom}::timestamptz
            AND a.datetime <  ${dateTo}::timestamptz + INTERVAL '1 day'
            AND a.ad_campaign_id = ${id}
            AND a.offer_id IS NOT NULL
          GROUP BY COALESCE(o.id, a.offer_id), COALESCE(o.name, a.offer_name)
          ORDER BY SUM(a.marketing_cost + a.tech_cost) DESC
        `
      }

      const breakdown = breakdownRows.map(r => {
        const bRoi      = r.roi      != null ? Number(r.roi)       : null
        const bRoiTotal = r.roi_total != null ? Number(r.roi_total) : null
        const bFtds     = Number(r.ftds)
        const bLeads    = Number(r.leads)
        const bCost     = Number(r.total_cost)
        return {
          key:            String(r.break_key),
          name:           r.break_name ? String(r.break_name) : null,
          buyer:          r.buyer_name ? String(r.buyer_name) : null,
          clicks:         Number(r.clicks),
          adSpend:        Number(r.ad_spend),
          totalCost:      bCost,
          leads:          bLeads,
          ftds:           bFtds,
          cvr:            bLeads > 0 ? Math.round(bFtds / bLeads * 1000) / 10 : null,
          revenue:        Number(r.revenue),
          revenuePending: Number(r.revenue_pending ?? 0),
          revenueTotal:   Number(r.revenue_total ?? 0),
          profit:         Number(r.profit),
          profitTotal:    Number(r.profit_total ?? 0),
          roi:            bRoi,
          roiTotal:       bRoiTotal,
          cpl:            bLeads > 0 ? Math.round(Number(r.ad_spend) / bLeads * 100) / 100 : null,
          cpa:            bFtds > 0  ? Math.round(Number(r.ad_spend) / bFtds  * 100) / 100 : null,
          signal:         classifySignal(bFtds, bRoi, bRoiTotal),
        }
      })

      const data = {
        id,
        name,
        groupBy,
        period: { from: dateFrom, to: dateTo },
        totals,
        daily,
        breakdown,
      }

      await cacheSet(cacheKey, data)
      return data

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[analytics/ad-performance-detail]', message)
      return reply.status(500).send({ error: message })
    }
  })
}
