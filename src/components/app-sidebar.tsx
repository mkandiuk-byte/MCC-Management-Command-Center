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
  Wrench, BookOpen, Layers, Terminal, SquareTerminal, Search, GitFork, Kanban, Map, TrendingUp,
  Activity, Network, BarChart2
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useLanguage, type TranslationKey } from "@/lib/i18n"

const navItems: {
  groupKey: TranslationKey
  items: { titleKey: TranslationKey; href: string; icon: React.ElementType }[]
}[] = [
  {
    groupKey: "nav.overview",
    items: [
      { titleKey: "nav.main", href: "/", icon: Home },
    ],
  },
  {
    groupKey: "nav.project_management",
    items: [
      { titleKey: "nav.jira_boards", href: "/jira", icon: Kanban },
      { titleKey: "nav.keitaro", href: "/keitaro", icon: TrendingUp },
      { titleKey: "nav.traffic_analytics", href: "/keitaro/analytics", icon: BarChart2 },
    ],
  },
  {
    groupKey: "nav.analytics",
    items: [
      { titleKey: "nav.ad_performance", href: "/ad-performance", icon: Activity },
      { titleKey: "nav.graph", href: "/graph", icon: Network },
    ],
  },
  {
    groupKey: "nav.file_explorer",
    items: [
      { titleKey: "nav.upstars", href: "/files/upstars", icon: FolderCode },
      { titleKey: "nav.claude_workspace", href: "/files/claude", icon: Brain },
      { titleKey: "nav.search", href: "/search", icon: Search },
      { titleKey: "nav.repositories", href: "/repos", icon: GitFork },
      { titleKey: "nav.service_map", href: "/repos/map", icon: Map },
    ],
  },
  {
    groupKey: "nav.claude_config",
    items: [
      { titleKey: "nav.skills", href: "/claude/skills", icon: Layers },
      { titleKey: "nav.tools", href: "/claude/tools", icon: Wrench },
      { titleKey: "nav.instructions", href: "/claude/instructions", icon: BookOpen },
      { titleKey: "nav.mcp_servers", href: "/claude/mcp", icon: Terminal },
      { titleKey: "nav.claude_terminal", href: "/claude/terminal", icon: SquareTerminal },
    ],
  },
  {
    groupKey: "nav.system",
    items: [
      { titleKey: "nav.settings", href: "/settings", icon: Settings },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { t } = useLanguage()

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
          <SidebarGroup key={section.groupKey}>
            <SidebarGroupLabel>{t(section.groupKey)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={pathname === item.href}
                      tooltip={t(item.titleKey)}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{t(item.titleKey)}</span>
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
          <div className="flex items-center gap-1.5 group-data-[collapsible=icon]:hidden">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
