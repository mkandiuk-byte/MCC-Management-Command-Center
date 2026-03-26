import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
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
  diskSizeKb: number
  githubOwner: string
  githubRepo: string
  error?: string
}

function parseGitRemoteUrl(remoteUrl: string): { owner: string; repo: string } {
  const trimmed = remoteUrl.trim()
  // SSH: git@github.com:owner/repo.git
  const sshMatch = trimmed.match(/git@github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/)
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] }
  }
  // HTTPS: https://github.com/owner/repo.git
  const httpsMatch = trimmed.match(/https?:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/)
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] }
  }
  return { owner: '', repo: '' }
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
    diskSizeKb: 0,
    githubOwner: '',
    githubRepo: '',
  }

  // Disk size
  try {
    const duOutput = execSync(`du -sk "${dirPath}"`, { timeout: 5000 }).toString()
    base.diskSizeKb = parseInt(duOutput.split('\t')[0]) || 0
  } catch {
    base.diskSizeKb = 0
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
        const remoteUrl = await git.remote(['get-url', 'origin'])
        if (remoteUrl) {
          const { owner, repo } = parseGitRemoteUrl(remoteUrl)
          base.githubOwner = owner
          base.githubRepo = repo
        }
      } catch {
        // remote URL might not be available
      }

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
