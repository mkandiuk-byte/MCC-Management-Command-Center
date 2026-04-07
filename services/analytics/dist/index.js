import Fastify from 'fastify';
import cors from '@fastify/cors';
import { campaignsRoutes } from './routes/campaigns.js';
import { campaignStreamsRoutes } from './routes/campaign-streams.js';
import { offersRoutes } from './routes/offers.js';
import { chainRoutes } from './routes/chain.js';
import { reportRoutes } from './routes/report.js';
import { geoBenchmarksRoutes } from './routes/geo-benchmarks.js';
import { graphRoutes } from './routes/graph.js';
import { graphCampaignRoutes } from './routes/graph-campaign.js';
import { adPerformanceRoutes } from './routes/ad-performance.js';
import { adPerformanceDetailRoutes } from './routes/ad-performance-detail.js';
import { adPerformanceSparklinesRoutes } from './routes/ad-performance-sparklines.js';
const PORT = parseInt(process.env.PORT ?? '3806', 10);
const app = Fastify({ logger: { level: 'info' } });
await app.register(cors, {
    origin: [
        'http://localhost:3777',
        process.env.PANEL_ORIGIN ?? 'http://localhost:3777',
    ],
});
await app.register(campaignsRoutes, { prefix: '/api/analytics/campaigns' });
await app.register(campaignStreamsRoutes, { prefix: '/api/analytics/campaigns' });
await app.register(offersRoutes, { prefix: '/api/analytics/offers' });
await app.register(chainRoutes, { prefix: '/api/analytics/chain' });
await app.register(reportRoutes, { prefix: '/api/analytics/report' });
await app.register(geoBenchmarksRoutes, { prefix: '/api/analytics/geo-benchmarks' });
await app.register(graphRoutes, { prefix: '/api/analytics/graph' });
await app.register(graphCampaignRoutes, { prefix: '/api/analytics/graph/campaign' });
await app.register(adPerformanceRoutes, { prefix: '/api/analytics/ad-performance' });
await app.register(adPerformanceDetailRoutes, { prefix: '/api/analytics/ad-performance/detail' });
await app.register(adPerformanceSparklinesRoutes, { prefix: '/api/analytics/ad-performance/sparklines' });
app.get('/health', async () => ({ ok: true, service: 'analytics', ts: Date.now() }));
try {
    await app.listen({ port: PORT, host: '127.0.0.1' });
    console.log(`[analytics] listening on http://127.0.0.1:${PORT}`);
}
catch (err) {
    app.log.error(err);
    process.exit(1);
}
