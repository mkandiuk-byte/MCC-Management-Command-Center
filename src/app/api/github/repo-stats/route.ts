import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'

const BASE = 'https://api.github.com'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// ── Types ────────────────────────────────────────────────────────────────────

interface PRItem {
  number: number
  title: string
  html_url: string
  created_at: string
  merged_at: string | null
  state: 'open' | 'closed'
}

interface ContributorItem {
  login: string
  avatar_url: string
  contributions: number
}

interface RepoData {
  created_at: string
}

export interface RepoStats {
  createdAt: string
  totalPRs: number
  totalMerges: number
  lastPR: { number: number; title: string; date: string; url: string } | null
  lastMerge: { number: number; title: string; date: string; url: string } | null
  contributors: Array<{ login: string; avatar: string; commits: number }>
  prTimeline: Array<{ month: string; prs: number; merges: number }>
}

// ── In-memory cache ──────────────────────────────────────────────────────────

const statsCache = new Map<string, { data: RepoStats; expiresAt: number }>()

// ── GitHub fetch helper ──────────────────────────────────────────────────────

function ghFetch(path: string) {
  return fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
    next: { revalidate: 300 }, // 5 min Next.js cache hint
  })
}

// ── Paginated PR fetch ───────────────────────────────────────────────────────

async function fetchAllPRs(owner: string, repo: string): Promise<PRItem[]> {
  const prs: PRItem[] = []
  let page = 1
  while (true) {
    const res = await ghFetch(
      `/repos/${owner}/${repo}/pulls?state=all&per_page=100&page=${page}`,
    )
    if (!res.ok) break
    const data: PRItem[] = await res.json()
    if (!Array.isArray(data) || data.length === 0) break
    prs.push(...data)
    if (data.length < 100) break
    page++
  }
  return prs
}

// ── PR timeline builder (last 12 months) ────────────────────────────────────

function buildPrTimeline(
  prs: PRItem[],
): Array<{ month: string; prs: number; merges: number }> {
  const now = new Date()
  // Build a map for the last 12 months initialised to zero
  const monthMap = new Map<string, { prs: number; merges: number }>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthMap.set(format(d, 'yyyy-MM'), { prs: 0, merges: 0 })
  }

  for (const pr of prs) {
    const monthKey = format(new Date(pr.created_at), 'yyyy-MM')
    const entry = monthMap.get(monthKey)
    if (entry) {
      entry.prs++
      if (pr.merged_at) entry.merges++
    }
  }

  return Array.from(monthMap.entries()).map(([month, counts]) => ({
    month,
    ...counts,
  }))
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const owner = searchParams.get('owner')?.trim()
  const repo = searchParams.get('repo')?.trim()

  if (!owner || !repo) {
    return NextResponse.json(
      { error: 'Missing required query params: owner, repo' },
      { status: 400 },
    )
  }

  const cacheKey = `${owner}/${repo}`
  const cached = statsCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data)
  }

  try {
    // Fetch repo info, PRs, and contributors in parallel
    const [repoRes, prs, contribRes] = await Promise.all([
      ghFetch(`/repos/${owner}/${repo}`),
      fetchAllPRs(owner, repo),
      ghFetch(`/repos/${owner}/${repo}/contributors?per_page=30`),
    ])

    if (!repoRes.ok) {
      const errText = await repoRes.text().catch(() => '')
      return NextResponse.json(
        { error: `GitHub API error for repo info: ${repoRes.status} ${errText}` },
        { status: 500 },
      )
    }

    const repoData: RepoData = await repoRes.json()

    const contributors: Array<{ login: string; avatar: string; commits: number }> = []
    if (contribRes.ok) {
      const contribData: ContributorItem[] = await contribRes.json()
      if (Array.isArray(contribData)) {
        for (const c of contribData) {
          contributors.push({
            login: c.login,
            avatar: c.avatar_url,
            commits: c.contributions,
          })
        }
      }
    }

    // Derived PR metrics
    const mergedPRs = prs.filter(pr => pr.merged_at !== null)

    const sortedByCreated = [...prs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    const sortedByMerged = [...mergedPRs].sort(
      (a, b) =>
        new Date(b.merged_at!).getTime() - new Date(a.merged_at!).getTime(),
    )

    const latestPR = sortedByCreated[0] ?? null
    const latestMerge = sortedByMerged[0] ?? null

    const stats: RepoStats = {
      createdAt: repoData.created_at,
      totalPRs: prs.length,
      totalMerges: mergedPRs.length,
      lastPR: latestPR
        ? {
            number: latestPR.number,
            title: latestPR.title,
            date: latestPR.created_at,
            url: latestPR.html_url,
          }
        : null,
      lastMerge: latestMerge
        ? {
            number: latestMerge.number,
            title: latestMerge.title,
            date: latestMerge.merged_at!,
            url: latestMerge.html_url,
          }
        : null,
      contributors,
      prTimeline: buildPrTimeline(prs),
    }

    statsCache.set(cacheKey, { data: stats, expiresAt: Date.now() + CACHE_TTL_MS })
    return NextResponse.json(stats)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
