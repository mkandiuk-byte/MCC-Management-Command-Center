import { cn } from "@/lib/utils"

export type Signal = "OK" | "WATCH" | "STOP" | "NEW"

const config: Record<Signal, string> = {
  OK:    "bg-status-ok",
  WATCH: "bg-status-watch",
  STOP:  "bg-status-stop",
  NEW:   "bg-[var(--muted)] text-[var(--muted-foreground)]",
}

export function SignalBadge({ signal, className }: { signal: Signal; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
      config[signal],
      className
    )}>
      {signal}
    </span>
  )
}
