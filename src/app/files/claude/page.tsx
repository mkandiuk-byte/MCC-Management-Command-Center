import { SidebarTrigger } from "@/components/ui/sidebar"
import { FileTree } from "@/components/file-tree"

export default function ClaudeFilesPage() {
  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-2 px-6 py-4 border-b shrink-0">
        <SidebarTrigger />
        <div>
          <h1 className="text-xl font-semibold">CLAUDE Workspace</h1>
          <p className="text-sm text-muted-foreground">{process.env.CLAUDE_PATH ?? ''}</p>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <FileTree
          rootPath={process.env.CLAUDE_PATH ?? ''}
          rootLabel="CLAUDE Workspace"
        />
      </div>
    </div>
  )
}
