import { cacheGet, cacheSet } from '../lib/redis.js';
import { sql } from '../lib/db.js';
import { formatDate } from '../lib/helpers.js';
export async function adPerformanceSparklinesRoutes(app) {
    app.get('/', async (req, reply) => {
        const q = req.query;
        const today = new Date();
        const dateFrom = q.from || formatDate(new Date(today.getTime() - 30 * 86400000));
        const dateTo = q.to || formatDate(today);
        const groupBy = q.group_by === 'offer_id' ? 'offer_id' : 'ad_campaign_id';
        const buyerId = q.buyer_id || null;
        const cacheKey = `adperf-sparklines:${dateFrom}|${dateTo}|${buyerId ?? ''}|${groupBy}`;
        const cached = await cacheGet(cacheKey);
        if (cached)
            return cached;
        try {
            let rows;
            if (groupBy === 'offer_id') {
                rows = await sql `
          WITH rev AS (
            SELECT aff_click_id,
              SUM(CASE WHEN conversion_status = 'Approved' THEN payout ELSE 0 END) AS approved_rev,
              SUM(CASE WHEN conversion_status = 'Pending'  THEN payout ELSE 0 END) AS pending_rev
            FROM raw_scaleo_conversions
            GROUP BY aff_click_id
          )
          SELECT
            COALESCE(a.offer_id, 0)::bigint                                         AS group_key,
            (a.datetime AT TIME ZONE 'UTC')::date                                   AS day,
            ROUND(SUM(a.marketing_cost + a.tech_cost), 2)                           AS spend,
            ROUND(
              COALESCE(SUM(r.approved_rev + r.pending_rev), 0)
              - SUM(a.marketing_cost + a.tech_cost), 2
            )                                                                        AS profit
          FROM agg_clicks a
          LEFT JOIN rev r ON r.aff_click_id = a.sub_id
          WHERE a.datetime >= ${dateFrom}::timestamptz
            AND a.datetime <  ${dateTo}::timestamptz + INTERVAL '1 day'
            AND a.offer_id IS NOT NULL
            ${buyerId ? sql `AND a.buyer_id = ${buyerId}` : sql ``}
          GROUP BY a.offer_id, (a.datetime AT TIME ZONE 'UTC')::date
          ORDER BY group_key, day
        `;
            }
            else {
                rows = await sql `
          WITH rev AS (
            SELECT aff_click_id,
              SUM(CASE WHEN conversion_status = 'Approved' THEN payout ELSE 0 END) AS approved_rev,
              SUM(CASE WHEN conversion_status = 'Pending'  THEN payout ELSE 0 END) AS pending_rev
            FROM raw_scaleo_conversions
            GROUP BY aff_click_id
          )
          SELECT
            a.ad_campaign_id                                                         AS group_key,
            (a.datetime AT TIME ZONE 'UTC')::date                                   AS day,
            ROUND(SUM(a.marketing_cost + a.tech_cost), 2)                           AS spend,
            ROUND(
              COALESCE(SUM(r.approved_rev + r.pending_rev), 0)
              - SUM(a.marketing_cost + a.tech_cost), 2
            )                                                                        AS profit
          FROM agg_clicks a
          LEFT JOIN rev r ON r.aff_click_id = a.sub_id
          WHERE a.datetime >= ${dateFrom}::timestamptz
            AND a.datetime <  ${dateTo}::timestamptz + INTERVAL '1 day'
            AND a.ad_campaign_id IS NOT NULL AND a.ad_campaign_id != ''
            ${buyerId ? sql `AND a.buyer_id = ${buyerId}` : sql ``}
          GROUP BY a.ad_campaign_id, (a.datetime AT TIME ZONE 'UTC')::date
          ORDER BY group_key, day
        `;
            }
            const result = {};
            for (const r of rows) {
                const key = String(r.group_key);
                if (!result[key])
                    result[key] = [];
                result[key].push({
                    day: String(r.day).slice(0, 10),
                    spend: Number(r.spend),
                    profit: Number(r.profit),
                });
            }
            await cacheSet(cacheKey, result, 300);
            return result;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            app.log.error('[ad-performance/sparklines] ' + message);
            return reply.status(500).send({ error: message });
        }
    });
}
