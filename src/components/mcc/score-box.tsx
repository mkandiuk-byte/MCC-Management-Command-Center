import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface ScoreBoxProps {
  label: string
  value: string | number
  sub?: string
  trend?: "up" | "down" | "flat"
  status?: "ok" | "watch" | "stop" | "neutral"
  className?: string
}

export function ScoreBox({ label, value, sub, trend, status = "neutral", className }: ScoreBoxProps) {
  const valueColor = {
    ok: "status-ok",
    watch: "status-watch",
    stop: "status-stop",
    neutral: "text-[var(--foreground)]",
  }[status]

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-caption">{label}</span>
      <span className={cn("text-kpi", valueColor)}>{value}</span>
      {(sub || trend) && (
        <div className="flex items-center gap-1.5">
          {trend === "up" && <TrendingUp className="h-3 w-3 status-ok" />}
          {trend === "down" && <TrendingDown className="h-3 w-3 status-stop" />}
          {trend === "flat" && <Minus className="h-3 w-3 text-[var(--muted-foreground)]" />}
          {sub && <span className="text-[12px] text-[var(--muted-foreground)]">{sub}</span>}
        </div>
      )}
    </div>
  )
}
