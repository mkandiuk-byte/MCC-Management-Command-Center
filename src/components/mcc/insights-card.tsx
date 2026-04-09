"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Insight {
  type: "warning" | "success" | "info"
  text: string
}

interface InsightsCardProps {
  insights: Insight[]
  className?: string
}

export function InsightsCard({ insights, className }: InsightsCardProps) {
  const [expanded, setExpanded] = useState(true)
  const warnings = insights.filter((i) => i.type === "warning")
  const successes = insights.filter((i) => i.type === "success")
  const infos = insights.filter((i) => i.type === "info")

  if (insights.length === 0) return null

  return (
    <Card className={cn("border-l-[3px] border-l-[var(--accent)] bg-[var(--card)]", className)}>
      <CardContent className="p-5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2.5">
            <Info className="h-4 w-4 text-[#4C8BF5]" />
            <span className="text-[13px] font-semibold text-[var(--foreground)]">
              {warnings.length > 0 && `${warnings.length} issue${warnings.length !== 1 ? "s" : ""} requiring attention`}
              {successes.length > 0 && `${warnings.length > 0 ? " · " : ""}${successes.length} positive signal${successes.length !== 1 ? "s" : ""}`}
            </span>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-[var(--muted-foreground)]" /> : <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" />}
        </button>

        {expanded && (
          <div className="mt-4 space-y-3">
            {warnings.map((w, i) => (
              <div key={`w${i}`} className="flex items-start gap-2.5">
                <AlertTriangle className="h-3.5 w-3.5 text-[#F5A623] mt-0.5 shrink-0" />
                <p className="text-[13px] text-[var(--foreground)]/80 leading-relaxed">{w.text}</p>
              </div>
            ))}
            {successes.map((s, i) => (
              <div key={`s${i}`} className="flex items-start gap-2.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#52C67E] mt-0.5 shrink-0" />
                <p className="text-[13px] text-[var(--foreground)]/80 leading-relaxed">{s.text}</p>
              </div>
            ))}
            {infos.map((inf, i) => (
              <div key={`i${i}`} className="flex items-start gap-2.5">
                <Info className="h-3.5 w-3.5 text-[#4C8BF5] mt-0.5 shrink-0" />
                <p className="text-[13px] text-[var(--foreground)]/80 leading-relaxed">{inf.text}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
