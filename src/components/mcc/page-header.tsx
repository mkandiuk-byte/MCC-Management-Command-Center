"use client"

import { cn } from "@/lib/utils"
import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

const periods = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
]

interface PageHeaderProps {
  title: string
  subtitle?: string
  activePeriod?: number
  onPeriodChange?: (days: number) => void
  onRefresh?: () => void
  children?: React.ReactNode
}

export function PageHeader({
  title,
  subtitle,
  activePeriod = 30,
  onPeriodChange,
  onRefresh,
  children,
}: PageHeaderProps) {
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = () => {
    setRefreshing(true)
    onRefresh?.()
    setTimeout(() => setRefreshing(false), 1000)
  }

  return (
    <header className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
      <div className="flex-1 min-w-0">
        <h1 className="text-page-title">{title}</h1>
        {subtitle && (
          <p className="text-[13px] text-[#6B7A94] mt-1.5">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {onPeriodChange && (
          <div className="flex items-center bg-[#12151C] border border-[rgba(255,255,255,0.06)] rounded-lg p-0.5">
            {periods.map((p) => (
              <button
                key={p.days}
                onClick={() => onPeriodChange(p.days)}
                className={cn(
                  "px-3 py-1.5 text-[12px] font-medium rounded-md transition-default",
                  activePeriod === p.days
                    ? "bg-[#4C8BF5] text-white"
                    : "text-[#6B7A94] hover:text-[#C1CCDE]"
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
            className="border-[rgba(255,255,255,0.06)] bg-transparent text-[#6B7A94] hover:text-[#C1CCDE] hover:bg-[rgba(255,255,255,0.04)]"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </Button>
        )}

        {children}
      </div>
    </header>
  )
}
