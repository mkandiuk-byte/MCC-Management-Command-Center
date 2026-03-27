import type { FastifyInstance } from 'fastify'
import fs from 'fs'
import path from 'path'

const SOFT_PATH = process.env.WORKSPACE_PATH ?? ''
const CLAUDE_PATH = process.env.CLAUDE_PATH ?? ''
const SYNC_LOG = SOFT_PATH ? `${SOFT_PATH}/.sync.log` : ''

function getRepoCount(): number {
  try {
    return fs.readdirSync(SOFT_PATH, { withFileTypes: true })
      .filter(d => d.isDirectory() && fs.existsSync(path.join(SOFT_PATH, d.name, '.git'))).length
  } catch { return 0 }
}

function getSkillsCount(): number {
  try {
    const skillsPath = path.join(CLAUDE_PATH, 'Skills')
    return fs.readdirSync(skillsPath, { withFileTypes: true }).filter(d => d.isDirectory()).length
  } catch { return 0 }
}

function getLastSyncTime(): string | null {
  try {
    if (!SYNC_LOG || !fs.existsSync(SYNC_LOG)) return null
    const lines = fs.readFileSync(SYNC_LOG, 'utf-8').trim().split('\n').filter(Boolean)
    return lines[lines.length - 1] || null
  } catch { return null }
}

function getToolsCount(): number {
  try {
    const toolsPath = path.join(CLAUDE_PATH, 'Tools')
    let count = 0
    function countMd(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const e of entries) {
        if (e.isFile() && e.name.endsWith('.md')) count++
        else if (e.isDirectory()) countMd(path.join(dir, e.name))
      }
    }
    countMd(toolsPath); return count
  } catch { return 0 }
}

export async function statsRoutes(app: FastifyInstance) {
  app.get('/', async () => ({
    repos: getRepoCount(), skills: getSkillsCount(),
    tools: getToolsCount(), lastSync: getLastSyncTime(),
    timestamp: new Date().toISOString(),
  }))
}
