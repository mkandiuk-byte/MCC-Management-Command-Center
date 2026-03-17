"use client"

import { useState, useCallback } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, RefreshCw, FileText, AlertCircle } from "lucide-react"
import { useDebounce } from "@/lib/use-debounce"
import { useEffect } from "react"

interface SearchResult {
  title: string
  displayPath: string
  docid: string
  score: number
  snippet: string
  fromLine?: number
}

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [indexing, setIndexing] = useState(false)
  const [needsIndex, setNeedsIndex] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([])
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setResults(data.results ?? [])
        setNeedsIndex(!!data.needsIndex)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [debouncedQuery])

  const handleReindex = useCallback(async () => {
    setIndexing(true)
    setError(null)
    try {
      const r = await fetch('/api/search', { method: 'POST' })
      const data = await r.json()
      if (data.error) throw new Error(data.error)
      setNeedsIndex(false)
      // Re-run search if query exists
      if (debouncedQuery) {
        const r2 = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
        const d2 = await r2.json()
        setResults(d2.results ?? [])
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIndexing(false)
    }
  }, [debouncedQuery])

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-2 px-6 py-4 border-b shrink-0">
        <SidebarTrigger />
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Search</h1>
          <p className="text-sm text-muted-foreground">Full-text search across workspace files</p>
        </div>
        <button
          onClick={handleReindex}
          disabled={indexing}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          title="Reindex files"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${indexing ? 'animate-spin' : ''}`} />
          {indexing ? 'Indexing...' : 'Reindex'}
        </button>
      </header>

      <div className="px-6 py-3 border-b shrink-0">
        <div className="relative max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search files..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-6 py-4 max-w-3xl">
          {needsIndex && !loading && (
            <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-sm mb-4">
              <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Index not built yet</p>
                <p className="text-muted-foreground text-xs mt-0.5">Click "Reindex" to index your files (takes ~10–30s)</p>
              </div>
              <button
                onClick={handleReindex}
                disabled={indexing}
                className="text-xs px-3 py-1.5 rounded bg-yellow-500/20 hover:bg-yellow-500/30 transition-colors font-medium"
              >
                Build index
              </button>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-sm text-destructive mb-4">
              {error}
            </div>
          )}

          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              ))}
            </div>
          )}

          {!loading && !error && results.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground mb-3">
                {results.length} result{results.length !== 1 ? 's' : ''} for "{debouncedQuery}"
              </p>
              {results.map((r) => (
                <div
                  key={r.docid}
                  className="p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-default"
                >
                  <div className="flex items-start gap-2 mb-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{r.title || r.displayPath}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
                      {(r.score * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground truncate mb-1.5 pl-5">
                    {r.displayPath}
                  </p>
                  {r.snippet && (
                    <p className="text-xs text-muted-foreground pl-5 line-clamp-2 leading-relaxed">
                      {r.snippet}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {!loading && !error && !needsIndex && debouncedQuery && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">
              No results for "{debouncedQuery}"
            </p>
          )}

          {!debouncedQuery && !loading && (
            <p className="text-sm text-muted-foreground text-center py-12">
              Start typing to search
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
