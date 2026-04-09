import { Card, CardContent } from "@/components/ui/card"
import { StatusDot } from "./status-dot"
import { ScoreBox } from "./score-box"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface Metric {
  label: string
  value: string | number
  status?: "ok" | "watch" | "stop" | "neutral"
}

interface DeptCardProps {
  name: string
  href: string
  status: "green" | "yellow" | "red" | "gray"
  metrics: Metric[]
  alert?: string
  className?: string
}

export function DeptCard({ name, href, status, metrics, alert, className }: DeptCardProps) {
  return (
    <Link href={href}>
      <Card className={cn("group cursor-pointer h-full", className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <StatusDot status={status} size="md" />
              <h3 className="text-[16px] font-bold text-[var(--foreground)]">{name}</h3>
            </div>
            <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)] group-hover:text-[var(--accent)] transition-default" />
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {metrics.map((m) => (
              <ScoreBox
                key={m.label}
                label={m.label}
                value={m.value}
                status={m.status}
                className="[&_.text-kpi]:text-[20px]"
              />
            ))}
          </div>

          {alert && (
            <div className="mt-5 pt-4 border-t border-[rgba(255,255,255,0.06)]">
              <p className="text-[12px] text-[#F5A623] font-medium leading-snug line-clamp-2">
                ⚠ {alert}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
