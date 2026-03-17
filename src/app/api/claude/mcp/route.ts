import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'

// User-level MCPs (~/.claude.json)
const USER_MCP_CONFIG = path.join(os.homedir(), '.claude.json')
// Project-level MCP (.mcp.json in CLAUDE workspace)
const PROJECT_MCP_CONFIG = process.env.CLAUDE_PATH ? `${process.env.CLAUDE_PATH}/.mcp.json` : ''
// Auth needs cache (cloud connectors)
const MCP_AUTH_CACHE = path.join(os.homedir(), '.claude', 'mcp-needs-auth-cache.json')

interface McpServerEntry {
  name: string
  command?: string
  args: string[]
  env: string[]
  scope: 'user' | 'project' | 'cloud'
  type?: string
  url?: string
  connected?: boolean
}

function loadUserMcpServers(): McpServerEntry[] {
  try {
    const raw = fs.readFileSync(USER_MCP_CONFIG, 'utf-8')
    const data = JSON.parse(raw)
    const servers = data.mcpServers || {}
    return Object.entries(servers).map(([name, cfg]: [string, any]) => ({
      name,
      scope: 'user' as const,
      type: cfg.type || 'stdio',
      command: cfg.command,
      args: cfg.args || [],
      env: Object.keys(cfg.env || {}),
      url: cfg.url,
    }))
  } catch {
    return []
  }
}

function loadProjectMcpServers(): McpServerEntry[] {
  try {
    const raw = fs.readFileSync(PROJECT_MCP_CONFIG, 'utf-8')
    const config = JSON.parse(raw)
    const servers = config.mcpServers || config.mcp_servers || {}
    return Object.entries(servers).map(([name, cfg]: [string, any]) => ({
      name,
      scope: 'project' as const,
      type: cfg.type || 'stdio',
      command: cfg.command,
      args: cfg.args || [],
      env: Object.keys(cfg.env || {}),
      url: cfg.url,
    }))
  } catch {
    return []
  }
}

function loadCloudConnectors(): McpServerEntry[] {
  try {
    const raw = fs.readFileSync(MCP_AUTH_CACHE, 'utf-8')
    const cache = JSON.parse(raw)
    return Object.keys(cache).map(name => ({
      name,
      scope: 'cloud' as const,
      type: 'http',
      args: [],
      env: [],
    }))
  } catch {
    return []
  }
}

export async function GET() {
  const userServers = loadUserMcpServers()
  const projectServers = loadProjectMcpServers()
  const cloudServers = loadCloudConnectors()

  // Merge: project overrides user if same name
  const allServers = [...cloudServers, ...userServers, ...projectServers]
  const seen = new Set<string>()
  const servers: McpServerEntry[] = []
  for (const s of allServers) {
    if (!seen.has(s.name)) {
      seen.add(s.name)
      servers.push(s)
    }
  }

  return NextResponse.json({
    sources: {
      user: USER_MCP_CONFIG,
      project: PROJECT_MCP_CONFIG,
    },
    servers,
    total: servers.length,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, command, args, env, scope = 'project', type = 'stdio', url } = body

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (type === 'http' && !url) {
    return NextResponse.json({ error: 'url is required for HTTP type' }, { status: 400 })
  }
  if (type !== 'http' && !command) {
    return NextResponse.json({ error: 'command is required for stdio type' }, { status: 400 })
  }

  const configPath = scope === 'user' ? USER_MCP_CONFIG : PROJECT_MCP_CONFIG

  let config: Record<string, any>
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  } catch {
    config = {}
  }

  const servers = config.mcpServers || {}
  if (servers[name]) {
    return NextResponse.json({ error: `Server "${name}" already exists` }, { status: 409 })
  }

  const entry: Record<string, unknown> = {}
  if (type === 'http') {
    entry.type = 'http'
    entry.url = url
  } else {
    if (type !== 'stdio') entry.type = type
    entry.command = command
    if (args && Array.isArray(args) && args.length > 0) entry.args = args
    if (env && typeof env === 'object' && Object.keys(env).length > 0) entry.env = env
  }

  servers[name] = entry
  config.mcpServers = servers

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
    return NextResponse.json({ ok: true, scope, source: configPath })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { name } = await req.json()
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  // Try project first, then user
  for (const configPath of [PROJECT_MCP_CONFIG, USER_MCP_CONFIG]) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      const servers = config.mcpServers || {}
      if (servers[name]) {
        delete servers[name]
        config.mcpServers = servers
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
        return NextResponse.json({ ok: true, source: configPath })
      }
    } catch {
      continue
    }
  }

  return NextResponse.json({ error: `Server "${name}" not found` }, { status: 404 })
}
