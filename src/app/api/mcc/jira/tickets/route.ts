import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const JIRA_URL = process.env.JIRA_BASE_URL ?? ''
const JIRA_AUTH = Buffer.from(
  `${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`,
).toString('base64')

// ---------------------------------------------------------------------------
// In-memory cache (5 min TTL)
// ---------------------------------------------------------------------------
let cache: { data: unknown; ts: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

// ---------------------------------------------------------------------------
// Jira helpers
// ---------------------------------------------------------------------------
async function jiraGet(path: string) {
  const res = await fetch(`${JIRA_URL}${path}`, {
    headers: { Authorization: `Basic ${JIRA_AUTH}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Jira ${res.status}`)
  return res.json()
}

async function jiraSearchAll(jql: string, fields: string, max = 500) {
  const all: any[] = []
  let token: string | undefined
  do {
    const tp = token ? `&nextPageToken=${encodeURIComponent(token)}` : ''
    const r = await jiraGet(
      `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=100&fields=${fields}${tp}`,
    )
    all.push(...(r.issues ?? []))
    token = r.nextPageToken
    if (r.isLast || all.length >= max) break
  } while (token)
  return all
}

// ---------------------------------------------------------------------------
// Compute helpers
// ---------------------------------------------------------------------------
function toDateStr(iso: string): string {
  return iso.slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function last30DaysDates(): string[] {
  const dates: string[] = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

// ---------------------------------------------------------------------------
// Fallback data
// ---------------------------------------------------------------------------
function fallbackData() {
  const dates = last30DaysDates()
  return {
    ticketsPerDay: dates.map((date) => ({ date, count: Math.floor(Math.random() * 10) + 2 })),
    ticketsByProject: { ASD: 120, FS: 80, MIB: 5 },
    pwaTickets: 45,
    avgResolveTimeDays: 13.5,
    openTickets: 95,
    resolvedLast30d: 150,
    totalCreated30d: 205,
    avgPerDay: 6.8,
    updatedAt: new Date().toISOString(),
    source: 'fallback' as const,
  }
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------
export async function GET() {
  // Return cache if fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  try {
    if (!JIRA_URL || !process.env.JIRA_USERNAME || !process.env.JIRA_API_TOKEN) {
      throw new Error('Jira not configured')
    }

    // Fetch all issues created in last 30 days across ASD, FS, MIB
    const jql = 'project in (ASD,FS,MIB) AND created >= "-30d"'
    const fields = 'summary,status,issuetype,created,resolutiondate,project'
    const issues = await jiraSearchAll(jql, fields)

    const dates = last30DaysDates()
    const dateSet = new Set(dates)

    // ticketsPerDay
    const perDayMap: Record<string, number> = {}
    for (const d of dates) perDayMap[d] = 0
    for (const issue of issues) {
      const created = toDateStr(issue.fields.created)
      if (dateSet.has(created)) {
        perDayMap[created] = (perDayMap[created] ?? 0) + 1
      }
    }
    const ticketsPerDay = dates.map((date) => ({ date, count: perDayMap[date] ?? 0 }))

    // ticketsByProject
    const ticketsByProject: Record<string, number> = { ASD: 0, FS: 0, MIB: 0 }
    for (const issue of issues) {
      const key = issue.fields.project?.key
      if (key && key in ticketsByProject) {
        ticketsByProject[key]++
      }
    }

    // pwaTickets: FS project, Feature or Task type
    const pwaTickets = issues.filter((issue) => {
      const projectKey = issue.fields.project?.key
      const typeName = issue.fields.issuetype?.name?.toLowerCase() ?? ''
      return projectKey === 'FS' && (typeName === 'feature' || typeName === 'task')
    }).length

    // avgResolveTime: median days for resolved issues
    const resolveTimes: number[] = []
    for (const issue of issues) {
      const rd = issue.fields.resolutiondate
      if (rd) {
        const days = daysBetween(issue.fields.created, rd)
        if (days >= 0) resolveTimes.push(days)
      }
    }
    const avgResolveTimeDays = Math.round(median(resolveTimes) * 10) / 10

    // openTickets: status category is NOT Done
    const openTickets = issues.filter((issue) => {
      const cat = issue.fields.status?.statusCategory?.name
      return cat !== 'Done'
    }).length

    // resolvedLast30d: issues with resolutiondate in last 30 days
    const resolvedLast30d = issues.filter((issue) => {
      const rd = issue.fields.resolutiondate
      if (!rd) return false
      return dateSet.has(toDateStr(rd))
    }).length

    const totalCreated30d = issues.length
    const avgPerDay = Math.round((totalCreated30d / 30) * 10) / 10

    const data = {
      ticketsPerDay,
      ticketsByProject,
      pwaTickets,
      avgResolveTimeDays,
      openTickets,
      resolvedLast30d,
      totalCreated30d,
      avgPerDay,
      updatedAt: new Date().toISOString(),
      source: 'jira' as const,
    }

    cache = { data, ts: Date.now() }
    return NextResponse.json(data)
  } catch (err) {
    console.error('[mcc/jira/tickets]', err)
    const data = fallbackData()
    cache = { data, ts: Date.now() }
    return NextResponse.json(data)
  }
}
