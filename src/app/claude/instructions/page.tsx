import { SidebarTrigger } from "@/components/ui/sidebar"
import { FileTree } from "@/components/file-tree"
import { CreateInstructionDialog } from "@/components/create-instruction-dialog"

export default function InstructionsPage() {
  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-2 px-6 py-4 border-b shrink-0">
        <SidebarTrigger />
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Instructions</h1>
          <p className="text-sm text-muted-foreground">/Desktop/CLAUDE/Instructions/</p>
        </div>
        <CreateInstructionDialog />
      </header>
      <div className="flex-1 overflow-hidden">
        <FileTree
          rootPath={`${process.env.CLAUDE_PATH ?? ''}/Instructions`}
          rootLabel="Instructions"
        />
      </div>
    </div>
  )
}
