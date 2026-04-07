import { sql } from '../lib/db.js';
import { detectCampaignType } from '../lib/helpers.js';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
let _cache = null;
const MIN_COST = 150;
const MIN_CLICKS = 100;
// Extract 2-3 letter geo code from campaign name (same logic as keitaro service)
function extractGeo(name) {
    const prefix = name.match(/^[\[{(]?([A-Z]{2,3})[\]})\s_\-|]/)?.[1];
    if (prefix)
        return prefix;
    const m = name.match(/\b(AU|NZ|GB|IE|CA|US|BR|MX|AR|CL|CO|PE|DE|FR|ES|IT|PL|NL|PT|RU|UA|TR|ZA|NG|KE|GH|IN|PH|TH|VN|ID|MY|SG|JP|KR)\b/);
    return m ? m[1] : 'Unknown';
}
export async function geoBenchmarksRoutes(app) {
    app.get('/', async (_req, reply) => {
        if (_cache && Date.now() - _cache.ts < CACHE_TTL)
            return _cache.data;
        try {
            const today = new Date();
            const yearAgo = new Date(today);
            yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            const dateFrom = yearAgo.toISOString().split('T')[0];
            const dateTo = today.toISOString().split('T')[0];
            const rows = await sql `
        SELECT
          c.id,
          c.name,
          c.type,
          COUNT(*)::int                             AS clicks,
          (SUM(a.is_sale::int) + SUM(a.is_lead::int))::int AS conversions,
          COALESCE(SUM(a.revenue), 0)::float        AS revenue,
          COALESCE(SUM(a.cost), 0)::float           AS cost
        FROM agg_clicks a
        JOIN raw_keitaro_campaigns c ON c.id = a.campaign_id
        WHERE a.datetime >= ${dateFrom}::timestamptz
          AND a.datetime <  ${dateTo}::timestamptz + INTERVAL '1 day'
        GROUP BY c.id, c.name, c.type
        ORDER BY cost DESC
      `;
            const geoMap = new Map();
            for (const r of rows) {
                const type = detectCampaignType(String(r.name));
                if (type !== 'offer')
                    continue;
                if (r.cost < MIN_COST || r.clicks < MIN_CLICKS)
                    continue;
                if (r.conversions === 0)
                    continue;
                const profit = r.revenue - r.cost;
                const roi = r.cost > 0 ? (profit / r.cost) * 100 : 0;
                if (roi < 0)
                    continue;
                const cpa = r.cost / r.conversions;
                if (cpa <= 0)
                    continue;
                const geo = extractGeo(String(r.name));
                if (!geoMap.has(geo))
                    geoMap.set(geo, []);
                geoMap.get(geo).push(cpa);
            }
            const benchmarks = [...geoMap.entries()]
                .map(([geo, cpas]) => ({
                geo,
                count: cpas.length,
                avgCpa: cpas.reduce((a, b) => a + b, 0) / cpas.length,
                minCpa: Math.min(...cpas),
                maxCpa: Math.max(...cpas),
            }))
                .sort((a, b) => b.count - a.count);
            const data = {
                benchmarks,
                period: { from: dateFrom, to: dateTo },
                lastUpdated: new Date().toISOString(),
            };
            _cache = { data, ts: Date.now() };
            return data;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('[analytics/geo-benchmarks]', message);
            return reply.status(500).send({ benchmarks: [], period: { from: '', to: '' }, lastUpdated: new Date().toISOString(), error: message });
        }
    });
    app.post('/', async () => { _cache = null; return { ok: true }; });
}
