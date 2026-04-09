import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

function MiniSparkline({ data, color }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 64
  const h = 20
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x},${y}`
    })
    .join(" ")
  const strokeColor =
    color ?? (data[data.length - 1] >= data[0] ? "var(--success)" : "var(--error)")
  return (
    <svg width={w} height={h} className="inline-block ml-1">
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface ScoreBoxProps {
  label: string
  value: string | number
  sub?: string
  trend?: "up" | "down" | "flat"
  comparison?: string
  sparkData?: number[]
  status?: "ok" | "watch" | "stop" | "neutral"
  className?: string
}

export function ScoreBox({
  label,
  value,
  sub,
  trend,
  comparison,
  sparkData,
  status = "neutral",
  className,
}: ScoreBoxProps) {
  const valueColor = {
    ok: "status-ok",
    watch: "status-watch",
    stop: "status-stop",
    neutral: "text-[var(--foreground)]",
  }[status]

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-caption">{label}</span>
      <div className="flex items-center gap-1">
        <span className={cn("text-kpi", valueColor)}>{value}</span>
        {sparkData && sparkData.length >= 2 && <MiniSparkline data={sparkData} />}
      </div>
      {(sub || trend || comparison) && (
        <div className="flex flex-col gap-0.5">
          {(sub || trend) && (
            <div className="flex items-center gap-1.5">
              {trend === "up" && <TrendingUp className="h-3 w-3 status-ok" />}
              {trend === "down" && <TrendingDown className="h-3 w-3 status-stop" />}
              {trend === "flat" && <Minus className="h-3 w-3 text-[var(--muted-foreground)]" />}
              {sub && <span className="text-[12px] text-[var(--muted-foreground)]">{sub}</span>}
            </div>
          )}
          {comparison && (
            <span className="text-[11px] text-[var(--muted-foreground)]">{comparison}</span>
          )}
        </div>
      )}
    </div>
  )
}
