import { SidebarTrigger } from "@/components/ui/sidebar"
import { FileTree } from "@/components/file-tree"
import { CreateToolDialog } from "@/components/create-tool-dialog"

export default function ToolsPage() {
  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-2 px-6 py-4 border-b shrink-0">
        <SidebarTrigger />
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Claude Tools</h1>
          <p className="text-sm text-muted-foreground">/Desktop/CLAUDE/Tools/ — architecture patterns, ML, AI, data science</p>
        </div>
        <CreateToolDialog />
      </header>
      <div className="flex-1 overflow-hidden">
        <FileTree
          rootPath={`${process.env.CLAUDE_PATH ?? ''}/Tools`}
          rootLabel="Tools"
        />
      </div>
    </div>
  )
}
