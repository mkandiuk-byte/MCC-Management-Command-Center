"use client"

import { Sidebar } from "./sidebar"
import { Particles } from "./particles"

function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute -top-[20%] -left-[10%] w-[700px] h-[700px] rounded-full bg-[rgba(170,150,255,0.3)] dark:bg-[rgba(91,107,245,0.08)] blur-[80px] animate-orb-1 animate-glow-pulse" />
      <div className="absolute -top-[10%] right-[0%] w-[600px] h-[600px] rounded-full bg-[rgba(150,200,255,0.28)] dark:bg-[rgba(108,123,245,0.06)] blur-[70px] animate-orb-2 animate-glow-pulse" style={{ animationDelay: "2s" }} />
      <div className="absolute bottom-[5%] left-[25%] w-[500px] h-[500px] rounded-full bg-[rgba(255,170,220,0.2)] dark:bg-[rgba(168,126,245,0.05)] blur-[60px] animate-orb-1 animate-glow-pulse" style={{ animationDelay: "4s" }} />
      <div className="absolute top-[35%] right-[10%] w-[400px] h-[400px] rounded-full bg-[rgba(150,230,255,0.15)] dark:bg-[rgba(82,198,126,0.04)] blur-[50px] animate-orb-2" style={{ animationDelay: "6s" }} />
    </div>
  )
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-mesh-gradient relative">
      {/* Orbs and particles span the ENTIRE viewport — sidebar + content = one canvas */}
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
