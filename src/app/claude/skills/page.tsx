import { SidebarTrigger } from "@/components/ui/sidebar"
import { SkillsList } from "@/components/skills-list"

export default function SkillsPage() {
  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-2 px-6 py-4 border-b shrink-0">
        <SidebarTrigger />
        <div>
          <h1 className="text-xl font-semibold">Claude Skills</h1>
          <p className="text-sm text-muted-foreground">Available skills in the CLAUDE Skills directory</p>
        </div>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <SkillsList />
      </div>
    </div>
  )
}
