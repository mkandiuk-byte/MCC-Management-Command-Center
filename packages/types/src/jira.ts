// ─── Jira / GitHub ────────────────────────────────────────────────────────────

export interface BoardStats {
  boardId: number
  displayName: string
  projectKey: string
  url: string
  sprintName: string | null
  total: number
  todo: number
  inProgress: number
  done: number
  working_on: number
  draft: number
  open: number
  merged: number
  closed: number
  assignees: { name: string; avatar: string; count: number }[]
  error?: string
}

export interface JiraStatsResponse {
  boards: BoardStats[]
  lastUpdated: string
  error?: string
}
