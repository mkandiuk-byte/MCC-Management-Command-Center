import type { FastifyInstance } from 'fastify'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

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

async function run(cmd: string, cwd: string): Promise<string> {
  const { stdout } = await execAsync(cmd, { cwd, timeout: 5000 })
  return stdout.trim()
}

async function getRepoInfo(dirPath: string, name: string, scanDir: string): Promise<RepoInfo> {
  const base: RepoInfo = {
    id: `${scanDir}:${name}`, name, path: dirPath, branch: 'unknown',
    lastCommitHash: '', lastCommitMessage: '', lastCommitDate: '',
    ahead: 0, behind: 0, isDirty: false, hasRemote: false,
    scanDir, diskSizeKb: 0, githubOwner: '', githubRepo: '',
  }

  // Run all commands in parallel
  const [branchRes, logRes, remotesRes, urlRes, statusRes, duRes] = await Promise.allSettled([
    run('git rev-parse --abbrev-ref HEAD', dirPath),
    run('git log -1 --format=%h%x1f%s%x1f%ci', dirPath),
    run('git remote', dirPath),
    run('git remote get-url origin', dirPath),
    run('git status --porcelain -b', dirPath),
    execAsync(`du -sk "${dirPath}"`, { timeout: 5000 }).then(r => r.stdout.trim()),
  ])

  if (branchRes.status === 'fulfilled') base.branch = branchRes.value
  if (logRes.status === 'fulfilled') {
    const [hash, msg, date] = logRes.value.split('\x1f')
    base.lastCommitHash    = hash?.trim() ?? ''
    base.lastCommitMessage = (msg?.trim() ?? '').slice(0, 60)
    base.lastCommitDate    = date?.trim() ?? ''
  }
  if (remotesRes.status === 'fulfilled') base.hasRemote = remotesRes.value.length > 0
  if (urlRes.status === 'fulfilled') Object.assign(base, parseGitRemoteUrl(urlRes.value))
  if (statusRes.status === 'fulfilled') {
    const lines  = statusRes.value.split('\n')
    const header = lines[0] ?? ''
    const ahead  = header.match(/ahead (\d+)/)
    const behind = header.match(/behind (\d+)/)
    base.ahead   = ahead  ? parseInt(ahead[1])  : 0
    base.behind  = behind ? parseInt(behind[1]) : 0
    base.isDirty = lines.slice(1).some(l => l.trim().length > 0)
  }
  if (duRes.status === 'fulfilled') base.diskSizeKb = parseInt(duRes.value.split('\t')[0]) || 0

  return base
}

async function scanDir(scanPath: string): Promise<RepoInfo[]> {
  let dirs: fs.Dirent[]
  try { dirs = fs.readdirSync(scanPath, { withFileTypes: true }) } catch { return [] }

  const repoDirs = dirs.filter(d => d.isDirectory() && fs.existsSync(path.join(scanPath, d.name, '.git')))
  return Promise.all(repoDirs.map(d => getRepoInfo(path.join(scanPath, d.name), d.name, scanPath)))
}

// Cache to avoid re-scanning on every request
let cache: { repos: RepoInfo[]; scanDirs: string[]; total: number } | null = null
let cacheTs = 0
const CACHE_TTL = 60_000 // 60s

export async function reposRoutes(app: FastifyInstance) {
  // GET /api/repos
  app.get('/', async () => {
    if (cache && Date.now() - cacheTs < CACHE_TTL) return cache
    const config = loadConfig()
    const all = await Promise.all(config.scanDirs.map(d => scanDir(d)))
    const repos = all.flat().sort((a, b) => a.name.localeCompare(b.name))
    cache = { repos, total: repos.length, scanDirs: config.scanDirs }
    cacheTs = Date.now()
    return cache
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

    // Convert GitHub HTTPS → SSH so private repos use the configured SSH key
    const cloneUrl = url.replace(/^https:\/\/github\.com\//, 'git@github.com:').replace(/(?<!\.git)$/, '.git')

    try {
      await execAsync(`git clone ${JSON.stringify(cloneUrl)} ${JSON.stringify(destPath)}`, {
        timeout: 120000,
        env: { ...process.env, GIT_SSH_COMMAND: `ssh -i ${process.env.HOME}/.ssh/id_ed25519 -o StrictHostKeyChecking=no` },
      })
    } catch (e: unknown) {
      return reply.status(500).send({ error: `Clone failed: ${e instanceof Error ? e.message : String(e)}` })
    }

    const config = loadConfig()
    if (!config.clonedRepos) config.clonedRepos = []
    config.clonedRepos.push({ url, name: repoName, path: destPath })
    saveConfig(config)
    cache = null
    return { ok: true, path: destPath, name: repoName }
  })

  // POST /api/repos/pull
  app.post('/pull', async (req, reply) => {
    const { repoPath } = (req.body ?? {}) as { repoPath?: string }
    if (!repoPath) return reply.status(400).send({ error: 'repoPath is required' })
    if (!fs.existsSync(repoPath)) return reply.status(400).send({ error: `Path not found: ${repoPath}` })

    try {
      const { stdout } = await execAsync('git pull --ff-only', { cwd: repoPath, timeout: 60000 })
      cache = null
      return { ok: true, output: stdout.trim() }
    } catch (e: unknown) {
      return reply.status(500).send({ error: `Pull failed: ${e instanceof Error ? e.message : String(e)}` })
    }
  })

  // GET /api/repos/config
  app.get('/config', async () => loadConfig())
}
