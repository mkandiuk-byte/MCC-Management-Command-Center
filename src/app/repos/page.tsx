import { SidebarTrigger } from "@/components/ui/sidebar"
import { RepoGrid } from "@/components/repo-grid"

export default function ReposPage() {
  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-2 px-6 py-4 border-b shrink-0">
        <SidebarTrigger />
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Git Repositories</h1>
          <p className="text-sm text-muted-foreground">{process.env.WORKSPACE_PATH ?? ''}</p>
        </div>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <RepoGrid />
      </div>
    </div>
  )
}
