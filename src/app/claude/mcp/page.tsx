import { SidebarTrigger } from "@/components/ui/sidebar"
import { McpServersList } from "@/components/mcp-servers-list"

export default function McpPage() {
  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-2 px-6 py-4 border-b shrink-0">
        <SidebarTrigger />
        <div>
          <h1 className="text-xl font-semibold">MCP Servers</h1>
          <p className="text-sm text-muted-foreground">User · Project · Cloud connectors</p>
        </div>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <McpServersList />
      </div>
    </div>
  )
}
