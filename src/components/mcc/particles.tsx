"use client"

import { useEffect, useRef, useState } from "react"

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  hue: number
}

export function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const speedRef = useRef<"calm" | "alert" | "urgent">("calm")

  /* Observe body[data-health] to derive speed */
  useEffect(() => {
    const map: Record<string, "calm" | "alert" | "urgent"> = {
      healthy: "calm",
      warning: "alert",
      critical: "urgent",
    }
    const sync = () => {
      const h = document.body.dataset.health || "healthy"
      speedRef.current = map[h] || "calm"
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-health"] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    /* Respect prefers-reduced-motion */
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    let reducedMotion = motionQuery.matches
    const onMotionChange = (e: MediaQueryListEvent) => { reducedMotion = e.matches }
    motionQuery.addEventListener("change", onMotionChange)

    let animId: number
    let particles: Particle[] = []
    const isDark = () => document.documentElement.classList.contains("dark")

    const velocityFor = (speed: "calm" | "alert" | "urgent") => {
      if (speed === "urgent") return 0.9
      if (speed === "alert") return 0.6
      return 0.4
    }

    const connectionDistFor = (speed: "calm" | "alert" | "urgent") => {
      if (speed === "urgent") return 180
      return 150
    }

    const countMultiplier = (speed: "calm" | "alert" | "urgent") => {
      if (speed === "urgent") return 1.3
      if (speed === "alert") return 1.15
      return 1
    }

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }

    const init = () => {
      resize()
      const baseCount = Math.floor((canvas.offsetWidth * canvas.offsetHeight) / 12000)
      const count = Math.min(Math.floor(baseCount * countMultiplier(speedRef.current)), 100)
      const vel = velocityFor(speedRef.current)
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        vx: (Math.random() - 0.5) * vel,
        vy: (Math.random() - 0.5) * vel,
        size: Math.random() * 3 + 1,
        opacity: Math.random() * 0.4 + 0.1,
        hue: 220 + Math.random() * 80,
      }))
    }

    const draw = () => {
      if (reducedMotion) {
        /* Static fallback: draw once and stop */
        drawFrame()
        return
      }
      drawFrame()
      animId = requestAnimationFrame(draw)
    }

    const drawFrame = () => {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      ctx.clearRect(0, 0, w, h)

      const dark = isDark()
      const speed = speedRef.current
      const vel = velocityFor(speed)
      const connDist = connectionDistFor(speed)

      for (const p of particles) {
        /* Smoothly adjust velocity toward target */
        const targetVx = Math.sign(p.vx) * vel * (Math.abs(p.vx) / (vel || 0.4))
        p.vx += (targetVx - p.vx) * 0.01
        p.vy += ((Math.sign(p.vy) * vel * (Math.abs(p.vy) / (vel || 0.4))) - p.vy) * 0.01

        p.x += p.vx
        p.y += p.vy

        if (p.x < 0) p.x = w
        if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h
        if (p.y > h) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = dark
          ? `hsla(${p.hue}, 60%, 70%, ${p.opacity})`
          : `hsla(${p.hue}, 50%, 55%, ${p.opacity * 0.7})`
        ctx.fill()
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < connDist) {
            const alpha = (1 - dist / connDist) * 0.12
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = dark
              ? `rgba(108, 123, 245, ${alpha})`
              : `rgba(91, 107, 245, ${alpha * 0.6})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }
    }

    init()
    draw()

    const onResize = () => { resize(); init() }
    window.addEventListener("resize", onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", onResize)
      motionQuery.removeEventListener("change", onMotionChange)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      style={{ opacity: 0.8 }}
    />
  )
}
