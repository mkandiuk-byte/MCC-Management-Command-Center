import type { FastifyInstance } from 'fastify'
import fs from 'fs'
import path from 'path'

const ALLOWED_ROOTS = [
  process.env.WORKSPACE_PATH,
  process.env.CLAUDE_PATH,
].filter(Boolean) as string[]

const SKIP_NAMES = new Set([
  'node_modules', '.git', '__pycache__', '.next', 'venv', '.venv',
  'env', 'dist', 'build', '.cache', '.pytest_cache', '.mypy_cache',
  '.tox', 'coverage', '.coverage',
])

const SKIP_EXTENSIONS = new Set(['.pyc', '.pyo', '.class'])

interface FileNode {
  name: string; path: string; type: 'file' | 'directory'
  size?: number; children?: FileNode[]; ext?: string
}

function shouldSkip(name: string): boolean {
  if (SKIP_NAMES.has(name)) return true
  if (name.startsWith('.') && name !== '.env' && name !== '.claude' && name !== '.mcp.json') return true
  return SKIP_EXTENSIONS.has(path.extname(name))
}

function readTree(dirPath: string, depth: number, maxDepth: number): FileNode[] {
  if (depth > maxDepth) return []
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(dirPath, { withFileTypes: true }) } catch { return [] }

  const nodes: FileNode[] = []
  for (const entry of entries) {
    if (shouldSkip(entry.name)) continue
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      nodes.push({ name: entry.name, path: fullPath, type: 'directory', children: readTree(fullPath, depth + 1, maxDepth) })
    } else if (entry.isFile()) {
      let size: number | undefined
      try { size = fs.statSync(fullPath).size } catch { /* ignore */ }
      nodes.push({ name: entry.name, path: fullPath, type: 'file', size, ext: path.extname(entry.name) })
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export async function fsRoutes(app: FastifyInstance) {
  // GET /api/fs?path=...&maxDepth=3
  app.get('/', async (req) => {
    const { path: reqPath, maxDepth: md } = req.query as { path?: string; maxDepth?: string }
    const maxDepth = parseInt(md || '3', 10)

    if (!reqPath) {
      return { roots: ALLOWED_ROOTS.map(root => ({ name: path.basename(root), path: root, type: 'directory', fullPath: root })) }
    }

    const isAllowed = ALLOWED_ROOTS.some(root => reqPath.startsWith(root))
    if (!isAllowed) return { error: 'Path not allowed' }

    if (!fs.existsSync(reqPath)) return { error: 'Path not found' }
    const stat = fs.statSync(reqPath)

    if (stat.isDirectory()) {
      return { name: path.basename(reqPath), path: reqPath, type: 'directory', children: readTree(reqPath, 0, maxDepth) }
    }
    return { name: path.basename(reqPath), path: reqPath, type: 'file', size: stat.size, ext: path.extname(reqPath) }
  })

  // GET /api/fs/content?path=...
  app.get('/content', async (req, reply) => {
    const { path: reqPath } = req.query as { path?: string }
    if (!reqPath) return reply.status(400).send({ error: 'path required' })

    const isAllowed = ALLOWED_ROOTS.some(root => reqPath.startsWith(root))
    if (!isAllowed) return reply.status(403).send({ error: 'Path not allowed' })

    if (!fs.existsSync(reqPath)) return reply.status(404).send({ error: 'Not found' })
    try {
      const content = fs.readFileSync(reqPath, 'utf-8')
      return { content, path: reqPath }
    } catch (e: unknown) {
      return reply.status(500).send({ error: e instanceof Error ? e.message : String(e) })
    }
  })

  // GET /api/fs/tree?path=...&maxDepth=...  (alias)
  app.get('/tree', async (req) => {
    const { path: reqPath, maxDepth: md } = req.query as { path?: string; maxDepth?: string }
    const maxDepth = parseInt(md || '5', 10)
    if (!reqPath) return { roots: ALLOWED_ROOTS }
    const isAllowed = ALLOWED_ROOTS.some(root => reqPath.startsWith(root))
    if (!isAllowed) return { error: 'Path not allowed' }
    if (!fs.existsSync(reqPath)) return { error: 'Path not found' }
    return { tree: readTree(reqPath, 0, maxDepth) }
  })
}
