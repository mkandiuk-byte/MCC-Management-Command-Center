import Fastify from 'fastify'
import cors from '@fastify/cors'
import { offersRoutes } from './routes/offers.js'
import { campaignsRoutes } from './routes/campaigns.js'
import { geoBenchmarksRoutes } from './routes/geo-benchmarks.js'

const PORT = parseInt(process.env.PORT ?? '3801', 10)

const app = Fastify({ logger: { level: 'info' } })

await app.register(cors, {
  origin: [
    'http://localhost:3777',
    process.env.PANEL_ORIGIN ?? 'http://localhost:3777',
  ],
})

await app.register(offersRoutes,         { prefix: '/api/keitaro/offers' })
await app.register(campaignsRoutes,      { prefix: '/api/keitaro/campaigns' })
await app.register(geoBenchmarksRoutes,  { prefix: '/api/keitaro/geo-benchmarks' })

app.get('/health', async () => ({ ok: true, service: 'keitaro', ts: Date.now() }))

try {
  await app.listen({ port: PORT, host: '127.0.0.1' })
  console.log(`[keitaro] listening on http://127.0.0.1:${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
