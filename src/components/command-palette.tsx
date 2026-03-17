"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Home, FolderCode, Brain, Layers, Wrench,
  BookOpen, Terminal, Settings, ExternalLink
} from "lucide-react"

const ROUTES = [
  { id: "home", label: "Dashboard", href: "/", icon: Home, group: "Navigation" },
  { id: "workspace", label: "Workspace", href: "/files/upstars", icon: FolderCode, group: "File Explorer" },
  { id: "claude-files", label: "CLAUDE Workspace", href: "/files/claude", icon: Brain, group: "File Explorer" },
  { id: "skills", label: "Claude Skills", href: "/claude/skills", icon: Layers, group: "Claude Config" },
  { id: "tools", label: "Claude Tools", href: "/claude/tools", icon: Wrench, group: "Claude Config" },
  { id: "instructions", label: "Instructions", href: "/claude/instructions", icon: BookOpen, group: "Claude Config" },
  { id: "mcp", label: "MCP Servers", href: "/claude/mcp", icon: Terminal, group: "Claude Config" },
  { id: "repos", label: "Git Repositories", href: "/repos", icon: FolderCode, group: "Navigation" },
  { id: "logs", label: "Sync Logs", href: "/logs", icon: Terminal, group: "Navigation" },
  { id: "settings", label: "Settings", href: "/settings", icon: Settings, group: "System" },
]

const QUICK_ACTIONS = [
  {
    id: "open-vscode-workspace",
    label: "Open Workspace in VS Code",
    icon: ExternalLink,
    action: () => {
      fetch('/api/actions/open-vscode', { method: 'POST' })
    }
  },
  {
    id: "open-vscode-claude",
    label: "Open CLAUDE in VS Code",
    icon: ExternalLink,
    action: () => {
      fetch('/api/actions/open-vscode?path=claude', { method: 'POST' })
    }
  },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const navigate = useCallback((href: string) => {
    router.push(href)
    setOpen(false)
  }, [router])

  const groups = Array.from(new Set(ROUTES.map(r => r.group)))

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, repos, skills..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {groups.map(group => (
          <CommandGroup key={group} heading={group}>
            {ROUTES.filter(r => r.group === group).map(route => (
              <CommandItem
                key={route.id}
                value={route.label}
                onSelect={() => navigate(route.href)}
              >
                <route.icon className="mr-2 h-4 w-4" />
                {route.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Quick Actions">
          {QUICK_ACTIONS.map(action => (
            <CommandItem
              key={action.id}
              value={action.label}
              onSelect={() => { action.action(); setOpen(false) }}
            >
              <action.icon className="mr-2 h-4 w-4" />
              {action.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
