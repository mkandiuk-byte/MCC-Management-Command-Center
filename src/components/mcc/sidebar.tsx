"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useI18n, LanguageToggle } from "@/lib/mcc-i18n"
import {
  LayoutDashboard, TrendingUp, Code2, GitBranch, BarChart3,
  AlertTriangle, Settings, PanelLeftClose, PanelLeft, Moon, Sun,
} from "lucide-react"
import { useState, useEffect } from "react"

const nav = [
  { labelKey: "nav.summary" as const, href: "/", icon: LayoutDashboard },
  { labelKey: "nav.buying" as const, href: "/buying", icon: TrendingUp },
  { labelKey: "nav.engineering" as const, href: "/engineering", icon: Code2 },
  { labelKey: "nav.processes" as const, href: "/processes", icon: GitBranch },
  { labelKey: "nav.analytics" as const, href: "/analytics", icon: BarChart3 },
  { labelKey: "nav.problems" as const, href: "/problems", icon: AlertTriangle },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [dark, setDark] = useState(false)
  const { t } = useI18n()

  useEffect(() => {
    const saved = localStorage.getItem("mcc-theme")
    if (saved === "dark") { document.documentElement.classList.add("dark"); setDark(true) }
  }, [])

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("mcc-theme", next ? "dark" : "light")
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  return (
    <aside className={cn(
      "flex flex-col shrink-0 transition-all duration-500",
      collapsed ? "w-[60px]" : "w-[230px]"
    )}>
      {/* Logo */}
      <div className={cn("flex items-center h-[60px] px-4", collapsed && "justify-center px-2")}>
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-[#5B6BF5] via-[#8B6BF5] to-[#C084FC] flex items-center justify-center shadow-lg shadow-[rgba(91,107,245,0.3)] animate-float">
              <span className="text-[13px] font-bold text-white">M</span>
            </div>
            <span className="text-[16px] font-bold tracking-tight text-[var(--foreground)]">MCC</span>
          </div>
        ) : (
          <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-[#5B6BF5] via-[#8B6BF5] to-[#C084FC] flex items-center justify-center shadow-lg shadow-[rgba(91,107,245,0.3)] animate-float">
            <span className="text-[13px] font-bold text-white">M</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-0.5 px-3 py-4 overflow-y-auto scrollbar-thin">
        {nav.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[13px] font-medium transition-all duration-300 relative overflow-hidden",
                collapsed && "justify-center px-2",
                active
                  ? "bg-[var(--sidebar-accent)] text-[var(--accent)] shadow-sm shadow-[rgba(91,107,245,0.08)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-[var(--accent)] to-[var(--chart-3)]" />
              )}
              <item.icon className={cn(
                "shrink-0 transition-transform duration-300 group-hover:scale-110",
                collapsed ? "h-5 w-5" : "h-[18px] w-[18px]"
              )} />
              {!collapsed && <span>{t(item.labelKey)}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 space-y-0.5">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[13px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-all duration-300"
        >
          <Settings className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>{t("nav.settings")}</span>}
        </Link>

        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[13px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-all duration-300 w-full"
        >
          {dark ? <Sun className="h-[18px] w-[18px] shrink-0" /> : <Moon className="h-[18px] w-[18px] shrink-0" />}
          {!collapsed && <span>{dark ? t("nav.lightMode") : t("nav.darkMode")}</span>}
        </button>

        {!collapsed && (
          <div className="flex items-center justify-center py-1.5">
            <LanguageToggle />
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[13px] font-medium text-[var(--muted-foreground)] hover:text-[var(--secondary-foreground)] hover:bg-[var(--muted)] transition-all duration-300 w-full"
        >
          {collapsed ? <PanelLeft className="h-[18px] w-[18px] shrink-0" /> : <><PanelLeftClose className="h-[18px] w-[18px] shrink-0" /><span>{t("nav.collapse")}</span></>}
        </button>
      </div>
    </aside>
  )
}
