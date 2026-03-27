import Fastify from 'fastify'
import cors from '@fastify/cors'
import { terminalRoutes } from './routes/terminal.js'
import { fsRoutes } from './routes/fs.js'
import { reposRoutes } from './routes/repos.js'
import { logsRoutes } from './routes/logs.js'
import { searchRoutes } from './routes/search.js'
import { actionsRoutes } from './routes/actions.js'

const PORT = parseInt(process.env.PORT ?? '3803', 10)

const app = Fastify({ logger: { level: 'info' } })

await app.register(cors, {
  origin: [
    'http://localhost:3777',
    process.env.PANEL_ORIGIN ?? 'http://localhost:3777',
  ],
})

await app.register(terminalRoutes, { prefix: '/api/terminal' })
await app.register(fsRoutes,       { prefix: '/api/fs' })
await app.register(reposRoutes,    { prefix: '/api/repos' })
await app.register(logsRoutes,     { prefix: '/api/logs' })
await app.register(searchRoutes,   { prefix: '/api/search' })
await app.register(actionsRoutes,  { prefix: '/api/actions' })

app.get('/health', async () => ({ ok: true, service: 'workspace', ts: Date.now() }))

try {
  await app.listen({ port: PORT, host: '127.0.0.1' })
  console.log(`[workspace] listening on http://127.0.0.1:${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
