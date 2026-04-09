"use client"

import { cn } from "@/lib/utils"
import { useState, useEffect, useRef } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

const periods = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
]

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  return `${hr}h ago`
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  lastUpdated?: string
  activePeriod?: number
  onPeriodChange?: (days: number) => void
  onRefresh?: () => void
  children?: React.ReactNode
}

export function PageHeader({
  title,
  subtitle,
  lastUpdated,
  activePeriod = 30,
  onPeriodChange,
  onRefresh,
  children,
}: PageHeaderProps) {
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefreshing, setAutoRefreshing] = useState(false)
  const [, setTick] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleRefresh = () => {
    setRefreshing(true)
    onRefresh?.()
    setTimeout(() => setRefreshing(false), 1000)
  }

  // Auto-refresh every 5 minutes when onRefresh is provided
  useEffect(() => {
    if (!onRefresh) return

    intervalRef.current = setInterval(() => {
      setAutoRefreshing(true)
      onRefresh()
      setTimeout(() => setAutoRefreshing(false), 2000)
    }, 5 * 60 * 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [onRefresh])

  // Tick every 30s to update the "X min ago" display
  useEffect(() => {
    if (!lastUpdated) return
    tickRef.current = setInterval(() => setTick((t) => t + 1), 30000)
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [lastUpdated])

  return (
    <header className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
      <div className="flex-1 min-w-0">
        <h1 className="text-page-title">{title}</h1>
        {(subtitle || lastUpdated) && (
          <div className="flex items-center gap-2 mt-1.5">
            {subtitle && (
              <p className="text-[13px] text-[var(--muted-foreground)]">{subtitle}</p>
            )}
            {lastUpdated && (
              <span className="text-[12px] text-[var(--muted-foreground)] opacity-70">
                {subtitle ? " · " : ""}Updated {timeAgo(lastUpdated)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {onPeriodChange && (
          <div className="flex items-center bg-[var(--muted)] border border-[var(--border)] rounded-lg p-0.5">
            {periods.map((p) => (
              <button
                key={p.days}
                onClick={() => onPeriodChange(p.days)}
                className={cn(
                  "px-3 py-1.5 text-[12px] font-medium rounded-md transition-default",
                  activePeriod === p.days
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="border-[var(--border)] bg-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5",
                refreshing && "animate-spin",
                autoRefreshing && "animate-pulse text-[var(--accent)]"
              )}
            />
          </Button>
        )}

        {children}
      </div>
    </header>
  )
}
