import { cn } from "@/lib/utils"

type Status = "green" | "yellow" | "red" | "gray"

const styles: Record<Status, string> = {
  green: "bg-[var(--success)] shadow-[0_0_8px_var(--success-muted)]",
  yellow: "bg-[var(--warning)] shadow-[0_0_8px_var(--warning-muted)]",
  red: "bg-[var(--error)] shadow-[0_0_8px_var(--error-muted)]",
  gray: "bg-[var(--muted-foreground)]",
}

export function StatusDot({ status, size = "sm", pulse, className }: {
  status: Status
  size?: "sm" | "md"
  pulse?: boolean
  className?: string
}) {
  return (
    <span className={cn(
      "inline-block rounded-full shrink-0",
      size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5",
      pulse && "animate-pulse-ring",
      styles[status],
      className
    )} />
  )
}
