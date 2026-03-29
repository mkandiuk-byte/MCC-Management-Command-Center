import type { FastifyInstance } from 'fastify'
import fs from 'fs'
import os from 'os'

const LOG_FILES: Record<string, string> = {
  sync:             process.env.WORKSPACE_PATH ? `${process.env.WORKSPACE_PATH}/.sync.log` : '',
  'aap-panel':      `${os.homedir()}/Library/Logs/aap-panel.log`,
  'aap-panel-error':`${os.homedir()}/Library/Logs/aap-panel-error.log`,
  sita:             process.env.SITA_LOG_PATH ?? '',
}

export async function logsRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const { log: logName = 'sync', lines: linesStr = '100' } = req.query as { log?: string; lines?: string }
    const lines = parseInt(linesStr, 10)

    const logPath = LOG_FILES[logName]
    if (!logPath) return reply.status(400).send({ error: 'Unknown log', available: Object.keys(LOG_FILES) })
    if (!fs.existsSync(logPath)) return { lines: [], path: logPath, exists: false }

    try {
      const content = fs.readFileSync(logPath, 'utf-8')
      const allLines = content.split('\n').filter(Boolean)
      return { lines: allLines.slice(-lines), total: allLines.length, path: logPath, exists: true, available: Object.keys(LOG_FILES) }
    } catch (e: unknown) {
      return reply.status(500).send({ error: e instanceof Error ? e.message : String(e) })
    }
  })
}
