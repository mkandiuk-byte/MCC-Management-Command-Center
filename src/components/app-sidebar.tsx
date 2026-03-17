"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  FolderCode, Brain, Home, Settings,
  Wrench, BookOpen, Layers, Terminal, SquareTerminal, Search, GitFork, Kanban
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"

const navItems = [
  {
    group: "Overview",
    items: [
      { title: "Dashboard", href: "/", icon: Home },
    ]
  },
  {
    group: "Project Management",
    items: [
      { title: "Jira Boards", href: "/jira", icon: Kanban },
    ]
  },
  {
    group: "File Explorer",
    items: [
      { title: "Workspace", href: "/files/upstars", icon: FolderCode },
      { title: "CLAUDE Workspace", href: "/files/claude", icon: Brain },
      { title: "Search", href: "/search", icon: Search },
      { title: "Repositories", href: "/repos", icon: GitFork },
    ]
  },
  {
    group: "Claude Config",
    items: [
      { title: "Skills", href: "/claude/skills", icon: Layers },
      { title: "Tools", href: "/claude/tools", icon: Wrench },
      { title: "Instructions", href: "/claude/instructions", icon: BookOpen },
      { title: "MCP Servers", href: "/claude/mcp", icon: Terminal },
      { title: "Claude Terminal", href: "/claude/terminal", icon: SquareTerminal },
    ]
  },
  {
    group: "System",
    items: [
      { title: "Settings", href: "/settings", icon: Settings },
    ]
  }
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <SidebarTrigger />
          <span className="font-semibold text-sm group-data-[collapsible=icon]:hidden">
            AAP Panel
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {navItems.map((section) => (
          <SidebarGroup key={section.group}>
            <SidebarGroupLabel>{section.group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={pathname === item.href}
                      tooltip={item.title}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between px-2 py-2">
          <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            AAP Panel
          </span>
          <div className="flex items-center gap-1">
            <ThemeToggle />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
