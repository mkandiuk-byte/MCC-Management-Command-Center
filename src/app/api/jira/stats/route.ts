import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { getActiveSprint, getSprintIssues, getBoardIssues, formatSeconds } from '@/lib/jira'
import { searchPRsForIssues } from '@/lib/github-prs'

interface BoardConfig {
  id: string
  boardId: number
  projectKey: string
  displayName: string
  url: string
}

export interface BoardStats {
  boardId: number
  displayName: string
  projectKey: string
  url: string
  sprintName: string | null
  total: number
  // Jira status categories
  todo: number
  inProgress: number
  done: number
  // PR statuses
  working_on: number
  draft: number
  open: number
  merged: number
  closed: number
  // Assignee breakdown: name → count
  assignees: { name: string; avatar: string; count: number }[]
  error?: string
}

function getConfig(): BoardConfig[] {
  const configPath = join(process.cwd(), '.panel-config.json')
  try {
    const raw = readFileSync(configPath, 'utf-8')
    return JSON.parse(raw).jiraBoards ?? []
  } catch {
    return []
  }
}

async function fetchBoardStats(board: BoardConfig): Promise<BoardStats> {
  const base: BoardStats = {
    boardId: board.boardId,
    displayName: board.displayName,
    projectKey: board.projectKey,
    url: board.url,
    sprintName: null,
    total: 0,
    todo: 0, inProgress: 0, done: 0,
    working_on: 0, draft: 0, open: 0, merged: 0, closed: 0,
    assignees: [],
  }

  try {
    const sprint = await getActiveSprint(board.boardId)

    base.sprintName = sprint ? sprint.name : 'All Issues'
    const issues = sprint
      ? await getSprintIssues(sprint.id)
      : await getBoardIssues(board.boardId)
    const prMap = await searchPRsForIssues(issues.map(i => i.key))

    base.total = issues.length

    const assigneeMap = new Map<string, { name: string; avatar: string; count: number }>()

    for (const issue of issues) {
      // Status category
      const cat = issue.fields.status.statusCategory.key
      if (cat === 'new') base.todo++
      else if (cat === 'indeterminate') base.inProgress++
      else if (cat === 'done') base.done++

      // PR status
      const pr = prMap.get(issue.key)
      const prStatus = pr ? pr.status : 'working_on'
      base[prStatus]++

      // Assignee
      if (issue.fields.assignee) {
        const name = issue.fields.assignee.displayName
        const avatar = issue.fields.assignee.avatarUrls['24x24']
        const existing = assigneeMap.get(name)
        if (existing) existing.count++
        else assigneeMap.set(name, { name, avatar, count: 1 })
      }
    }

    base.assignees = [...assigneeMap.values()].sort((a, b) => b.count - a.count)
    return base
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function GET() {
  const boards = getConfig()
  if (!boards.length) {
    return NextResponse.json({ boards: [] })
  }

  const results = await Promise.all(boards.map(fetchBoardStats))

  // Overall totals
  const totals = results.reduce((acc, b) => ({
    total: acc.total + b.total,
    inProgress: acc.inProgress + b.inProgress,
    done: acc.done + b.done,
    merged: acc.merged + b.merged,
    open: acc.open + b.open,
  }), { total: 0, inProgress: 0, done: 0, merged: 0, open: 0 })

  return NextResponse.json({ boards: results, totals })
}
