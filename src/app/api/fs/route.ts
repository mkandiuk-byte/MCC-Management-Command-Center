import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const ALLOWED_ROOTS = [
  process.env.WORKSPACE_PATH,
  process.env.CLAUDE_PATH,
].filter(Boolean) as string[]

const SKIP_NAMES = new Set([
  'node_modules', '.git', '__pycache__', '.next', 'venv', '.venv',
  'env', 'dist', 'build', '.cache', '.pytest_cache', '.mypy_cache',
  '.tox', 'coverage', '.coverage', '*.egg-info'
])

const SKIP_EXTENSIONS = new Set(['.pyc', '.pyo', '.class'])

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  children?: FileNode[]
  ext?: string
}

function shouldSkip(name: string): boolean {
  if (SKIP_NAMES.has(name)) return true
  if (name.startsWith('.') && name !== '.env' && name !== '.claude' && name !== '.mcp.json') return true
  const ext = path.extname(name)
  if (SKIP_EXTENSIONS.has(ext)) return true
  return false
}

function readTree(dirPath: string, depth: number, maxDepth: number): FileNode[] {
  if (depth > maxDepth) return []

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true })
  } catch {
    return []
  }

  const nodes: FileNode[] = []

  for (const entry of entries) {
    if (shouldSkip(entry.name)) continue

    const fullPath = path.join(dirPath, entry.name)
    const ext = path.extname(entry.name)

    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: 'directory',
        children: readTree(fullPath, depth + 1, maxDepth)
      })
    } else if (entry.isFile()) {
      let size: number | undefined
      try {
        const stat = fs.statSync(fullPath)
        size = stat.size
      } catch {
        // ignore stat errors
      }

      nodes.push({
        name: entry.name,
        path: fullPath,
        type: 'file',
        size,
        ext
      })
    }
  }

  // Sort: directories first, then files, alphabetically
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const reqPath = searchParams.get('path')
  const maxDepth = parseInt(searchParams.get('maxDepth') || '3', 10)

  if (!reqPath) {
    // Return available roots
    return NextResponse.json({
      roots: ALLOWED_ROOTS.map(root => ({
        name: path.basename(root),
        path: root,
        type: 'directory' as const,
        fullPath: root
      }))
    })
  }

  // Security check
  const isAllowed = ALLOWED_ROOTS.some(root => reqPath.startsWith(root))
  if (!isAllowed) {
    return NextResponse.json({ error: 'Path not allowed' }, { status: 403 })
  }

  if (!fs.existsSync(reqPath)) {
    return NextResponse.json({ error: 'Path not found' }, { status: 404 })
  }

  const stat = fs.statSync(reqPath)

  if (stat.isDirectory()) {
    const children = readTree(reqPath, 0, maxDepth)
    return NextResponse.json({
      name: path.basename(reqPath),
      path: reqPath,
      type: 'directory',
      children
    })
  } else {
    return NextResponse.json({
      name: path.basename(reqPath),
      path: reqPath,
      type: 'file',
      size: stat.size,
      ext: path.extname(reqPath)
    })
  }
}
