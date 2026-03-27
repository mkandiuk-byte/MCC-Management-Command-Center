import type { FastifyInstance } from 'fastify'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { simpleGit } from 'simple-git'

const CONFIG_PATH = process.env.PANEL_CONFIG_PATH
  ?? path.join(process.env.PANEL_ROOT ?? process.cwd(), '.panel-config.json')
const DEFAULT_SCAN_DIR = process.env.WORKSPACE_PATH ?? ''

function loadConfig(): { scanDirs: string[]; clonedRepos?: { url: string; name: string; path: string }[] } {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) }
  catch { return { scanDirs: [DEFAULT_SCAN_DIR].filter(Boolean) } }
}

function saveConfig(config: object) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

function parseGitRemoteUrl(remoteUrl: string): { owner: string; repo: string } {
  const t = remoteUrl.trim()
  const ssh = t.match(/git@github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/)
  if (ssh) return { owner: ssh[1], repo: ssh[2] }
  const https = t.match(/https?:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/)
  if (https) return { owner: https[1], repo: https[2] }
  return { owner: '', repo: '' }
}

interface RepoInfo {
  id: string; name: string; path: string; branch: string
  lastCommitHash: string; lastCommitMessage: string; lastCommitDate: string
  ahead: number; behind: number; isDirty: boolean; hasRemote: boolean
  scanDir: string; diskSizeKb: number; githubOwner: string; githubRepo: string
  error?: string
}

async function getRepoInfo(dirPath: string, name: string, scanDir: string): Promise<RepoInfo> {
  const base: RepoInfo = {
    id: `${scanDir}:${name}`, name, path: dirPath, branch: 'unknown',
    lastCommitHash: '', lastCommitMessage: '', lastCommitDate: '',
    ahead: 0, behind: 0, isDirty: false, hasRemote: false,
    scanDir, diskSizeKb: 0, githubOwner: '', githubRepo: '',
  }

  try {
    const du = execSync(`du -sk "${dirPath}"`, { timeout: 5000 }).toString()
    base.diskSizeKb = parseInt(du.split('\t')[0]) || 0
  } catch { /* ignore */ }

  try {
    const git = simpleGit(dirPath)
    const branch = await git.branchLocal()
    base.branch = branch.current || 'unknown'

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
        const url = await git.remote(['get-url', 'origin'])
        if (url) Object.assign(base, parseGitRemoteUrl(url))
      } catch { /* ignore */ }

      try {
        const status = await git.status()
        base.ahead = status.ahead
        base.behind = status.behind
        base.isDirty = !status.isClean()
      } catch { /* remote unreachable */ }
    }
  } catch (e: unknown) {
    return { ...base, error: (e instanceof Error ? e.message : String(e)).slice(0, 100) }
  }

  return base
}

async function scanDir(scanPath: string): Promise<RepoInfo[]> {
  let dirs: fs.Dirent[]
  try { dirs = fs.readdirSync(scanPath, { withFileTypes: true }) } catch { return [] }

  const repoDirs = dirs
    .filter(d => d.isDirectory() && fs.existsSync(path.join(scanPath, d.name, '.git')))
    .map(d => d.name)

  const results: RepoInfo[] = []
  const batchSize = 5
  for (let i = 0; i < repoDirs.length; i += batchSize) {
    const batch = repoDirs.slice(i, i + batchSize)
    results.push(...await Promise.all(batch.map(n => getRepoInfo(path.join(scanPath, n), n, scanPath))))
  }
  return results
}

export async function reposRoutes(app: FastifyInstance) {
  // GET /api/repos
  app.get('/', async () => {
    const config = loadConfig()
    const all = await Promise.all(config.scanDirs.map(d => scanDir(d)))
    const repos = all.flat().sort((a, b) => a.name.localeCompare(b.name))
    return { repos, total: repos.length, scanDirs: config.scanDirs }
  })

  // POST /api/repos/clone
  app.post('/clone', async (req, reply) => {
    const { url, name, targetDir } = (req.body ?? {}) as { url?: string; name?: string; targetDir?: string }
    if (!url) return reply.status(400).send({ error: 'url is required' })

    const resolvedTarget = (targetDir || DEFAULT_SCAN_DIR).replace(/^~/, process.env.HOME || '')
    if (!fs.existsSync(resolvedTarget)) return reply.status(400).send({ error: `Target directory not found: ${resolvedTarget}` })

    const repoName = name?.trim() || url.split('/').pop()?.replace(/\.git$/, '') || 'repo'
    const destPath = path.join(resolvedTarget, repoName)
    if (fs.existsSync(destPath)) return reply.status(400).send({ error: `Directory already exists: ${destPath}` })

    try {
      execSync(`git clone ${JSON.stringify(url)} ${JSON.stringify(destPath)}`, { stdio: 'pipe', timeout: 120000 })
    } catch (e: unknown) {
      return reply.status(500).send({ error: `Clone failed: ${e instanceof Error ? e.message : String(e)}` })
    }

    const config = loadConfig()
    if (!config.clonedRepos) config.clonedRepos = []
    config.clonedRepos.push({ url, name: repoName, path: destPath })
    saveConfig(config)
    return { ok: true, path: destPath, name: repoName }
  })

  // POST /api/repos/pull
  app.post('/pull', async (req, reply) => {
    const { repoPath } = (req.body ?? {}) as { repoPath?: string }
    if (!repoPath) return reply.status(400).send({ error: 'repoPath is required' })
    if (!fs.existsSync(repoPath)) return reply.status(400).send({ error: `Path not found: ${repoPath}` })

    try {
      const output = execSync('git pull --ff-only', { cwd: repoPath, stdio: 'pipe', timeout: 60000 }).toString().trim()
      return { ok: true, output }
    } catch (e: unknown) {
      return reply.status(500).send({ error: `Pull failed: ${e instanceof Error ? e.message : String(e)}` })
    }
  })

  // GET /api/repos/config
  app.get('/config', async () => loadConfig())
}
