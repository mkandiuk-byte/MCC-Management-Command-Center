import { NextRequest, NextResponse } from 'next/server'
import { getActiveSprint, getSprintIssues, getBoardIssues, formatSeconds } from '@/lib/jira'
import { searchPRsForIssues } from '@/lib/github-prs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params
  const id = parseInt(boardId, 10)

  try {
    const sprint = await getActiveSprint(id)

    const issues = sprint
      ? await getSprintIssues(sprint.id)
      : await getBoardIssues(id)

    const sprintInfo = sprint
      ? { id: sprint.id, name: sprint.name, startDate: sprint.startDate, endDate: sprint.endDate }
      : { id: -1, name: 'All Issues', noActiveSprint: true }
    const issueKeys = issues.map(i => i.key)

    // Fetch GitHub PRs for all issue keys in parallel with Jira data processing
    const prMap = await searchPRsForIssues(issueKeys)

    const tasks = issues.map(issue => {
      const pr = prMap.get(issue.key) ?? null
      return {
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        statusCategory: issue.fields.status.statusCategory.key,
        assignee: issue.fields.assignee
          ? {
              name: issue.fields.assignee.displayName,
              avatar: issue.fields.assignee.avatarUrls['24x24'],
            }
          : null,
        estimate: formatSeconds(issue.fields.timeoriginalestimate),
        timespent: formatSeconds(issue.fields.timespent),
        issueUrl: `${process.env.JIRA_BASE_URL}/browse/${issue.key}`,
        pr: pr
          ? {
              url: pr.url,
              number: pr.number,
              title: pr.title,
              repo: pr.repo,
              status: pr.status,
            }
          : null,
        prStatus: pr ? pr.status : 'working_on',
      }
    })

    return NextResponse.json({ sprint: sprintInfo, tasks })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
