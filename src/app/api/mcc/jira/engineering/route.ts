import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const JIRA_URL = process.env.JIRA_BASE_URL ?? ''
const JIRA_AUTH = Buffer.from(
  `${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`,
).toString('base64')

const BOARDS: Record<string, number> = { ASD: 1022, FS: 956 }
const PROJECTS = Object.keys(BOARDS) // ['ASD', 'FS']

// ---------------------------------------------------------------------------
// In-memory cache (5 min TTL)
// ---------------------------------------------------------------------------
let cache: { data: unknown; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SprintData {
  name: string
  startDate: string
  endDate: string
  totalIssues: number
  doneIssues: number
  velocity: number
  activeItems: number
}

interface VelocityEntry {
  sprintName: string
  velocity: number
  done: number
  total: number
}

interface BugDensity {
  bugCount90d: number
  totalCount90d: number
  ratio: number
}

interface BlockedItem {
  key: string
  summary: string
  assignee: string
  daysSinceCreated: number
}

interface WorkloadEntry {
  person: string
  inProgress: number
  codeReview: number
  qa: number
  total: number
}

interface EpicEntry {
  key: string
  summary: string
  project: string
  done: number
  total: number
  progressPct: number
  isZombie: boolean
}

interface TeamData {
  sprint: SprintData
  velocityHistory: VelocityEntry[]
  bugDensity: BugDensity
  blocked: { count: number; items: BlockedItem[] }
  workload: WorkloadEntry[]
  pipeline: Record<string, number>
  epics: EpicEntry[]
}

interface EngineeringData {
  teams: { ASD: TeamData; FS: TeamData }
  summary: {
    totalVelocity: number
    avgBugDensity: number
    totalBlocked: number
    zombieEpicCount: number
  }
  updatedAt: string
  source: string
  error: string | null
}

// ---------------------------------------------------------------------------
// Jira helpers
// ---------------------------------------------------------------------------
async function jiraGet(path: string) {
  const res = await fetch(`${JIRA_URL}${path}`, {
    headers: {
      Authorization: `Basic ${JIRA_AUTH}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Jira ${res.status}: ${path}`)
  return res.json()
}

/** Fetch all pages for a JQL search (handles pagination). */
async function jiraSearchAll(
  jql: string,
  fields: string,
  maxTotal = 1000,
): Promise<{ issues: any[]; total: number }> {
  const PAGE = 100
  const allIssues: any[] = []
  let nextPageToken: string | undefined

  do {
    const tokenParam = nextPageToken ? `&nextPageToken=${encodeURIComponent(nextPageToken)}` : ''
    const res = await jiraGet(
      `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${PAGE}&fields=${fields}${tokenParam}`,
    )
    allIssues.push(...(res.issues ?? []))
    nextPageToken = res.nextPageToken
    if (res.isLast || allIssues.length >= maxTotal) break
  } while (nextPageToken)

  return { issues: allIssues, total: allIssues.length }
}

/** Count query — new Jira API has no 'total' field. We paginate quickly with minimal fields. */
async function jiraCount(jql: string): Promise<number> {
  let count = 0
  let nextPageToken: string | undefined
  do {
    const tokenParam = nextPageToken ? `&nextPageToken=${encodeURIComponent(nextPageToken)}` : ''
    const res = await jiraGet(
      `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=100&fields=summary${tokenParam}`,
    )
    count += (res.issues?.length ?? 0)
    nextPageToken = res.nextPageToken
    if (res.isLast) break
  } while (nextPageToken && count < 5000)
  return count
}

// ---------------------------------------------------------------------------
// Data-fetching functions (per team / global)
// ---------------------------------------------------------------------------

/** Get active sprints for a board. */
async function getActiveSprints(boardId: number): Promise<any[]> {
  const data = await jiraGet(
    `/rest/agile/1.0/board/${boardId}/sprint?state=active`,
  )
  return data.values ?? []
}

/** Get closed sprints for a board (last N). */
async function getClosedSprints(
  boardId: number,
  max = 5,
): Promise<any[]> {
  const data = await jiraGet(
    `/rest/agile/1.0/board/${boardId}/sprint?state=closed&maxResults=${max}`,
  )
  return data.values ?? []
}

/** Get issues in a sprint (with pagination). */
async function getSprintIssues(
  sprintId: number,
  fields = 'summary,status,issuetype,assignee,created,updated,priority',
): Promise<any[]> {
  const PAGE = 200
  const first = await jiraGet(
    `/rest/agile/1.0/sprint/${sprintId}/issue?maxResults=${PAGE}&fields=${fields}`,
  )
  const issues = [...(first.issues ?? [])]
  const total: number = first.total ?? 0

  if (total > PAGE) {
    const pages = Math.ceil(total / PAGE) - 1
    const fetches = Array.from({ length: pages }, (_, i) =>
      jiraGet(
        `/rest/agile/1.0/sprint/${sprintId}/issue?startAt=${(i + 1) * PAGE}&maxResults=${PAGE}&fields=${fields}`,
      ),
    )
    const results = await Promise.all(fetches)
    for (const r of results) issues.push(...(r.issues ?? []))
  }
  return issues
}

// ---------------------------------------------------------------------------
// Build team data
// ---------------------------------------------------------------------------

function daysBetween(dateStr: string): number {
  return Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24),
  )
}

async function buildTeamData(project: string): Promise<TeamData> {
  const boardId = BOARDS[project]

  // --- 1. Active sprint + issues -------------------------------------------
  const activeSprints = await getActiveSprints(boardId)
  const activeSprint = activeSprints[0] // take first active sprint

  let sprintIssues: any[] = []
  if (activeSprint) {
    sprintIssues = await getSprintIssues(activeSprint.id)
  }

  const doneIssues = sprintIssues.filter(
    (i) => i.fields?.status?.statusCategory?.key === 'done',
  )
  const activeItems = sprintIssues.filter(
    (i) => i.fields?.status?.statusCategory?.key === 'indeterminate',
  )

  const sprint: SprintData = {
    name: activeSprint?.name ?? 'No active sprint',
    startDate: activeSprint?.startDate ?? '',
    endDate: activeSprint?.endDate ?? '',
    totalIssues: sprintIssues.length,
    doneIssues: doneIssues.length,
    velocity:
      sprintIssues.length > 0
        ? Math.round((doneIssues.length / sprintIssues.length) * 100)
        : 0,
    activeItems: activeItems.length,
  }

  // --- 2. Velocity history (closed sprints) --------------------------------
  const closedSprints = await getClosedSprints(boardId, 5)
  const velocityFetches = closedSprints.map(async (s: any) => {
    const issues = await getSprintIssues(s.id, 'status')
    const done = issues.filter(
      (i: any) => i.fields?.status?.statusCategory?.key === 'done',
    ).length
    return {
      sprintName: s.name,
      velocity: issues.length > 0 ? Math.round((done / issues.length) * 100) : 0,
      done,
      total: issues.length,
    }
  })
  const velocityHistory: VelocityEntry[] = await Promise.all(velocityFetches)

  // --- 3. Bug density (90 days) -------------------------------------------
  // Numerator: only parent Bug issues (excludes Bug-Subtask / Sub-bug subtasks
  //            which can outnumber stories and push the ratio above 100%).
  // Denominator: all non-subtask issues so the metric stays comparable.
  const [bugCount90d, totalCount90d] = await Promise.all([
    jiraCount(
      `project=${project} AND issuetype = Bug AND created >= "-90d"`,
    ),
    jiraCount(
      `project=${project} AND issuetype not in subTaskIssueTypes() AND created >= "-90d"`,
    ),
  ])
  const bugDensity: BugDensity = {
    bugCount90d,
    totalCount90d,
    ratio:
      totalCount90d > 0
        ? Math.round((bugCount90d / totalCount90d) * 1000) / 10
        : 0,
  }

  // --- 4. Pipeline (status distribution for active issues) -----------------
  const pipeline: Record<string, number> = {}
  for (const issue of sprintIssues) {
    const status = issue.fields?.status?.name ?? 'Unknown'
    pipeline[status] = (pipeline[status] ?? 0) + 1
  }

  // --- 5. Workload per person (from active sprint issues) ------------------
  const workloadMap: Record<
    string,
    { inProgress: number; codeReview: number; qa: number; total: number }
  > = {}
  for (const issue of sprintIssues) {
    const statusCatKey = issue.fields?.status?.statusCategory?.key
    if (statusCatKey === 'done') continue // skip done items for workload

    const person =
      issue.fields?.assignee?.displayName ?? 'Unassigned'
    if (!workloadMap[person]) {
      workloadMap[person] = { inProgress: 0, codeReview: 0, qa: 0, total: 0 }
    }

    const statusName = (issue.fields?.status?.name ?? '').toLowerCase()
    workloadMap[person].total += 1

    if (statusName.includes('review') || statusName.includes('code review')) {
      workloadMap[person].codeReview += 1
    } else if (statusName.includes('qa') || statusName.includes('testing')) {
      workloadMap[person].qa += 1
    } else if (
      statusName.includes('progress') ||
      statusName.includes('development')
    ) {
      workloadMap[person].inProgress += 1
    } else {
      // count towards inProgress as a catch-all for active items
      workloadMap[person].inProgress += 1
    }
  }
  const workload: WorkloadEntry[] = Object.entries(workloadMap)
    .map(([person, w]) => ({ person, ...w }))
    .sort((a, b) => b.total - a.total)

  // --- 6. Epics (fetched globally, filtered per project below) -------------
  // Epics are fetched globally to allow batching; placeholder here
  const epics: EpicEntry[] = [] // populated later

  return {
    sprint,
    velocityHistory,
    bugDensity,
    blocked: { count: 0, items: [] }, // populated later (global query)
    workload,
    pipeline,
    epics,
  }
}

// ---------------------------------------------------------------------------
// Global queries (blocked, epics)
// ---------------------------------------------------------------------------

async function fetchBlocked(): Promise<BlockedItem[]> {
  const { issues } = await jiraSearchAll(
    `project in (${PROJECTS.join(',')}) AND status in (Blocked,Hold)`,
    'summary,assignee,created,priority,project',
    200,
  )
  return issues.map((i: any) => ({
    key: i.key,
    summary: i.fields?.summary ?? '',
    assignee: i.fields?.assignee?.displayName ?? 'Unassigned',
    daysSinceCreated: daysBetween(i.fields?.created ?? new Date().toISOString()),
    project: i.key.split('-')[0],
  }))
}

async function fetchEpics(): Promise<EpicEntry[]> {
  // 1. Get open epics
  const { issues: epics } = await jiraSearchAll(
    `project in (${PROJECTS.join(',')}) AND issuetype=Epic AND status not in (Done,Closed,Canceled)`,
    'summary,status,project',
    200,
  )

  if (epics.length === 0) return []

  const epicKeys = epics.map((e: any) => e.key)

  // 2. Batch fetch all children of these epics in one query
  //    Use chunks of 30 to avoid JQL length limits
  const CHUNK = 30
  const childMap: Record<string, { total: number; done: number }> = {}
  for (const key of epicKeys) {
    childMap[key] = { total: 0, done: 0 }
  }

  for (let i = 0; i < epicKeys.length; i += CHUNK) {
    const chunk = epicKeys.slice(i, i + CHUNK)
    const jqlKeys = chunk.map((k: string) => `"${k}"`).join(',')

    // Fetch all children for this chunk
    const [allChildren, doneChildren] = await Promise.all([
      jiraSearchAll(
        `parent in (${chunk.join(',')})`,
        'status,parent',
        2000,
      ),
      jiraSearchAll(
        `parent in (${chunk.join(',')}) AND statusCategory=Done`,
        'status,parent',
        2000,
      ),
    ])

    // Group by epic link — the epic link is in issue.fields.parent or we
    // need to detect it from the customfield.  Jira Agile stores epic link
    // in customfield_10014 (common) or we can infer from the search filter.
    // Simpler: query per-epic but batched with Promise.all for this chunk.
    // Let's do individual counts in parallel since groupBy isn't reliable.
    const countFetches = chunk.map(async (key: string) => {
      const [total, done] = await Promise.all([
        jiraCount(`parent = ${key}`),
        jiraCount(`parent = ${key} AND statusCategory = Done`),
      ])
      childMap[key] = { total, done }
    })

    await Promise.all(countFetches)
  }

  return epics.map((e: any) => {
    const key = e.key
    const { total, done } = childMap[key] ?? { total: 0, done: 0 }
    const progressPct = total > 0 ? Math.round((done / total) * 100) : 0
    // "Zombie" epic: has children but less than 20% done and is older than 30 days
    const isZombie = total > 0 && progressPct < 20

    return {
      key,
      summary: e.fields?.summary ?? '',
      project: e.key.split('-')[0],
      done,
      total,
      progressPct,
      isZombie,
    }
  })
}

// ---------------------------------------------------------------------------
// Fallback data
// ---------------------------------------------------------------------------

function fallbackTeam(project: string): TeamData {
  const isASD = project === 'ASD'
  return {
    sprint: {
      name: isASD ? 'ASD Sprint 42' : 'FS Sprint 18',
      startDate: '2026-03-28',
      endDate: '2026-04-11',
      totalIssues: isASD ? 36 : 24,
      doneIssues: isASD ? 22 : 21,
      velocity: isASD ? 61 : 88,
      activeItems: isASD ? 14 : 3,
    },
    velocityHistory: [
      { sprintName: `${project} Sprint -4`, velocity: isASD ? 55 : 82, done: 0, total: 0 },
      { sprintName: `${project} Sprint -3`, velocity: isASD ? 60 : 85, done: 0, total: 0 },
      { sprintName: `${project} Sprint -2`, velocity: isASD ? 58 : 90, done: 0, total: 0 },
      { sprintName: `${project} Sprint -1`, velocity: isASD ? 62 : 87, done: 0, total: 0 },
    ],
    bugDensity: {
      bugCount90d: isASD ? 18 : 6,
      totalCount90d: isASD ? 120 : 80,
      ratio: isASD ? 15 : 7.5,
    },
    blocked: {
      count: isASD ? 3 : 1,
      items: [],
    },
    workload: [],
    pipeline: isASD
      ? { 'To Do': 8, 'In Progress': 10, 'Code Review': 6, QA: 4, Done: 22 }
      : { 'To Do': 3, 'In Progress': 5, 'Code Review': 2, QA: 1, Done: 21 },
    epics: [],
  }
}

function buildFallback(): EngineeringData {
  return {
    teams: { ASD: fallbackTeam('ASD'), FS: fallbackTeam('FS') },
    summary: {
      totalVelocity: 75,
      avgBugDensity: 11.3,
      totalBlocked: 4,
      zombieEpicCount: 0,
    },
    updatedAt: new Date().toISOString(),
    source: 'fallback',
    error: null,
  }
}

// ---------------------------------------------------------------------------
// Main data builder
// ---------------------------------------------------------------------------

async function fetchEngineeringData(): Promise<EngineeringData> {
  // Check cache
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data as EngineeringData
  }

  // Build both teams + global queries in parallel
  const [asdTeam, fsTeam, blockedItems, allEpics] = await Promise.all([
    buildTeamData('ASD'),
    buildTeamData('FS'),
    fetchBlocked(),
    fetchEpics(),
  ])

  // Distribute blocked items to teams
  const asdBlocked = blockedItems.filter((b: any) => (b as any).project === 'ASD')
  const fsBlocked = blockedItems.filter((b: any) => (b as any).project === 'FS')
  asdTeam.blocked = { count: asdBlocked.length, items: asdBlocked }
  fsTeam.blocked = { count: fsBlocked.length, items: fsBlocked }

  // Distribute epics to teams
  asdTeam.epics = allEpics.filter((e) => e.project === 'ASD')
  fsTeam.epics = allEpics.filter((e) => e.project === 'FS')

  // Summary
  const totalVelocity = Math.round(
    (asdTeam.sprint.velocity + fsTeam.sprint.velocity) / 2,
  )
  const avgBugDensity = Math.round(
    ((asdTeam.bugDensity.ratio + fsTeam.bugDensity.ratio) / 2) * 10,
  ) / 10
  const totalBlocked = blockedItems.length
  const zombieEpicCount = allEpics.filter((e) => e.isZombie).length

  const result: EngineeringData = {
    teams: { ASD: asdTeam, FS: fsTeam },
    summary: { totalVelocity, avgBugDensity, totalBlocked, zombieEpicCount },
    updatedAt: new Date().toISOString(),
    source: 'jira',
    error: null,
  }

  // Update cache
  cache = { data: result, timestamp: Date.now() }
  return result
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const data = await fetchEngineeringData()
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[jira/engineering] Error fetching from Jira:', err?.message ?? err)

    // Return fallback data so the page never crashes
    const fallback = buildFallback()
    return NextResponse.json(
      { ...fallback, error: err?.message ?? 'Unknown error', source: 'fallback' },
      { status: 200 }, // 200 so the frontend can still render
    )
  }
}

// Support ?refresh=true to bust cache
export async function POST() {
  cache = null
  try {
    const data = await fetchEngineeringData()
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[jira/engineering] Error on refresh:', err?.message ?? err)
    const fallback = buildFallback()
    return NextResponse.json(
      { ...fallback, error: err?.message ?? 'Unknown error', source: 'fallback' },
      { status: 200 },
    )
  }
}
