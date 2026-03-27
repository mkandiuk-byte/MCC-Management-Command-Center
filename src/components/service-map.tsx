'use client'

import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'

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

interface ServiceMapProps {
  repos: Repo[]
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
]

function CustomCell(props: any) {
  const { x, y, width, height, name, diskSizeKb, index } = props

  if (width < 20 || height < 20) return null

  const color = COLORS[index % COLORS.length]
  const sizeLabel = diskSizeKb > 1024
    ? `${(diskSizeKb / 1024).toFixed(1)} MB`
    : `${diskSizeKb} KB`

  return (
    <g
      onClick={() => {
        window.location.href = '/repos/' + encodeURIComponent(name)
      }}
      style={{ cursor: 'pointer' }}
    >
      <rect
        x={x + 1} y={y + 1} width={width - 2} height={height - 2}
        rx={4}
        fill={color}
        fillOpacity={0.85}
        stroke="hsl(var(--background))"
        strokeWidth={2}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.85')}
      />
      {height > 40 && width > 60 && (
        <text
          x={x + width / 2} y={y + height / 2 - 8}
          textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize={Math.min(14, width / 8)}
          fontWeight="600"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {name.length > 20 && width < 120 ? name.slice(0, 15) + '…' : name}
        </text>
      )}
      {height > 55 && width > 60 && (
        <text
          x={x + width / 2} y={y + height / 2 + 10}
          textAnchor="middle" dominantBaseline="middle"
          fill="rgba(255,255,255,0.75)" fontSize={Math.min(11, width / 10)}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {sizeLabel}
        </text>
      )}
    </g>
  )
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const sizeLabel = d.diskSizeKb > 1024
    ? `${(d.diskSizeKb / 1024).toFixed(1)} MB`
    : `${d.diskSizeKb} KB`
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-semibold">{d.name}</p>
      <p className="text-muted-foreground">Size: {sizeLabel}</p>
      <p className="text-muted-foreground">Branch: {d.branch}</p>
      {d.isDirty && <p className="text-yellow-500">Uncommitted changes</p>}
      {(d.ahead > 0 || d.behind > 0) && (
        <p className="text-muted-foreground">
          {d.ahead > 0 ? `↑${d.ahead} ` : ''}{d.behind > 0 ? `↓${d.behind}` : ''}
        </p>
      )}
    </div>
  )
}

export function ServiceMap({ repos }: ServiceMapProps) {
  const treeData = repos
    .filter(r => r.diskSizeKb > 0)
    .map(r => ({ ...r, size: Math.max(r.diskSizeKb, 200) }))
    .sort((a, b) => b.diskSizeKb - a.diskSizeKb)

  if (treeData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No repository data available.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={600}>
      <Treemap
        data={treeData}
        dataKey="size"
        aspectRatio={4 / 3}
        content={(props: any) => <CustomCell {...props} />}
      >
        <Tooltip content={<CustomTooltip />} />
      </Treemap>
    </ResponsiveContainer>
  )
}
