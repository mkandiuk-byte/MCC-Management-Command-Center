import { sql } from '../lib/db.js';
import { normalizeSchema, parseOfferName, formatDate } from '../lib/helpers.js';
import { applyDagreLayout } from '../lib/layout.js';
const CACHE_TTL = 10 * 60 * 1000;
const _cache = new Map();
export async function graphCampaignRoutes(app) {
    // GET /api/analytics/graph/campaign/:id?from=...&to=...
    app.get('/:id', async (req, reply) => {
        const campaignId = parseInt(req.params.id, 10);
        if (isNaN(campaignId))
            return reply.status(400).send({ error: 'Invalid campaign id' });
        const q = req.query;
        const today = new Date();
        const dateFrom = q.from || formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
        const dateTo = q.to || formatDate(today);
        const cacheKey = `${campaignId}|${dateFrom}|${dateTo}`;
        const cached = _cache.get(cacheKey);
        if (cached && Date.now() - cached.ts < CACHE_TTL)
            return cached.data;
        try {
            // ── Query 1: stream × offer stats for this campaign ─────────────────
            const statsRows = await sql `
        SELECT
          e.stream_id,
          e.offer_id,
          COUNT(*)::int                                           AS clicks,
          SUM(CASE WHEN e.status = 'approved' THEN 1 ELSE 0 END)::int AS conversions,
          COALESCE(SUM(e.revenue), 0)::float                     AS revenue,
          COALESCE(SUM(e.cost), 0)::float                        AS cost
        FROM transform_events_cleaned e
        WHERE e.datetime    >= ${dateFrom}::timestamptz
          AND e.datetime    <  ${dateTo}::timestamptz + INTERVAL '1 day'
          AND e.campaign_id =  ${campaignId}
          AND e.stream_id   IS NOT NULL
          AND e.offer_id    IS NOT NULL
        GROUP BY e.stream_id, e.offer_id
        ORDER BY clicks DESC
        LIMIT 2000
      `;
            if (statsRows.length === 0) {
                return {
                    nodes: [], edges: [],
                    period: { from: dateFrom, to: dateTo },
                    lastUpdated: new Date().toISOString(),
                };
            }
            const streamIds = [...new Set(statsRows.map(r => Number(r.stream_id)))];
            const offerIds = [...new Set(statsRows.map(r => Number(r.offer_id)))];
            // ── Query 2: metadata ────────────────────────────────────────────────
            const [streamMeta, offerMeta] = await Promise.all([
                sql `
          SELECT id, name, schema, type, weight, state, position
          FROM raw_keitaro_streams
          WHERE id = ANY(${streamIds}::bigint[])
          ORDER BY position ASC
        `,
                sql `
          SELECT id, name, country, payout_value::float, payout_type, payout_upsell
          FROM raw_keitaro_offers
          WHERE id = ANY(${offerIds}::bigint[])
        `,
            ]);
            const streamByIdMap = new Map(streamMeta.map(r => [Number(r.id), r]));
            const offerByIdMap = new Map(offerMeta.map(r => [Number(r.id), r]));
            const streamAccum = new Map();
            const offerAccum = new Map();
            for (const r of statsRows) {
                const sid = Number(r.stream_id);
                const oid = Number(r.offer_id);
                if (!streamAccum.has(sid))
                    streamAccum.set(sid, { clicks: 0, conversions: 0, revenue: 0, cost: 0 });
                if (!offerAccum.has(oid))
                    offerAccum.set(oid, { clicks: 0, conversions: 0, revenue: 0, cost: 0 });
                for (const acc of [streamAccum.get(sid), offerAccum.get(oid)]) {
                    acc.clicks += r.clicks;
                    acc.conversions += r.conversions;
                    acc.revenue += r.revenue;
                    acc.cost += r.cost;
                }
            }
            function finalStats(a) {
                const profit = a.revenue - a.cost;
                return {
                    ...a, profit,
                    roi: a.cost > 0 ? (profit / a.cost) * 100 : 0,
                    cr: a.clicks > 0 ? (a.conversions / a.clicks) * 100 : 0,
                    cpa: a.conversions > 0 ? a.cost / a.conversions : 0,
                };
            }
            // ── Build bipartite graph: streams (top) → offers (bottom) ───────────
            const nodes = [];
            const edges = [];
            const offerNodeSeen = new Set();
            for (const sid of streamIds) {
                const sm = streamByIdMap.get(sid);
                const streamNodeId = `stream:${sid}`;
                nodes.push({
                    id: streamNodeId,
                    type: 'stream',
                    position: { x: 0, y: 0 },
                    data: {
                        label: sm ? String(sm.name) : `Stream ${sid}`,
                        type: 'stream',
                        schema: normalizeSchema(sm ? String(sm.schema ?? '') : ''),
                        weight: sm ? Number(sm.weight) : 100,
                        streamStatus: sm ? String(sm.state) : 'active',
                        campaignId,
                        ...finalStats(streamAccum.get(sid) ?? { clicks: 0, conversions: 0, revenue: 0, cost: 0 }),
                    },
                });
            }
            for (const r of statsRows) {
                const sid = Number(r.stream_id);
                const oid = Number(r.offer_id);
                const streamNodeId = `stream:${sid}`;
                const offerNodeId = `offer:${oid}`;
                if (!offerNodeSeen.has(oid)) {
                    offerNodeSeen.add(oid);
                    const om = offerByIdMap.get(oid);
                    const offerName = om ? String(om.name) : `Offer ${oid}`;
                    const op = parseOfferName(offerName);
                    nodes.push({
                        id: offerNodeId,
                        type: 'offer',
                        position: { x: 0, y: 0 },
                        data: {
                            label: offerName,
                            type: 'offer',
                            offerBrand: op.brand,
                            offerGeo: op.geo,
                            offerSource: op.source,
                            offerLandingType: op.landingType,
                            offerTier: op.tier,
                            offerConvAction: op.convAction,
                            offerNetwork: op.network,
                            ...finalStats(offerAccum.get(oid) ?? { clicks: 0, conversions: 0, revenue: 0, cost: 0 }),
                        },
                    });
                }
                edges.push({
                    id: `e:${streamNodeId}→${offerNodeId}`,
                    source: streamNodeId,
                    target: offerNodeId,
                    clicks: r.clicks,
                    conversions: r.conversions,
                });
            }
            const positionedNodes = applyDagreLayout(nodes, edges, { rankdir: 'TB', nodesep: 32, ranksep: 180 });
            const data = {
                nodes: positionedNodes,
                edges,
                period: { from: dateFrom, to: dateTo },
                lastUpdated: new Date().toISOString(),
            };
            _cache.set(cacheKey, { data, ts: Date.now() });
            return data;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[analytics/graph/campaign/${campaignId}]`, message);
            return reply.status(500).send({
                nodes: [], edges: [],
                period: { from: dateFrom, to: dateTo },
                lastUpdated: new Date().toISOString(),
                error: message,
            });
        }
    });
    app.post('/:id', async (req) => {
        const cid = parseInt(req.params.id, 10);
        for (const key of _cache.keys()) {
            if (key.startsWith(`${cid}|`))
                _cache.delete(key);
        }
        return { ok: true };
    });
}
