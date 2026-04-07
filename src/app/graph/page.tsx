"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { ChainGraph } from "@/components/graph/chain-graph"
import { Link2 } from "lucide-react"

export default function GraphPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-6 py-4 border-b shrink-0">
        <SidebarTrigger />
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Campaign Graph</h1>
          <p className="text-sm text-muted-foreground">
            ad_campaign_id → campaign_id / cloak_id → offer_id
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
          <Link2 className="h-3.5 w-3.5" />
          ID Chain
        </div>
      </header>
      <div className="flex-1 p-6 overflow-hidden min-h-0">
        <ChainGraph />
      </div>
    </div>
  )
}
