function getBase() { return process.env.JIRA_BASE_URL! }
function getHeaders() {
  const auth = Buffer.from(
    `${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`
  ).toString('base64')
  return { Authorization: `Basic ${auth}`, Accept: 'application/json' }
}

export interface JiraBoard {
  id: number
  name: string
  type: string
  location?: { projectKey: string; projectName: string }
}

export interface JiraSprint {
  id: number
  name: string
  state: string
  startDate?: string
  endDate?: string
}

export interface JiraIssue {
  id: string
  key: string
  fields: {
    summary: string
    status: { name: string; statusCategory: { key: string } }
    assignee: { displayName: string; avatarUrls: { '24x24': string } } | null
    timeoriginalestimate: number | null  // seconds
    timespent: number | null             // seconds
    timetracking?: {
      originalEstimate?: string
      timeSpent?: string
      remainingEstimate?: string
    }
  }
}

export function formatSeconds(sec: number | null): string {
  if (!sec) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export async function getBoard(boardId: number): Promise<JiraBoard> {
  const res = await fetch(`${getBase()}/rest/agile/1.0/board/${boardId}`, { headers: getHeaders() })
  if (!res.ok) throw new Error(`Jira board ${boardId}: ${res.status} ${res.statusText}`)
  return res.json()
}

export async function getActiveSprint(boardId: number): Promise<JiraSprint | null> {
  const res = await fetch(
    `${getBase()}/rest/agile/1.0/board/${boardId}/sprint?state=active&maxResults=1`,
    { headers: getHeaders() }
  )
  // 4xx means board doesn't support sprints (e.g. Kanban) — treat as no sprint
  if (res.status >= 400 && res.status < 500) return null
  if (!res.ok) throw new Error(`Jira sprints ${boardId}: ${res.status}`)
  const data = await res.json()
  return data.values?.[0] ?? null
}

export async function getSprintIssues(sprintId: number): Promise<JiraIssue[]> {
  const fields = 'summary,status,assignee,timeoriginalestimate,timespent,timetracking'
  const res = await fetch(
    `${getBase()}/rest/agile/1.0/sprint/${sprintId}/issue?fields=${fields}&maxResults=100`,
    { headers: getHeaders() }
  )
  if (!res.ok) throw new Error(`Jira sprint issues ${sprintId}: ${res.status}`)
  const data = await res.json()
  return data.issues ?? []
}

export async function getBoardIssues(boardId: number): Promise<JiraIssue[]> {
  const fields = 'summary,status,assignee,timeoriginalestimate,timespent,timetracking'
  const res = await fetch(
    `${getBase()}/rest/agile/1.0/board/${boardId}/issue?fields=${fields}&maxResults=200`,
    { headers: getHeaders() }
  )
  if (!res.ok) throw new Error(`Jira board issues ${boardId}: ${res.status}`)
  const data = await res.json()
  return data.issues ?? []
}

export function parseBoardUrl(url: string): { boardId: number; projectKey: string } | null {
  // https://xxx.atlassian.net/jira/software/c/projects/ASD/boards/1022
  // https://xxx.atlassian.net/jira/software/projects/ASD/boards/1022
  const m = url.match(/\/projects\/([A-Z0-9]+)\/boards\/(\d+)/)
  if (!m) return null
  return { projectKey: m[1], boardId: parseInt(m[2], 10) }
}
