"use client"

import { useEffect, useState, useCallback } from "react"
import { PageHeader } from "@/components/mcc/page-header"
import { ScoreBox } from "@/components/mcc/score-box"
import { StatusDot } from "@/components/mcc/status-dot"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronDown, ChevronUp, Send, Clock, User, FileText } from "lucide-react"
import { useI18n } from "@/lib/mcc-i18n"

/* -- Types --------------------------------------------------------- */

interface Problem {
  id: string
  category: string
  title: string
  description: string
  severity: string
  status: string
  owner: string
  hypothesis: string
  metric_name: string
  baseline_value: number | null
  current_value: number | null
  created_at: string
  updated_at: string
  testCount?: number
  positiveTests?: number
  negativeTests?: number
  totalUpdates?: number
}

interface ProblemUpdate {
  id: string
  problem_id: string
  update_type: string
  content: string
  outcome: string
  metric_value: number | null
  author: string
  created_at: string
}

/* -- Constants ----------------------------------------------------- */

const categories = [
  "cloaking",
  "white_pages",
  "account_health",
  "ios",
  "event_streaming",
  "funnel_migration",
] as const

type Category = (typeof categories)[number]

const categoryLabels: Record<Category, { uk: string; en: string }> = {
  cloaking: { uk: "Клоакінг", en: "Cloaking" },
  white_pages: { uk: "Вайт-пейджі", en: "White Pages" },
  account_health: { uk: "Здоров'я акаунтів", en: "Account Health" },
  ios: { uk: "iOS", en: "iOS" },
  event_streaming: { uk: "Стрімінг подій", en: "Event Streaming" },
  funnel_migration: { uk: "Міграція воронок", en: "Funnel Migration" },
}

const categoryStyles: Record<Category, string> = {
  cloaking: "bg-[var(--info-muted)] text-[var(--chart-3)]",
  white_pages: "bg-[var(--info-muted)] text-[var(--accent)]",
  account_health: "bg-[var(--error-muted)] text-[var(--error)]",
  ios: "bg-[var(--success-muted)] text-[var(--success)]",
  event_streaming: "bg-[var(--warning-muted)] text-[var(--warning)]",
  funnel_migration: "bg-[rgba(76,200,220,0.12)] text-[#4CC8DC]",
}

const statusStyles: Record<string, string> = {
  investigating: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  testing: "bg-[var(--warning-muted)] text-[var(--warning)]",
  measuring: "bg-[var(--info-muted)] text-[var(--accent)]",
  resolved: "bg-[var(--success-muted)] text-[var(--success)]",
}

const severityDot: Record<string, "red" | "yellow" | "green" | "gray"> = {
  critical: "red",
  high: "yellow",
  medium: "green",
  low: "gray",
}

/* -- Helpers ------------------------------------------------------- */

function fmtDate(iso: string): string {
  if (!iso) return "--"
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtRelative(iso: string): string {
  if (!iso) return "--"
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "today"
  if (days === 1) return "1 day ago"
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

/* -- Expanded Row -------------------------------------------------- */

function ProblemDetail({ problem }: { problem: Problem }) {
  const { t } = useI18n()
  const [updates, setUpdates] = useState<ProblemUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState("")
  const [updateType, setUpdateType] = useState("observation")
  const [outcome, setOutcome] = useState("")
  const [metricValue, setMetricValue] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [statusVal, setStatusVal] = useState(problem.status)
  const [patching, setPatching] = useState(false)

  const loadUpdates = useCallback(() => {
    setLoading(true)
    fetch(`/api/mcc/problems/${problem.id}`)
      .then((r) => r.json())
      .then((d) => setUpdates(d.updates ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [problem.id])

  useEffect(() => {
    loadUpdates()
  }, [loadUpdates])

  const handleSubmitUpdate = async () => {
    if (!content.trim()) return
    setSubmitting(true)
    try {
      await fetch(`/api/mcc/problems/${problem.id}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          update_type: updateType,
          outcome: outcome || null,
          metric_value: metricValue ? parseFloat(metricValue) : null,
          author: "dashboard_user",
        }),
      })
      setContent("")
      setOutcome("")
      setMetricValue("")
      loadUpdates()
    } catch {
      // silently fail
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    setPatching(true)
    try {
      await fetch(`/api/mcc/problems/${problem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      setStatusVal(newStatus)
    } catch {
      // silently fail
    } finally {
      setPatching(false)
    }
  }

  return (
    <div className="px-5 pb-5 space-y-5">
      {/* Description */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] mb-1">{t("problems.description")}</p>
        <p className="text-[13px] text-[var(--secondary-foreground)] leading-relaxed">{problem.description || "--"}</p>
      </div>

      {/* Hypothesis */}
      {problem.hypothesis && (
        <Card className="border-l-[3px] border-l-[var(--chart-3)] bg-[var(--info-muted)]">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-[var(--chart-3)] mb-1">{t("problems.hypothesis")}</p>
            <p className="text-[13px] text-[var(--secondary-foreground)] leading-relaxed">{problem.hypothesis}</p>
          </CardContent>
        </Card>
      )}

      {/* Metrics */}
      {problem.metric_name && (
        <div className="flex items-center gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] mb-1">{t("problems.metric")}</p>
            <p className="text-[13px] font-medium text-[var(--foreground)]">{problem.metric_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-center">
              <p className="text-[11px] text-[var(--muted-foreground)]">{t("problems.baseline")}</p>
              <p className="text-[14px] font-semibold text-[var(--foreground)]">
                {problem.baseline_value ?? "--"}
              </p>
            </div>
            <span className="text-[var(--muted-foreground)] text-[16px]">&rarr;</span>
            <div className="text-center">
              <p className="text-[11px] text-[var(--muted-foreground)]">{t("problems.current")}</p>
              <p className="text-[14px] font-semibold text-[var(--accent)]">
                {problem.current_value ?? "--"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status change */}
      <div className="flex items-center gap-3">
        <Label className="text-[12px] text-[var(--muted-foreground)]">{t("problems.status")}</Label>
        <Select value={statusVal} onValueChange={(v) => handleStatusChange(v ?? statusVal)} disabled={patching}>
          <SelectTrigger className="w-[180px] h-8 bg-[var(--card)] border-[var(--input)] text-[13px] text-[var(--foreground)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[var(--popover)] border-[var(--input)]">
            <SelectItem value="investigating">{t("summary.investigating")}</SelectItem>
            <SelectItem value="testing">{t("summary.testing")}</SelectItem>
            <SelectItem value="measuring">Measuring</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Updates timeline */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] mb-3">{t("problems.updates")}</p>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-[var(--muted)] animate-pulse" />
            ))}
          </div>
        ) : updates.length === 0 ? (
          <p className="text-[12px] text-[var(--muted-foreground)]">{t("problems.noUpdates")}</p>
        ) : (
          <div className="space-y-3 border-l-2 border-[var(--border)] pl-4">
            {updates.map((u) => (
              <div key={u.id} className="relative">
                <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[var(--accent)] border-2 border-[var(--card)]" />
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-semibold text-[var(--foreground)] capitalize">
                    {u.update_type.replace(/_/g, " ")}
                  </span>
                  <span className="text-[11px] text-[var(--muted-foreground)]">{fmtRelative(u.created_at)}</span>
                  {u.author && (
                    <span className="text-[11px] text-[var(--muted-foreground)] flex items-center gap-1">
                      <User className="h-3 w-3" /> {u.author}
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-[var(--secondary-foreground)]">{u.content}</p>
                {u.outcome && (
                  <p className="text-[12px] text-[var(--warning)] mt-0.5">{t("problems.outcome")}: {u.outcome}</p>
                )}
                {u.metric_value != null && (
                  <p className="text-[12px] text-[var(--accent)] mt-0.5">{t("problems.metric")}: {u.metric_value}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Test Result form */}
      <Card className="bg-[var(--muted)]">
        <CardContent className="p-4 space-y-3">
          <p className="text-[12px] font-semibold text-[var(--foreground)]">{t("problems.logTestResult")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px] text-[var(--muted-foreground)]">{t("problems.type")}</Label>
              <Select value={updateType} onValueChange={(v) => setUpdateType(v ?? "observation")}>
                <SelectTrigger className="h-8 bg-[var(--card)] border-[var(--input)] text-[13px] text-[var(--foreground)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--popover)] border-[var(--input)]">
                  <SelectItem value="observation">Observation</SelectItem>
                  <SelectItem value="test_result">Test Result</SelectItem>
                  <SelectItem value="decision">Decision</SelectItem>
                  <SelectItem value="metric_update">Metric Update</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-[var(--muted-foreground)]">{t("problems.outcome")}</Label>
              <Input
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="positive / negative / inconclusive"
                className="h-8 bg-[var(--card)] border-[var(--input)] text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
              />
            </div>
          </div>
          <div>
            <Label className="text-[11px] text-[var(--muted-foreground)]">{t("problems.content")}</Label>
            <Input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe what was tested and the result..."
              className="h-8 bg-[var(--card)] border-[var(--input)] text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-32">
              <Label className="text-[11px] text-[var(--muted-foreground)]">{t("problems.metricValue")}</Label>
              <Input
                type="number"
                value={metricValue}
                onChange={(e) => setMetricValue(e.target.value)}
                placeholder="0.0"
                className="h-8 bg-[var(--card)] border-[var(--input)] text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
              />
            </div>
            <Button
              onClick={handleSubmitUpdate}
              disabled={submitting || !content.trim()}
              className="self-end h-8 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white text-[12px]"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {t("problems.submit")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* -- Main Export ---------------------------------------------------- */

export function ProblemsPage() {
  const { t, lang } = useI18n()
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    fetch("/api/mcc/problems")
      .then((r) => r.json())
      .then((d) => setProblems(d.problems ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const filtered = problems.filter((p) => {
    if (categoryFilter && p.category !== categoryFilter) return false
    if (severityFilter && p.severity !== severityFilter) return false
    return true
  })

  // Summary counts
  const total = problems.length
  const byStatus = problems.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1
    return acc
  }, {})

  // Hypothesis success rate: computed from enriched test result counts
  const totalTestResults = problems.reduce((sum, p) => sum + (p.testCount ?? 0), 0)
  const totalPositive = problems.reduce((sum, p) => sum + (p.positiveTests ?? 0), 0)
  const successRate = totalTestResults > 0 ? Math.round((totalPositive / totalTestResults) * 100) : null
  const successRateStatus: "ok" | "watch" | "stop" | "neutral" =
    successRate === null ? "neutral" : successRate > 50 ? "ok" : successRate > 25 ? "watch" : "stop"

  // Problems with metrics: count problems that have both baseline_value and current_value set
  const problemsWithMetrics = problems.filter(
    (p) => p.baseline_value != null && p.current_value != null,
  ).length

  const getCategoryLabel = (cat: string): string => {
    const labels = categoryLabels[cat as Category]
    return labels ? labels[lang] : cat.replace(/_/g, " ")
  }

  return (
    <>
      <PageHeader
        title={t("problems.title")}
        subtitle={t("problems.subtitle")}
        onRefresh={reload}
      />

      {/* Summary Strip */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)]">
          <FileText className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
          <span className="text-[13px] font-medium text-[var(--foreground)]">{total}</span>
          <span className="text-[12px] text-[var(--muted-foreground)]">{t("problems.total")}</span>
        </div>
        {Object.entries(byStatus).map(([status, count]) => (
          <div
            key={status}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)]"
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                status === "resolved"
                  ? "bg-[var(--success)]"
                  : status === "measuring"
                    ? "bg-[var(--accent)]"
                    : status === "testing"
                      ? "bg-[var(--warning)]"
                      : "bg-[var(--muted-foreground)]"
              }`}
            />
            <span className="text-[13px] font-medium text-[var(--foreground)]">{count}</span>
            <span className="text-[12px] text-[var(--muted-foreground)] capitalize">{status}</span>
          </div>
        ))}

        {/* Hypothesis Success Rate */}
        <div className="px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)]">
          <ScoreBox
            label="Success Rate"
            value={successRate !== null ? `${successRate}%` : "—"}
            status={successRateStatus}
            sub={totalTestResults > 0 ? `${totalPositive}/${totalTestResults} tests` : "no tests yet"}
          />
        </div>

        {/* Problems with Metrics */}
        <div className="px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)]">
          <ScoreBox
            label="With Metrics"
            value={`${problemsWithMetrics}/${total}`}
            status={total > 0 && problemsWithMetrics / total > 0.5 ? "ok" : problemsWithMetrics > 0 ? "watch" : "stop"}
            sub="measuring impact"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {/* Category chips */}
        <button
          onClick={() => setCategoryFilter(null)}
          className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-all ${
            !categoryFilter
              ? "bg-[var(--sidebar-accent)] text-[var(--accent)] border-[var(--accent)]/30"
              : "bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:text-[var(--secondary-foreground)]"
          }`}
        >
          {t("problems.all")}
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
            className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-all ${
              categoryFilter === cat
                ? `${categoryStyles[cat]} border-transparent`
                : "bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:text-[var(--secondary-foreground)]"
            }`}
          >
            {getCategoryLabel(cat)}
          </button>
        ))}

        <div className="ml-auto">
          <Select
            value={severityFilter ?? "all"}
            onValueChange={(v) => setSeverityFilter(!v || v === "all" ? null : v)}
          >
            <SelectTrigger className="h-8 w-[140px] bg-[var(--card)] border-[var(--input)] text-[12px] text-[var(--foreground)]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent className="bg-[var(--popover)] border-[var(--input)]">
              <SelectItem value="all">{t("problems.allSeverity")}</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Problems List */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-[var(--muted)] animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-[13px] text-[var(--muted-foreground)]">{t("problems.noMatch")}</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((p) => {
            const isExpanded = expandedId === p.id
            return (
              <Card key={p.id} className="overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  className="w-full text-left"
                >
                  <CardContent className="flex items-center gap-4 px-5 py-3.5">
                    <StatusDot status={severityDot[p.severity] ?? "gray"} />
                    <span className="text-[14px] font-medium text-[var(--foreground)] flex-1 truncate">
                      {p.title}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                        categoryStyles[p.category as Category] ?? "bg-[var(--border)] text-[var(--muted-foreground)]"
                      }`}
                    >
                      {getCategoryLabel(p.category)}
                    </span>
                    {p.owner && (
                      <span className="text-[12px] text-[var(--muted-foreground)] flex items-center gap-1 whitespace-nowrap">
                        <User className="h-3 w-3" /> {p.owner}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                        statusStyles[p.status] ?? "bg-[var(--border)] text-[var(--muted-foreground)]"
                      }`}
                    >
                      {p.status}
                    </span>
                    <span className="text-[11px] text-[var(--muted-foreground)] flex items-center gap-1 whitespace-nowrap">
                      <Clock className="h-3 w-3" /> {fmtRelative(p.updated_at)}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
                    )}
                  </CardContent>
                </button>
                {isExpanded && <ProblemDetail problem={p} />}
              </Card>
            )
          })
        )}
      </div>
    </>
  )
}
