import type { FastifyInstance } from 'fastify'
import { format } from 'date-fns'

const BASE = 'https://api.github.com'
const CACHE_TTL_MS = 5 * 60 * 1000

interface PRItem { number: number; title: string; html_url: string; created_at: string; merged_at: string | null; state: string }
interface ContributorItem { login: string; avatar_url: string; contributions: number }

const statsCache = new Map<string, { data: unknown; expiresAt: number }>()

function ghFetch(path: string) {
  return fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })
}

async function fetchAllPRs(owner: string, repo: string): Promise<PRItem[]> {
  const prs: PRItem[] = []
  let page = 1
  while (true) {
    const res = await ghFetch(`/repos/${owner}/${repo}/pulls?state=all&per_page=100&page=${page}`)
    if (!res.ok) break
    const data: PRItem[] = await res.json()
    if (!Array.isArray(data) || data.length === 0) break
    prs.push(...data)
    if (data.length < 100) break
    page++
  }
  return prs
}

function buildPrTimeline(prs: PRItem[]) {
  const now = new Date()
  const monthMap = new Map<string, { prs: number; merges: number }>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthMap.set(format(d, 'yyyy-MM'), { prs: 0, merges: 0 })
  }
  for (const pr of prs) {
    const monthKey = format(new Date(pr.created_at), 'yyyy-MM')
    const entry = monthMap.get(monthKey)
    if (entry) { entry.prs++; if (pr.merged_at) entry.merges++ }
  }
  return Array.from(monthMap.entries()).map(([month, counts]) => ({ month, ...counts }))
}

export async function githubRepoStatsRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const { owner, repo } = req.query as { owner?: string; repo?: string }
    if (!owner?.trim() || !repo?.trim()) return reply.status(400).send({ error: 'Missing required query params: owner, repo' })

    const cacheKey = `${owner}/${repo}`
    const cached = statsCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) return cached.data

    try {
      const [repoRes, prs, contribRes] = await Promise.all([
        ghFetch(`/repos/${owner}/${repo}`),
        fetchAllPRs(owner, repo),
        ghFetch(`/repos/${owner}/${repo}/contributors?per_page=30`),
      ])

      if (!repoRes.ok) {
        const errText = await repoRes.text().catch(() => '')
        return reply.status(500).send({ error: `GitHub API error: ${repoRes.status} ${errText}` })
      }

      const repoData: { created_at: string } = await repoRes.json()
      const contributors: { login: string; avatar: string; commits: number }[] = []
      if (contribRes.ok) {
        const contribData: ContributorItem[] = await contribRes.json()
        if (Array.isArray(contribData)) {
          for (const c of contribData) contributors.push({ login: c.login, avatar: c.avatar_url, commits: c.contributions })
        }
      }

      const mergedPRs = prs.filter(pr => pr.merged_at !== null)
      const sortedByCreated = [...prs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const sortedByMerged = [...mergedPRs].sort((a, b) => new Date(b.merged_at!).getTime() - new Date(a.merged_at!).getTime())
      const latestPR = sortedByCreated[0] ?? null
      const latestMerge = sortedByMerged[0] ?? null

      const stats = {
        createdAt: repoData.created_at, totalPRs: prs.length, totalMerges: mergedPRs.length,
        lastPR: latestPR ? { number: latestPR.number, title: latestPR.title, date: latestPR.created_at, url: latestPR.html_url } : null,
        lastMerge: latestMerge ? { number: latestMerge.number, title: latestMerge.title, date: latestMerge.merged_at!, url: latestMerge.html_url } : null,
        contributors,
        prTimeline: buildPrTimeline(prs),
      }

      statsCache.set(cacheKey, { data: stats, expiresAt: Date.now() + CACHE_TTL_MS })
      return stats
    } catch (e: unknown) {
      return reply.status(500).send({ error: e instanceof Error ? e.message : String(e) })
    }
  })
}
