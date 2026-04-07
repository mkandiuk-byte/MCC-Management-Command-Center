import Fastify from 'fastify'
import cors from '@fastify/cors'
import { graphRoutes } from './routes/graph.js'
import { campaignGraphRoutes } from './routes/campaign.js'

const PORT = parseInt(process.env.PORT ?? '3805', 10)

const app = Fastify({ logger: { level: 'info' } })

await app.register(cors, {
  origin: [
    'http://localhost:3777',
    process.env.PANEL_ORIGIN ?? 'http://localhost:3777',
  ],
})

await app.register(graphRoutes,         { prefix: '/api/graph' })
await app.register(campaignGraphRoutes, { prefix: '/api/graph/campaign' })

app.get('/health', async () => ({ ok: true, service: 'graph', ts: Date.now() }))

try {
  await app.listen({ port: PORT, host: '127.0.0.1' })
  console.log(`[graph] listening on http://127.0.0.1:${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
