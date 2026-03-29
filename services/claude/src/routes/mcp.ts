import type { FastifyInstance } from 'fastify'
import fs from 'fs'
import path from 'path'
import os from 'os'

const USER_MCP_CONFIG = path.join(os.homedir(), '.claude.json')
const PROJECT_MCP_CONFIG = process.env.CLAUDE_PATH ? `${process.env.CLAUDE_PATH}/.mcp.json` : ''

interface McpServerEntry {
  name: string; command?: string; args: string[]; env: string[]
  scope: 'user' | 'project' | 'cloud'; type?: string; url?: string; connected?: boolean
}

function loadUserMcpServers(): McpServerEntry[] {
  try {
    const data = JSON.parse(fs.readFileSync(USER_MCP_CONFIG, 'utf-8'))
    const servers = data.mcpServers || {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Object.entries(servers).map(([name, cfg]: [string, any]) => ({
      name, scope: 'user' as const, type: cfg.type || 'stdio',
      command: cfg.command, args: cfg.args || [], env: Object.keys(cfg.env || {}), url: cfg.url,
    }))
  } catch { return [] }
}

function loadProjectMcpServers(): McpServerEntry[] {
  try {
    if (!PROJECT_MCP_CONFIG) return []
    const config = JSON.parse(fs.readFileSync(PROJECT_MCP_CONFIG, 'utf-8'))
    const servers = config.mcpServers || config.mcp_servers || {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Object.entries(servers).map(([name, cfg]: [string, any]) => ({
      name, scope: 'project' as const, type: cfg.type || 'stdio',
      command: cfg.command, args: cfg.args || [], env: Object.keys(cfg.env || {}), url: cfg.url,
    }))
  } catch { return [] }
}

export async function mcpRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const user = loadUserMcpServers()
    const project = loadProjectMcpServers()
    const all = [...user, ...project]
    return { servers: all, total: all.length, user: user.length, project: project.length }
  })
}
