import { ServiceMap } from '@/components/service-map'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const BASE = process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3777'

interface Repo {
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

const COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
]

export default async function ServiceMapPage() {
  let repos: Repo[] = []
  try {
    const res = await fetch(`${BASE}/api/repos`, { cache: 'no-store' })
    const data = await res.json()
    repos = data.repos ?? []
  } catch {
    repos = []
  }

  const sortedRepos = [...repos]
    .filter(r => r.diskSizeKb > 0)
    .sort((a, b) => b.diskSizeKb - a.diskSizeKb)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Service Map</h1>
          <p className="text-muted-foreground text-sm">
            Click a segment to explore repository analytics. Size = disk usage.
          </p>
        </div>
        <Badge variant="secondary">{repos.length} repositories</Badge>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ServiceMap repos={repos} />
        </CardContent>
      </Card>

      {/* Legend */}
      {sortedRepos.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
              Legend
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {sortedRepos.map((repo, i) => {
                const sizeLabel = repo.diskSizeKb > 1024
                  ? `${(repo.diskSizeKb / 1024).toFixed(1)} MB`
                  : `${repo.diskSizeKb} KB`
                return (
                  <a
                    key={repo.name}
                    href={`/repos/${encodeURIComponent(repo.name)}`}
                    className="flex items-center gap-1.5 text-xs hover:opacity-80 transition-opacity"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="font-medium">{repo.name}</span>
                    <span className="text-muted-foreground">({sizeLabel})</span>
                  </a>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
