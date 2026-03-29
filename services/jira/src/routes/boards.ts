import type { FastifyInstance } from 'fastify'
import { getActiveSprint, getSprintIssues, getBoardIssues, formatSeconds } from '../lib/jira.js'
import { searchPRsForIssues } from '../lib/github-prs.js'

export async function boardsRoutes(app: FastifyInstance) {
  // GET /api/jira/boards/:boardId
  app.get('/:boardId', async (req, reply) => {
    const { boardId } = req.params as { boardId: string }
    const id = parseInt(boardId, 10)

    try {
      const sprint = await getActiveSprint(id)
      const issues = sprint ? await getSprintIssues(sprint.id) : await getBoardIssues(id)
      const sprintInfo = sprint
        ? { id: sprint.id, name: sprint.name, startDate: sprint.startDate, endDate: sprint.endDate }
        : { id: -1, name: 'All Issues', noActiveSprint: true }

      const prMap = await searchPRsForIssues(issues.map(i => i.key))

      const tasks = issues.map(issue => {
        const pr = prMap.get(issue.key) ?? null
        return {
          key: issue.key,
          summary: issue.fields.summary,
          status: issue.fields.status.name,
          statusCategory: issue.fields.status.statusCategory.key,
          assignee: issue.fields.assignee
            ? { name: issue.fields.assignee.displayName, avatar: issue.fields.assignee.avatarUrls['24x24'] }
            : null,
          estimate: formatSeconds(issue.fields.timeoriginalestimate),
          timespent: formatSeconds(issue.fields.timespent),
          issueUrl: `${process.env.JIRA_BASE_URL}/browse/${issue.key}`,
          pr: pr ? { url: pr.url, number: pr.number, title: pr.title, repo: pr.repo, status: pr.status } : null,
          prStatus: pr ? pr.status : 'working_on',
        }
      })

      return { sprint: sprintInfo, tasks }
    } catch (e: unknown) {
      return reply.status(500).send({ error: e instanceof Error ? e.message : 'Unknown error' })
    }
  })
}
