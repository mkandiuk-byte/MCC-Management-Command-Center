"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, CheckCircle2, XCircle, AlertTriangle, HelpCircle, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { KeitaroDashboardResponse } from "@aap/types"

function fmt$(v: number) {
  if (v === 0) return "$0"
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`
  return `$${v.toFixed(0)}`
}

function StatPill({
  icon: Icon,
  label,
  value,
  cls,
}: {
  icon: React.ElementType
  label: string
  value: number
  cls: string
}) {
  if (value === 0) return null
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border ${cls}`}>
      <Icon className="h-3 w-3" />
      <span className="font-bold">{value}</span>
      <span className="opacity-80">{label}</span>
    </span>
  )
}

export function KeitaroDashboardStats() {
  const [data, setData] = useState<KeitaroDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  const load = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    fetch("/api/keitaro/campaigns")
      .then((r) => r.json())
      .then((d: KeitaroDashboardResponse) => setData(d))
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false) })
  }

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Keitaro Campaigns</span>
        </div>
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!data || data.error || !data.summary.total) return null

  const { summary } = data

  // Aggregate financials
  const totalCost = data.campaigns.reduce((s, c) => s + c.stats.cost, 0)
  const totalRevenue = data.campaigns.reduce((s, c) => s + c.stats.revenue, 0)
  const totalProfit = data.campaigns.reduce((s, c) => s + c.stats.profit, 0)

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Keitaro Campaigns</span>
        <span className="text-xs text-muted-foreground">
          {summary.total} total · {summary.active} active
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <Link href="/keitaro" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            View all →
          </Link>
        </div>
      </div>

      <div
        className="rounded-lg border border-border/60 bg-card/40 px-4 py-3 space-y-3 cursor-pointer hover:border-border hover:bg-card/60 transition-colors"
        onClick={() => router.push("/keitaro")}
      >
        {/* Status pills */}
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border border-border/50 text-muted-foreground">
            <span className="font-bold text-foreground">{summary.total}</span>
            <span>total</span>
          </span>
          <StatPill icon={CheckCircle2} label="success"  value={summary.success}  cls="bg-green-400/10 text-green-300  border-green-400/25" />
          <StatPill icon={AlertTriangle} label="decision" value={summary.decision} cls="bg-amber-400/10 text-amber-300  border-amber-400/25" />
          <StatPill icon={XCircle}      label="failed"   value={summary.failed}   cls="bg-red-400/10   text-red-300    border-red-400/25" />
          <StatPill icon={HelpCircle}   label="no data"  value={summary.no_data}  cls="bg-zinc-400/10  text-zinc-300   border-zinc-400/25" />
        </div>

        {/* Financial summary */}
        {totalCost > 0 && (
          <div className="flex flex-wrap gap-3 text-[11px] border-t border-border/30 pt-2">
            <span className="text-muted-foreground">
              Spend: <b className="text-foreground">{fmt$(totalCost)}</b>
            </span>
            <span className="text-muted-foreground">
              Revenue: <b className="text-foreground">{fmt$(totalRevenue)}</b>
            </span>
            <span className="text-muted-foreground">
              Profit:{" "}
              <b className={totalProfit >= 0 ? "text-green-400" : "text-red-400"}>
                {fmt$(totalProfit)}
              </b>
            </span>
            <span className="text-muted-foreground text-[10px]">· 90 days</span>
          </div>
        )}
      </div>
    </div>
  )
}
