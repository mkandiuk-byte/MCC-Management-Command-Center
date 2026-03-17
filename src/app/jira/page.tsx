import { SidebarTrigger } from "@/components/ui/sidebar"
import { JiraDashboard } from "@/components/jira-dashboard"

export default function JiraPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-2 px-6 py-4 border-b shrink-0">
        <SidebarTrigger />
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Jira Boards</h1>
          <p className="text-sm text-muted-foreground">Team task tracker</p>
        </div>
      </header>
      <div className="flex-1 p-6 overflow-auto">
        <JiraDashboard />
      </div>
    </div>
  )
}
