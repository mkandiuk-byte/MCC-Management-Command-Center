import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { FolderCode, Brain, Layers, Wrench, BookOpen, Terminal, GitFork } from "lucide-react"
import Link from "next/link"
import { DashboardStats } from "@/components/dashboard-stats"
import { JiraDashboardStats } from "@/components/jira-dashboard-stats"

const quickLinks = [
  {
    title: "Workspace",
    description: "Browse workspace files and project directories",
    href: "/files/upstars",
    icon: FolderCode,
    badge: "repos",
    color: "text-blue-400"
  },
  {
    title: "CLAUDE Workspace",
    description: "Skills, Tools, Instructions, MCP configs",
    href: "/files/claude",
    icon: Brain,
    badge: "Config",
    color: "text-purple-400"
  },
  {
    title: "Skills",
    description: "30+ Claude skills: infra, data, security, etc.",
    href: "/claude/skills",
    icon: Layers,
    badge: "30+ skills",
    color: "text-green-400"
  },
  {
    title: "Tools",
    description: "Architecture patterns, ML, AI, data science refs",
    href: "/claude/tools",
    icon: Wrench,
    badge: "Tools",
    color: "text-orange-400"
  },
  {
    title: "Instructions",
    description: "Root instructions and Graphiti config",
    href: "/claude/instructions",
    icon: BookOpen,
    badge: "Docs",
    color: "text-yellow-400"
  },
  {
    title: "MCP Servers",
    description: "Context7, Graphiti, n8n, GitHub, Atlassian, Figma",
    href: "/claude/mcp",
    icon: Terminal,
    badge: "MCP",
    color: "text-red-400"
  },
  {
    title: "Repositories",
    description: "Git repos: status, clone, pull, manage scan dirs",
    href: "/repos",
    icon: GitFork,
    badge: "Git",
    color: "text-cyan-400"
  },
]

export default function HomePage() {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-2 px-6 py-4 border-b">
        <SidebarTrigger />
        <div className="flex-1">
          <h1 className="text-xl font-semibold">AAP Panel</h1>
          <p className="text-sm text-muted-foreground">Admin Panel & Claude Workspace</p>
        </div>
        <kbd className="hidden sm:flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span>⌘</span>K
        </kbd>
      </header>
      <div className="flex-1 p-6">
        <DashboardStats />
        <JiraDashboardStats />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <item.icon className={`h-6 w-6 ${item.color}`} />
                    <Badge variant="secondary" className="text-xs">
                      {item.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-base mt-2">{item.title}</CardTitle>
                  <CardDescription className="text-sm">{item.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
