import { sql } from '../lib/db.js';
import { formatDate } from '../lib/helpers.js';
const CACHE_TTL = 5 * 60 * 1000;
const _cache = new Map();
const DIM_MAP = {
    day: { expr: "DATE_TRUNC('day', a.datetime)", alias: 'day' },
    week: { expr: "DATE_TRUNC('week', a.datetime)", alias: 'week' },
    month: { expr: "DATE_TRUNC('month', a.datetime)", alias: 'month' },
    hour: { expr: "DATE_TRUNC('hour', a.datetime)", alias: 'hour' },
    campaign: { expr: 'c.name', alias: 'campaign', join: 'LEFT JOIN raw_keitaro_campaigns c ON c.id = a.campaign_id' },
    offer: { expr: "COALESCE(o.name, a.offer_name, 'Unknown')", alias: 'offer', join: 'LEFT JOIN raw_keitaro_offers o ON o.id = a.offer_id' },
    country: { expr: 'a.country_code', alias: 'country_code' },
    device_type: { expr: 'a.device_type', alias: 'device_type' },
    os: { expr: 'a.os', alias: 'os' },
    browser: { expr: 'a.browser', alias: 'browser' },
    language: { expr: 'a.language', alias: 'language' },
    ad_campaign_id: { expr: 'a.ad_campaign_id', alias: 'ad_campaign_id' },
    buyer: { expr: 'a.buyer_id', alias: 'buyer_id' },
    funnel: { expr: 'a.funnel', alias: 'funnel' },
    funnel_category: { expr: 'a.funnel_category', alias: 'funnel_category' },
    cloak_campaign: { expr: 'a.cloak_campaign_id', alias: 'cloak_campaign_id' },
};
// ─── Measure → SQL aggregate expression (null = computed in JS) ───────────────
const MEASURE_SQL = {
    clicks: "COUNT(*)::int",
    conversions: "(SUM(a.is_sale::int) + SUM(a.is_lead::int))::int",
    leads: "SUM(a.is_lead::int)::int",
    sales: "SUM(a.is_sale::int)::int",
    revenue: "COALESCE(SUM(a.revenue), 0)::float",
    cost: "COALESCE(SUM(a.cost), 0)::float",
    tech_cost: "COALESCE(SUM(a.tech_cost), 0)::float",
    marketing_cost: "COALESCE(SUM(a.marketing_cost), 0)::float",
    profit: "COALESCE(SUM(a.revenue - a.cost), 0)::float",
    // computed in JS after fetch:
    roi: null,
    cr: null,
    cpa: null,
    epc: null,
};
const VALID_DIMS = new Set(Object.keys(DIM_MAP));
const VALID_MEASURES = new Set(Object.keys(MEASURE_SQL));
export async function reportRoutes(app) {
    // GET /api/analytics/report?dimensions=day,campaign&measures=clicks,revenue&from=...&to=...
    app.get('/', async (req, reply) => {
        const q = req.query;
        const today = new Date();
        const dateFrom = q.from || formatDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));
        const dateTo = q.to || formatDate(today);
        const rawDims = (q.dimensions ?? 'day').split(',').map(s => s.trim()).filter(Boolean);
        const rawMeasures = (q.measures ?? 'clicks,revenue').split(',').map(s => s.trim()).filter(Boolean);
        const limit = Math.min(Math.max(1, parseInt(q.limit ?? '200', 10)), 1000);
        const dims = rawDims.filter(d => VALID_DIMS.has(d));
        const measures = rawMeasures.filter(m => VALID_MEASURES.has(m));
        if (dims.length === 0)
            return reply.status(400).send({ error: 'Invalid or unsupported dimensions. Valid: ' + [...VALID_DIMS].join(', ') });
        if (measures.length === 0)
            return reply.status(400).send({ error: 'Invalid or unsupported measures. Valid: ' + [...VALID_MEASURES].join(', ') });
        const sortBy = VALID_MEASURES.has(q.sort_by ?? '') ? q.sort_by : measures[0];
        const cacheKey = JSON.stringify({ dateFrom, dateTo, dims, measures, limit, sortBy });
        const cached = _cache.get(cacheKey);
        if (cached && Date.now() - cached.ts < CACHE_TTL)
            return cached.data;
        try {
            // ── Build dynamic SQL ────────────────────────────────────────────────────
            // Collect unique JOINs
            const joins = new Set();
            const dimExprs = dims.map(d => {
                const def = DIM_MAP[d];
                if (def.join)
                    joins.add(def.join);
                return `${def.expr} AS ${def.alias}`;
            });
            // Direct SQL measures only (skip computed ones)
            const sqlMeasures = measures
                .filter(m => MEASURE_SQL[m] !== null)
                .map(m => `${MEASURE_SQL[m]} AS ${m}`);
            // We always need clicks + conversions for computing derived metrics
            const needClicks = !measures.includes('clicks');
            const needConversions = !measures.includes('conversions') && (measures.includes('cr') || measures.includes('cpa'));
            const needRevenue = !measures.includes('revenue') && (measures.includes('profit') || measures.includes('roi') || measures.includes('epc'));
            const needCost = !measures.includes('cost') && (measures.includes('profit') || measures.includes('roi') || measures.includes('cpa'));
            const extraMeasures = [];
            if (needClicks)
                extraMeasures.push('COUNT(*)::int AS _clicks');
            if (needConversions)
                extraMeasures.push('(SUM(a.is_sale::int) + SUM(a.is_lead::int))::int AS _conversions');
            if (needRevenue)
                extraMeasures.push('COALESCE(SUM(a.revenue), 0)::float AS _revenue');
            if (needCost)
                extraMeasures.push('COALESCE(SUM(a.cost), 0)::float AS _cost');
            const selectList = [...dimExprs, ...sqlMeasures, ...extraMeasures].join(', ');
            const groupList = dimExprs.map(e => e.split(' AS ')[0]).join(', ');
            const joinList = [...joins].join('\n');
            // Sort expression — only sort by SQL-computed measures (not derived)
            const sortExpr = MEASURE_SQL[sortBy] !== null ? sortBy : 'clicks';
            const queryStr = `
        SELECT ${selectList}
        FROM agg_clicks a
        ${joinList}
        WHERE a.datetime >= '${dateFrom}'::timestamptz
          AND a.datetime <  '${dateTo}'::timestamptz + INTERVAL '1 day'
        GROUP BY ${groupList}
        ORDER BY ${sortExpr} DESC NULLS LAST
        LIMIT ${limit}
      `;
            // Execute as unsafe (dynamic SQL — dimensions are whitelisted above)
            const rawRows = await sql.unsafe(queryStr);
            // ── Compute derived metrics in JS ────────────────────────────────────────
            const rows = rawRows.map(row => {
                const r = { ...row };
                const clicks = Number(r['clicks'] ?? r['_clicks'] ?? 0);
                const conversions = Number(r['conversions'] ?? r['_conversions'] ?? 0);
                const revenue = Number(r['revenue'] ?? r['_revenue'] ?? 0);
                const cost = Number(r['cost'] ?? r['_cost'] ?? 0);
                const profit = Number(r['profit'] ?? (revenue - cost));
                if (measures.includes('roi'))
                    r['roi'] = cost > 0 ? (profit / cost) * 100 : 0;
                if (measures.includes('cr'))
                    r['cr'] = clicks > 0 ? (conversions / clicks) * 100 : 0;
                if (measures.includes('cpa'))
                    r['cpa'] = conversions > 0 ? cost / conversions : 0;
                if (measures.includes('epc'))
                    r['epc'] = clicks > 0 ? revenue / clicks : 0;
                // Remove helper columns
                delete r['_clicks'];
                delete r['_conversions'];
                delete r['_revenue'];
                delete r['_cost'];
                return r;
            });
            const data = { rows, period: { from: dateFrom, to: dateTo } };
            _cache.set(cacheKey, { data, ts: Date.now() });
            return data;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('[analytics/report]', message);
            return reply.status(500).send({ rows: [], error: message });
        }
    });
}
