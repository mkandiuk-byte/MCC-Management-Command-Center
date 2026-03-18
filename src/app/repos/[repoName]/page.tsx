import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RepoAnalytics } from '@/components/repo-analytics'

const BASE = process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3777'

interface RepoFromAPI {
  name: string
  diskSizeKb: number
  githubOwner: string
  githubRepo: string
  branch: string
  lastCommitDate: string
  isDirty: boolean
  ahead: number
  behind: number
}

export default async function RepoDetailPage({
  params,
}: {
  params: Promise<{ repoName: string }>
}) {
  const { repoName } = await params
  const name = decodeURIComponent(repoName)

  let repo: RepoFromAPI | null = null
  let stats: any = null

  try {
    const reposRes = await fetch(`${BASE}/api/repos`, { cache: 'no-store' })
    const reposData = await reposRes.json()
    repo = reposData.repos?.find((r: RepoFromAPI) => r.name === name) ?? null
  } catch {
    // repo stays null
  }

  if (repo?.githubOwner && repo?.githubRepo) {
    try {
      const statsRes = await fetch(
        `${BASE}/api/github/repo-stats?owner=${repo.githubOwner}&repo=${repo.githubRepo}`,
        { cache: 'no-store' }
      )
      stats = await statsRes.json()
    } catch {
      // stats stays null
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd MMM yyyy')
    } catch {
      return dateStr
    }
  }

  const formatAgo = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/repos/map"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Service Map
        </Link>
        <h1 className="text-2xl font-bold">{name}</h1>
        {repo && <Badge variant="outline">{repo.branch}</Badge>}
        {repo?.githubOwner && (
          <Badge variant="secondary">{repo.githubOwner}</Badge>
        )}
        {repo?.isDirty && (
          <Badge variant="destructive">Uncommitted changes</Badge>
        )}
        {(repo?.ahead ?? 0) > 0 && (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            ↑{repo!.ahead} ahead
          </Badge>
        )}
        {(repo?.behind ?? 0) > 0 && (
          <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
            ↓{repo!.behind} behind
          </Badge>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total PRs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalPRs}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Merged
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">
                {stats.totalMerges}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Created
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-semibold">
                {formatDate(stats.createdAt)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Last Merge
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-semibold">
                {stats.lastMerge ? formatAgo(stats.lastMerge.date) : '—'}
              </div>
              {stats.lastMerge && (
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  #{stats.lastMerge.number} {stats.lastMerge.title}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Latest PR */}
      {stats?.lastPR && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Latest PR</CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={stats.lastPR.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium hover:underline text-indigo-400"
            >
              #{stats.lastPR.number} {stats.lastPR.title}
            </a>
            <span className="text-xs text-muted-foreground ml-2">
              {formatAgo(stats.lastPR.date)}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Disk size info */}
      {repo && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Repository Info</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Disk size: </span>
              <span className="font-medium">
                {repo.diskSizeKb > 1024
                  ? `${(repo.diskSizeKb / 1024).toFixed(1)} MB`
                  : `${repo.diskSizeKb} KB`}
              </span>
            </div>
            {repo.lastCommitDate && (
              <div>
                <span className="text-muted-foreground">Last commit: </span>
                <span className="font-medium">{formatAgo(repo.lastCommitDate)}</span>
              </div>
            )}
            {repo.githubOwner && repo.githubRepo && (
              <div>
                <span className="text-muted-foreground">GitHub: </span>
                <a
                  href={`https://github.com/${repo.githubOwner}/${repo.githubRepo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-indigo-400 hover:underline"
                >
                  {repo.githubOwner}/{repo.githubRepo}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      {stats && <RepoAnalytics stats={stats} />}

      {/* No stats fallback */}
      {!stats && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No GitHub data available for this repository.
            {!repo?.githubOwner && (
              <p className="text-xs mt-2">
                githubOwner / githubRepo fields are missing from the API response.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
