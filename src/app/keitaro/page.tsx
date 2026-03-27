import { SidebarTrigger } from "@/components/ui/sidebar"
import { KeitaroDashboard } from "@/components/keitaro-dashboard"

export default function KeitaroPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-2 px-6 py-4 border-b shrink-0">
        <SidebarTrigger />
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Keitaro Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Аналитика трафика · CPA цель $200 · Окупаемость 3–4 мес.
          </p>
        </div>
      </header>
      <div className="flex-1 p-6 overflow-auto">
        <KeitaroDashboard />
      </div>
    </div>
  )
}
