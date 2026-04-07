import { sql } from '../lib/db.js';
import { detectCampaignType, classifyCampaign, buildRecommendation, parseCostModel, deriveMetrics, formatDate, } from '../lib/helpers.js';
const CACHE_TTL = 5 * 60 * 1000;
let _cache = null;
export async function campaignsRoutes(app) {
    // GET /api/analytics/campaigns
    app.get('/', async (req, reply) => {
        const q = req.query;
        const today = new Date();
        const dateFrom = q.from || formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
        const dateTo = q.to || formatDate(today);
        const cacheKey = `${dateFrom}|${dateTo}`;
        if (_cache && _cache.key === cacheKey && Date.now() - _cache.ts < CACHE_TTL) {
            return _cache.data;
        }
        try {
            // ── Query 1: main campaign stats ────────────────────────────────────────
            const [statsRows, offerRows] = await Promise.all([
                sql `
          SELECT
            c.id                                     AS campaign_id,
            c.name,
            c.alias,
            c.state,
            c.group_id,
            c.type                                   AS campaign_type_raw,
            c.traffic_source_id,
            c.cost_type,
            c.cost_value,
            c.domain_id,
            COUNT(*)::int                            AS clicks,
            SUM(a.is_lead::int)::int                 AS leads,
            SUM(a.is_sale::int)::int                 AS sales,
            (SUM(a.is_lead::int) + SUM(a.is_sale::int))::int AS conversions,
            COALESCE(SUM(a.revenue), 0)::float       AS revenue,
            COALESCE(SUM(a.cost), 0)::float          AS cost,
            COALESCE(SUM(a.marketing_cost), 0)::float AS marketing_cost,
            COALESCE(SUM(a.tech_cost), 0)::float     AS tech_cost
          FROM agg_clicks a
          JOIN raw_keitaro_campaigns c ON c.id = a.campaign_id
          WHERE a.datetime >= ${dateFrom}::timestamptz
            AND a.datetime <  ${dateTo}::timestamptz + INTERVAL '1 day'
          GROUP BY c.id, c.name, c.alias, c.state, c.group_id,
                   c.type, c.traffic_source_id, c.cost_type, c.cost_value, c.domain_id
          ORDER BY cost DESC, clicks DESC
        `,
                // ── Query 2: offer breakdown per campaign ───────────────────────────
                sql `
          SELECT
            a.campaign_id,
            COALESCE(o.name, a.offer_name, 'Unknown')  AS offer_name,
            COUNT(*)::int                               AS clicks,
            (SUM(a.is_lead::int) + SUM(a.is_sale::int))::int AS conversions,
            COALESCE(SUM(a.revenue), 0)::float          AS revenue,
            COALESCE(SUM(a.cost), 0)::float             AS cost
          FROM agg_clicks a
          LEFT JOIN raw_keitaro_offers o ON o.id = a.offer_id
          WHERE a.datetime >= ${dateFrom}::timestamptz
            AND a.datetime <  ${dateTo}::timestamptz + INTERVAL '1 day'
            AND a.campaign_id IS NOT NULL
          GROUP BY a.campaign_id, COALESCE(o.name, a.offer_name, 'Unknown')
          ORDER BY clicks DESC
        `,
            ]);
            // ── Build offer breakdown map ────────────────────────────────────────────
            const offerMap = new Map();
            for (const row of offerRows) {
                const cid = Number(row.campaign_id);
                if (!offerMap.has(cid))
                    offerMap.set(cid, []);
                const m = deriveMetrics(row.clicks, row.conversions, row.revenue, row.cost);
                offerMap.get(cid).push({
                    name: row.offer_name, clicks: row.clicks, conversions: row.conversions,
                    revenue: row.revenue, cost: row.cost, ...m, shareClicks: 0,
                });
            }
            for (const list of offerMap.values()) {
                const total = list.reduce((s, o) => s + o.clicks, 0);
                if (total > 0)
                    list.forEach(o => { o.shareClicks = (o.clicks / total) * 100; });
            }
            // ── Enrich campaigns ─────────────────────────────────────────────────────
            const campaigns = statsRows
                .filter(r => r.cost > 0 || r.clicks > 0)
                .map(r => {
                const name = r.name;
                const campaignType = detectCampaignType(name);
                const costModel = parseCostModel(String(r.cost_type ?? ''));
                const m = deriveMetrics(r.clicks, r.conversions, r.revenue, r.cost);
                const status = classifyCampaign(campaignType, r.cost, r.clicks, r.conversions, m.roi);
                const paybackMonths = campaignType === 'offer' && r.revenue > 0
                    ? (r.cost * 3) / r.revenue
                    : null;
                const recommendation = buildRecommendation(status, campaignType, r.cost, r.clicks, r.conversions, m.cpa, m.roi, m.cr, m.cpc, costModel, paybackMonths);
                return {
                    id: Number(r.campaign_id),
                    name,
                    alias: String(r.alias ?? ''),
                    state: String(r.state ?? 'unknown'),
                    group_id: Number(r.group_id ?? 0),
                    campaignType,
                    costModel,
                    trafficSourceId: Number(r.traffic_source_id ?? 0),
                    status,
                    stats: {
                        clicks: r.clicks,
                        conversions: r.conversions,
                        leads: r.leads,
                        sales: r.sales,
                        revenue: r.revenue,
                        cost: r.cost,
                        marketing_cost: r.marketing_cost,
                        tech_cost: r.tech_cost,
                        profit: m.profit,
                        roi: m.roi,
                        cr: m.cr,
                        cpa: m.cpa,
                        cpc: m.cpc,
                    },
                    paybackMonths,
                    recommendation,
                    offerBreakdown: offerMap.get(Number(r.campaign_id)) ?? [],
                    // agg_clicks pre-filtered to offer traffic → always 100% offer
                    subid9: { offer: 100 },
                };
            });
            campaigns.sort((a, b) => {
                if (a.state === 'active' && b.state !== 'active')
                    return -1;
                if (b.state === 'active' && a.state !== 'active')
                    return 1;
                return b.stats.cost - a.stats.cost;
            });
            const summary = {
                total: campaigns.length,
                active: campaigns.filter(c => c.state === 'active').length,
                success: campaigns.filter(c => c.status === 'success').length,
                failed: campaigns.filter(c => c.status === 'failed').length,
                decision: campaigns.filter(c => c.status === 'decision').length,
                no_data: campaigns.filter(c => c.status === 'no_data').length,
            };
            const data = {
                campaigns,
                summary,
                period: { from: dateFrom, to: dateTo },
                lastUpdated: new Date().toISOString(),
            };
            _cache = { data, ts: Date.now(), key: cacheKey };
            return data;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('[analytics/campaigns]', message);
            return reply.status(500).send({
                campaigns: [],
                summary: { total: 0, active: 0, success: 0, failed: 0, decision: 0, no_data: 0 },
                period: { from: dateFrom, to: dateTo },
                lastUpdated: new Date().toISOString(),
                error: message,
            });
        }
    });
    app.post('/', async () => { _cache = null; return { ok: true }; });
}
