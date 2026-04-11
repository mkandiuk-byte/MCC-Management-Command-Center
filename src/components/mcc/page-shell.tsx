"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "./sidebar"
import { Particles } from "./particles"

/* ── Orb color palettes by health status ─────────────────────── */
const orbPalettes = {
  healthy: {
    light: [
      { bg: "oklch(0.82 0.1 285 / 0.28)" },    // lavender
      { bg: "oklch(0.85 0.08 240 / 0.25)" },    // pale blue
      { bg: "oklch(0.88 0.08 340 / 0.18)" },    // soft pink
      { bg: "oklch(0.87 0.06 230 / 0.12)" },    // subtle cyan
    ],
    dark: [
      { bg: "oklch(0.3 0.1 275 / 0.08)" },
      { bg: "oklch(0.3 0.08 275 / 0.06)" },
      { bg: "oklch(0.3 0.1 300 / 0.05)" },
      { bg: "oklch(0.3 0.08 155 / 0.04)" },
    ],
  },
  warning: {
    light: [
      { bg: "oklch(0.82 0.1 85 / 0.28)" },      // warm amber
      { bg: "oklch(0.85 0.08 80 / 0.25)" },      // soft gold
      { bg: "oklch(0.88 0.08 90 / 0.18)" },      // pale amber
      { bg: "oklch(0.87 0.06 75 / 0.12)" },      // subtle honey
    ],
    dark: [
      { bg: "oklch(0.3 0.1 85 / 0.08)" },
      { bg: "oklch(0.3 0.08 80 / 0.06)" },
      { bg: "oklch(0.3 0.1 90 / 0.05)" },
      { bg: "oklch(0.3 0.08 75 / 0.04)" },
    ],
  },
  critical: {
    light: [
      { bg: "oklch(0.82 0.1 20 / 0.28)" },      // soft rose
      { bg: "oklch(0.85 0.08 15 / 0.25)" },      // pale coral
      { bg: "oklch(0.88 0.08 25 / 0.18)" },      // warm pink
      { bg: "oklch(0.87 0.06 18 / 0.12)" },      // subtle rose
    ],
    dark: [
      { bg: "oklch(0.3 0.1 20 / 0.08)" },
      { bg: "oklch(0.3 0.08 15 / 0.06)" },
      { bg: "oklch(0.3 0.1 25 / 0.05)" },
      { bg: "oklch(0.3 0.08 18 / 0.04)" },
    ],
  },
} as const

type HealthStatus = "healthy" | "warning" | "critical"

function FloatingOrbs() {
  const [health, setHealth] = useState<HealthStatus>("healthy")

  useEffect(() => {
    const sync = () => {
      const h = document.body.dataset.health as HealthStatus | undefined
      setHealth(h || "healthy")
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-health"] })
    return () => observer.disconnect()
  }, [])

  const palette = orbPalettes[health] || orbPalettes.healthy

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Orb 1 — top left */}
      <div
        className="absolute -top-[20%] -left-[10%] w-[700px] h-[700px] rounded-full blur-[80px] animate-orb-1 animate-glow-pulse dark:hidden"
        style={{ background: palette.light[0].bg, transition: "background 3s ease" }}
      />
      <div
        className="absolute -top-[20%] -left-[10%] w-[700px] h-[700px] rounded-full blur-[80px] animate-orb-1 animate-glow-pulse dark:block hidden"
        style={{ background: palette.dark[0].bg, transition: "background 3s ease" }}
      />

      {/* Orb 2 — top right */}
      <div
        className="absolute -top-[10%] right-[0%] w-[600px] h-[600px] rounded-full blur-[70px] animate-orb-2 animate-glow-pulse dark:hidden"
        style={{ background: palette.light[1].bg, animationDelay: "2s", transition: "background 3s ease" }}
      />
      <div
        className="absolute -top-[10%] right-[0%] w-[600px] h-[600px] rounded-full blur-[70px] animate-orb-2 animate-glow-pulse hidden dark:block"
        style={{ background: palette.dark[1].bg, animationDelay: "2s", transition: "background 3s ease" }}
      />

      {/* Orb 3 — bottom center */}
      <div
        className="absolute bottom-[5%] left-[25%] w-[500px] h-[500px] rounded-full blur-[60px] animate-orb-1 animate-glow-pulse dark:hidden"
        style={{ background: palette.light[2].bg, animationDelay: "4s", transition: "background 3s ease" }}
      />
      <div
        className="absolute bottom-[5%] left-[25%] w-[500px] h-[500px] rounded-full blur-[60px] animate-orb-1 animate-glow-pulse hidden dark:block"
        style={{ background: palette.dark[2].bg, animationDelay: "4s", transition: "background 3s ease" }}
      />

      {/* Orb 4 — mid right */}
      <div
        className="absolute top-[35%] right-[10%] w-[400px] h-[400px] rounded-full blur-[50px] animate-orb-2 dark:hidden"
        style={{ background: palette.light[3].bg, animationDelay: "6s", transition: "background 3s ease" }}
      />
      <div
        className="absolute top-[35%] right-[10%] w-[400px] h-[400px] rounded-full blur-[50px] animate-orb-2 hidden dark:block"
        style={{ background: palette.dark[3].bg, animationDelay: "6s", transition: "background 3s ease" }}
      />
    </div>
  )
}

export function PageShell({ children, healthStatus = "healthy" }: { children: React.ReactNode; healthStatus?: HealthStatus }) {
  return (
    <div className="flex h-screen overflow-hidden bg-mesh-gradient relative" style={{ fontFamily: "'Satoshi', ui-sans-serif, system-ui, sans-serif" }}>
      {/* Orbs and particles span the ENTIRE viewport */}
      <FloatingOrbs />
      <Particles />

      {/* Sidebar sits ON TOP of the canvas, transparent */}
      <div className="relative z-10">
        <Sidebar />
      </div>

      {/* Content also sits on top */}
      <main className="flex-1 overflow-y-auto scrollbar-thin relative z-10">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-10 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
