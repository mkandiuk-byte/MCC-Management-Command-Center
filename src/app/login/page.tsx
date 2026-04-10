"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Lock } from "lucide-react"

export default function LoginPage() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(false)

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push("/")
      router.refresh()
    } else {
      setError(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-mesh-gradient relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[700px] h-[700px] rounded-full bg-[rgba(170,150,255,0.3)] dark:bg-[rgba(91,107,245,0.08)] blur-[80px] animate-orb-1" />
        <div className="absolute -top-[10%] right-[0%] w-[600px] h-[600px] rounded-full bg-[rgba(150,200,255,0.28)] dark:bg-[rgba(108,123,245,0.06)] blur-[70px] animate-orb-2" />
      </div>

      <Card className="w-full max-w-[380px] mx-4 relative z-10">
        <CardContent className="p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#5B6BF5] via-[#8B6BF5] to-[#C084FC] flex items-center justify-center shadow-lg shadow-[rgba(91,107,245,0.3)] mb-4">
              <span className="text-[18px] font-bold text-white">M</span>
            </div>
            <h1 className="text-[20px] font-bold text-[var(--foreground)]">MCC</h1>
            <p className="text-[13px] text-[var(--muted-foreground)] mt-1">Management Command Center</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
              <Input
                type="password"
                placeholder="Access password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-11 bg-[var(--muted)] border-[var(--border)]"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-[12px] text-[var(--error)] text-center">
                Invalid password
              </p>
            )}

            <Button
              type="submit"
              disabled={loading || !password}
              className="w-full h-11 bg-gradient-to-r from-[#5B6BF5] to-[#8B6BF5] text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
            >
              {loading ? "..." : "Enter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
