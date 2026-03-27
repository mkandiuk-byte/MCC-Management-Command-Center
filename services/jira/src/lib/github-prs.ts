function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function getOrgs() {
  return (process.env.GITHUB_ORGS ?? '').split(',').filter(Boolean)
}

// In-memory cache: cacheKey → { data, expiresAt }
const prCache = new Map<string, { data: Map<string, PRInfo>; expiresAt: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

// Rate-limit backoff: skip all requests until this timestamp
let rateLimitedUntil = 0

function getCacheKey(issueKeys: string[]) {
  return [...issueKeys].sort().join(',')
}

export type PRStatus = 'working_on' | 'open' | 'draft' | 'merged' | 'closed'

export interface PRInfo {
  url: string
  number: number
  title: string
  repo: string
  status: PRStatus
  branch: string
}

interface GitHubSearchItem {
  number: number
  title: string
  html_url: string
  state: 'open' | 'closed'
  draft: boolean
  pull_request?: {
    merged_at: string | null
    html_url: string
  }
  repository_url: string
}

// Priority: open (in review) > draft > merged > closed
const STATUS_PRIORITY: Record<PRStatus, number> = {
  working_on: 0,
  closed: 1,
  merged: 2,
  draft: 3,
  open: 4,
}

function itemToStatus(item: GitHubSearchItem): PRStatus {
  if (item.pull_request?.merged_at) return 'merged'
  if (item.state === 'closed') return 'closed'
  if (item.draft) return 'draft'
  return 'open'
}

function applyResult(
  result: Map<string, PRInfo>,
  key: string,
  item: GitHubSearchItem,
  status: PRStatus,
) {
  const repoName = item.repository_url.split('/').slice(-2).join('/')
  const existing = result.get(key)
  if (!existing || STATUS_PRIORITY[status] > STATUS_PRIORITY[existing.status]) {
    result.set(key, {
      url: item.html_url,
      number: item.number,
      title: item.title,
      repo: repoName,
      status,
      branch: '',
    })
  }
}

async function searchBatch(q: string): Promise<GitHubSearchItem[]> {
  // Skip immediately if rate-limited
  if (Date.now() < rateLimitedUntil) return []

  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=50`
  try {
    const res = await fetch(url, { headers: getHeaders() })
    if (res.status === 403 || res.status === 429) {
      // Parse reset time from headers, back off until then (min 60s)
      const reset = res.headers.get('x-ratelimit-reset')
      rateLimitedUntil = reset
        ? Math.max(Number(reset) * 1000, Date.now() + 60_000)
        : Date.now() + 60_000
      console.error('[github-prs] rate limited, backing off until', new Date(rateLimitedUntil).toISOString())
      return []
    }
    if (!res.ok) {
      console.error('[github-prs] search failed', res.status, await res.text().catch(() => ''))
      return []
    }
    const data: { items: GitHubSearchItem[] } = await res.json()
    return data.items ?? []
  } catch (e) {
    console.error('[github-prs] search exception', e)
    return []
  }
}

// Search GitHub PRs for a list of issue keys (e.g. ["ASD-101", "ASD-102"])
// Returns a map: issueKey → PRInfo (best status wins when multiple PRs exist)
// Pass 1: title/body search in batches of 6
// Pass 2: for keys still unmatched, individual branch (head:KEY) searches
export async function searchPRsForIssues(
  issueKeys: string[]
): Promise<Map<string, PRInfo>> {
  const token = process.env.GITHUB_TOKEN
  if (!issueKeys.length || !token) return new Map()

  const cacheKey = getCacheKey(issueKeys)
  const cached = prCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  const result = new Map<string, PRInfo>()
  const orgQuery = getOrgs().map(o => `org:${o}`).join(' ')

  // ── Pass 1: title / body search (batches of 6) ──
  const batches: string[][] = []
  for (let i = 0; i < issueKeys.length; i += 6) {
    batches.push(issueKeys.slice(i, i + 6))
  }

  for (const batch of batches) {
    const q = `is:pr (${batch.join(' OR ')}) ${orgQuery}`
    const items = await searchBatch(q)

    for (const item of items) {
      const status = itemToStatus(item)
      for (const key of batch) {
        if (!item.title.toUpperCase().includes(key.toUpperCase())) continue
        applyResult(result, key, item, status)
      }
    }
  }

  // ── Pass 2: branch-name search for still-unmatched keys ──
  const unmatched = issueKeys.filter(k => !result.has(k))

  if (unmatched.length > 0) {
    // Run individual branch searches in parallel (one query per key)
    await Promise.all(
      unmatched.map(async (key) => {
        const q = `is:pr head:${key} ${orgQuery}`
        const items = await searchBatch(q)
        for (const item of items) {
          applyResult(result, key, item, itemToStatus(item))
        }
      })
    )
  }

  prCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS })
  return result
}
