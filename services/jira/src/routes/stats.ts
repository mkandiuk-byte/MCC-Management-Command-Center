import type { FastifyInstance } from 'fastify'
import fs from 'fs'
import path from 'path'
import { getActiveSprint, getSprintIssues, getBoardIssues, type JiraIssue } from '../lib/jira.js'
import { searchPRsForIssues } from '../lib/github-prs.js'

const CONFIG_PATH = process.env.PANEL_CONFIG_PATH
  ?? path.join(process.env.PANEL_ROOT ?? process.cwd(), '.panel-config.json')

interface BoardConfig {
  id: string; boardId: number; projectKey: string; displayName: string; url: string
}

function getConfig(): BoardConfig[] {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')).jiraBoards ?? [] }
  catch { return [] }
}

interface BoardStats {
  boardId: number; displayName: string; projectKey: string; url: string
  sprintName: string | null; total: number
  todo: number; inProgress: number; done: number
  working_on: number; draft: number; open: number; merged: number; closed: number
  assignees: { name: string; avatar: string; count: number }[]
  error?: string
}

async function fetchBoardStats(board: BoardConfig): Promise<BoardStats> {
  const base: BoardStats = {
    boardId: board.boardId, displayName: board.displayName,
    projectKey: board.projectKey, url: board.url,
    sprintName: null, total: 0,
    todo: 0, inProgress: 0, done: 0,
    working_on: 0, draft: 0, open: 0, merged: 0, closed: 0,
    assignees: [],
  }

  try {
    const sprint = await getActiveSprint(board.boardId)
    base.sprintName = sprint ? sprint.name : 'All Issues'
    const issues: JiraIssue[] = sprint ? await getSprintIssues(sprint.id) : await getBoardIssues(board.boardId)
    const prMap = await searchPRsForIssues(issues.map(i => i.key))
    base.total = issues.length

    const assigneeMap = new Map<string, { name: string; avatar: string; count: number }>()
    for (const issue of issues) {
      const cat = issue.fields.status.statusCategory.key
      if (cat === 'new') base.todo++
      else if (cat === 'indeterminate') base.inProgress++
      else if (cat === 'done') base.done++

      const pr = prMap.get(issue.key)
      const prStatus = (pr ? pr.status : 'working_on') as keyof BoardStats
      ;(base[prStatus] as number)++

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

export async function statsRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const boards = getConfig()
    if (!boards.length) return { boards: [] }
    const results = await Promise.all(boards.map(fetchBoardStats))
    const totals = results.reduce((acc, b) => ({
      total: acc.total + b.total, inProgress: acc.inProgress + b.inProgress,
      done: acc.done + b.done, merged: acc.merged + b.merged, open: acc.open + b.open,
    }), { total: 0, inProgress: 0, done: 0, merged: 0, open: 0 })
    return { boards: results, totals }
  })
}
