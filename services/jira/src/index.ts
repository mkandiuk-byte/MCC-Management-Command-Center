import Fastify from 'fastify'
import cors from '@fastify/cors'
import { statsRoutes } from './routes/stats.js'
import { configRoutes } from './routes/config.js'
import { boardsRoutes } from './routes/boards.js'
import { githubRepoStatsRoutes } from './routes/github-repo-stats.js'

const PORT = parseInt(process.env.PORT ?? '3802', 10)

const app = Fastify({ logger: { level: 'info' } })

await app.register(cors, {
  origin: [
    'http://localhost:3777',
    process.env.PANEL_ORIGIN ?? 'http://localhost:3777',
  ],
})

await app.register(statsRoutes,            { prefix: '/api/jira/stats' })
await app.register(configRoutes,           { prefix: '/api/jira/config' })
await app.register(boardsRoutes,           { prefix: '/api/jira/boards' })
await app.register(githubRepoStatsRoutes,  { prefix: '/api/github/repo-stats' })

app.get('/health', async () => ({ ok: true, service: 'jira', ts: Date.now() }))

try {
  await app.listen({ port: PORT, host: '127.0.0.1' })
  console.log(`[jira] listening on http://127.0.0.1:${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
