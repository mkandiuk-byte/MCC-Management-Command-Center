import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { simpleGit } from 'simple-git'

const CONFIG_PATH = path.join(process.cwd(), '.panel-config.json')
const DEFAULT_SCAN_DIR = process.env.WORKSPACE_PATH ?? ''

function loadConfig(): { scanDirs: string[] } {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { scanDirs: [DEFAULT_SCAN_DIR] }
  }
}

interface RepoInfo {
  id: string
  name: string
  path: string
  branch: string
  lastCommitHash: string
  lastCommitMessage: string
  lastCommitDate: string
  ahead: number
  behind: number
  isDirty: boolean
  hasRemote: boolean
  scanDir: string
  error?: string
}

async function getRepoInfo(dirPath: string, name: string, scanDir: string): Promise<RepoInfo> {
  const base: RepoInfo = {
    id: `${scanDir}:${name}`,
    name,
    path: dirPath,
    branch: 'unknown',
    lastCommitHash: '',
    lastCommitMessage: '',
    lastCommitDate: '',
    ahead: 0,
    behind: 0,
    isDirty: false,
    hasRemote: false,
    scanDir,
  }

  try {
    const git = simpleGit(dirPath)

    const branchSummary = await git.branchLocal()
    base.branch = branchSummary.current || 'unknown'

    const log = await git.log({ maxCount: 1 })
    if (log.latest) {
      base.lastCommitHash = log.latest.hash.slice(0, 7)
      base.lastCommitMessage = log.latest.message.slice(0, 60)
      base.lastCommitDate = log.latest.date
    }

    const remotes = await git.getRemotes(false)
    base.hasRemote = remotes.length > 0

    if (base.hasRemote) {
      try {
        const status = await git.status()
        base.ahead = status.ahead
        base.behind = status.behind
        base.isDirty = !status.isClean()
      } catch {
        // remote might be unreachable
      }
    }

    return base
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ...base, error: msg?.slice(0, 100) }
  }
}

async function scanDir(scanPath: string): Promise<RepoInfo[]> {
  let dirs: fs.Dirent[]
  try {
    dirs = fs.readdirSync(scanPath, { withFileTypes: true })
  } catch {
    return []
  }

  const repoDirs = dirs
    .filter(d => d.isDirectory() && fs.existsSync(path.join(scanPath, d.name, '.git')))
    .map(d => d.name)

  const batchSize = 5
  const results: RepoInfo[] = []

  for (let i = 0; i < repoDirs.length; i += batchSize) {
    const batch = repoDirs.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(name => getRepoInfo(path.join(scanPath, name), name, scanPath))
    )
    results.push(...batchResults)
  }

  return results
}

export async function GET() {
  const config = loadConfig()

  const allResults = await Promise.all(config.scanDirs.map(d => scanDir(d)))
  const repos = allResults.flat().sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({
    repos,
    total: repos.length,
    scanDirs: config.scanDirs,
  })
}
