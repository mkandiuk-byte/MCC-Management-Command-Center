import { SidebarTrigger } from "@/components/ui/sidebar"
import { LogViewer } from "@/components/log-viewer"

export default function LogsPage() {
  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-2 px-6 py-4 border-b shrink-0">
        <SidebarTrigger />
        <div>
          <h1 className="text-xl font-semibold">Logs</h1>
          <p className="text-sm text-muted-foreground">Sync, panel, and service logs</p>
        </div>
      </header>
      <div className="flex-1 overflow-hidden p-4">
        <LogViewer />
      </div>
    </div>
  )
}
