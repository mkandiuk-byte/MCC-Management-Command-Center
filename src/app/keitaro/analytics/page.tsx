import { SidebarTrigger } from "@/components/ui/sidebar"
import { KeitaroAnalytics } from "@/components/keitaro-analytics"
import { ConversionQuality } from "@/components/conversion-quality"

export default function KeitaroAnalyticsPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-2 px-6 py-4 border-b shrink-0">
        <SidebarTrigger />
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Traffic Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Воронка · Гео · Девайси · Sub_id розрізи · Conversion Quality
          </p>
        </div>
      </header>
      <div className="flex-1 p-6 overflow-auto flex flex-col gap-10">
        <KeitaroAnalytics />
        <div className="border-t border-border/50 pt-8">
          <ConversionQuality />
        </div>
      </div>
    </div>
  )
}
