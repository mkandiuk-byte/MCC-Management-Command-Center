import Fastify from 'fastify'
import cors from '@fastify/cors'
import { instructionsRoutes } from './routes/instructions.js'
import { skillsRoutes } from './routes/skills.js'
import { mcpRoutes } from './routes/mcp.js'
import { toolsRoutes } from './routes/tools.js'
import { statsRoutes } from './routes/stats.js'

const PORT = parseInt(process.env.PORT ?? '3804', 10)

const app = Fastify({ logger: { level: 'info' } })

await app.register(cors, {
  origin: [
    'http://localhost:3777',
    process.env.PANEL_ORIGIN ?? 'http://localhost:3777',
  ],
})

await app.register(instructionsRoutes, { prefix: '/api/claude/instructions' })
await app.register(skillsRoutes,       { prefix: '/api/claude/skills' })
await app.register(mcpRoutes,          { prefix: '/api/claude/mcp' })
await app.register(toolsRoutes,        { prefix: '/api/claude/tools' })
await app.register(statsRoutes,        { prefix: '/api/stats' })

app.get('/health', async () => ({ ok: true, service: 'claude', ts: Date.now() }))

try {
  await app.listen({ port: PORT, host: '127.0.0.1' })
  console.log(`[claude] listening on http://127.0.0.1:${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
