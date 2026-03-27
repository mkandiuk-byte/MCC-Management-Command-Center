import type { FastifyInstance } from 'fastify'
import fs from 'fs'
import path from 'path'
import { getBoard, parseBoardUrl } from '../lib/jira.js'

const CONFIG_PATH = process.env.PANEL_CONFIG_PATH
  ?? path.join(process.env.PANEL_ROOT ?? process.cwd(), '.panel-config.json')

interface JiraBoardConfig { id: string; boardId: number; projectKey: string; displayName: string; url: string }
interface PanelConfig { scanDirs: string[]; jiraBoards?: JiraBoardConfig[] }

function readConfig(): PanelConfig {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) }
  catch { return { scanDirs: [] } }
}

function writeConfig(config: PanelConfig) { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)) }

export async function configRoutes(app: FastifyInstance) {
  app.get('/', async () => ({ boards: readConfig().jiraBoards ?? [] }))

  app.post('/', async (req, reply) => {
    const { url, displayName } = (req.body ?? {}) as { url?: string; displayName?: string }
    if (!url) return reply.status(400).send({ error: 'url is required' })
    const parsed = parseBoardUrl(url)
    if (!parsed) return reply.status(400).send({ error: 'Could not parse board URL. Expected format: .../projects/KEY/boards/ID' })
    const { boardId, projectKey } = parsed
    let boardName = displayName
    try { const board = await getBoard(boardId); boardName = displayName || board.name }
    catch { boardName = displayName || `Board #${boardId}` }
    const config = readConfig()
    if (!config.jiraBoards) config.jiraBoards = []
    if (config.jiraBoards.some(b => b.boardId === boardId)) return reply.status(409).send({ error: 'Board already added' })
    const entry: JiraBoardConfig = { id: String(boardId), boardId, projectKey, displayName: boardName ?? `Board #${boardId}`, url }
    config.jiraBoards.push(entry); writeConfig(config)
    return { board: entry }
  })

  app.patch('/', async (req, reply) => {
    const { boardId, displayName } = (req.body ?? {}) as { boardId?: number; displayName?: string }
    const config = readConfig()
    const board = config.jiraBoards?.find(b => b.boardId === boardId)
    if (!board) return reply.status(404).send({ error: 'Not found' })
    board.displayName = displayName ?? board.displayName; writeConfig(config)
    return { board }
  })

  app.delete('/', async (req) => {
    const { boardId } = (req.body ?? {}) as { boardId?: number }
    const config = readConfig()
    config.jiraBoards = (config.jiraBoards ?? []).filter(b => b.boardId !== boardId)
    writeConfig(config); return { ok: true }
  })
}
