"use client"

import { useState, useEffect, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown, Search, X } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OfferQuality {
  offerId:        string
  offerName:      string
  totalDep:       number
  approved:       number
  pending:        number
  rejected:       number
  approvalRate:   number | null
  rejectionRate:  number | null
  avgDaysApprove: number | null
}

interface RevenueDeltaRow {
  adCampaignId:   string
  clicks:         number
  keitaroRevenue: number
  scaleoRevenue:  number
  delta:          number
  deltaPct:       number | null
}

type Tab = 'offers' | 'delta'
type Preset = '30d' | '60d' | '90d'

const PRESETS: { key: Preset; label: string }[] = [
  { key: '30d', label: '30d' },
  { key: '60d', label: '60d' },
  { key: '90d', label: '90d' },
]

function fmtDate(d: Date) { return d.toISOString().split('T')[0] }
function getRange(p: Preset) {
  const today = new Date()
  const days = p === '30d' ? 30 : p === '60d' ? 60 : 90
  return { from: fmtDate(new Date(today.getTime() - days * 86400000)), to: fmtDate(today) }
}
function fmtMoney(v: number) {
  const abs = Math.abs(v), sign = v < 0 ? '-' : ''
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`
  return `${sign}$${abs.toFixed(0)}`
}

// ─── Offer Quality sort ───────────────────────────────────────────────────────

type OfferSortKey = 'totalDep' | 'approved' | 'pending' | 'rejected' | 'approvalRate' | 'rejectionRate' | 'avgDaysApprove'

function SortIcon({ col, sortKey, dir }: { col: string; sortKey: string; dir: 'asc' | 'desc' }) {
  if (col !== sortKey) return <ChevronsUpDown className="h-3 w-3 opacity-30 shrink-0" />
  return dir === 'desc' ? <ChevronDown className="h-3 w-3 text-indigo-400 shrink-0" /> : <ChevronUp className="h-3 w-3 text-indigo-400 shrink-0" />
}

function SortTh({ label, col, sortKey, dir, onSort, className }: {
  label: string; col: string; sortKey: string; dir: 'asc' | 'desc'
  onSort: (k: string) => void
  className?: string
}) {
  return (
    <th
      className={`text-right px-2 py-2 font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground select-none ${className ?? ''}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-0.5 justify-end">
        {label}
        <SortIcon col={col} sortKey={sortKey} dir={dir} />
      </span>
    </th>
  )
}

// ─── Approval Rate bar ────────────────────────────────────────────────────────

function ApprovalBar({ approvalRate, rejectionRate, pending, total }: {
  approvalRate: number | null; rejectionRate: number | null; pending: number; total: number
}) {
  const pendingPct = total > 0 ? (pending / total * 100) : 0
  const approvedPct = approvalRate ?? 0
  // scale approved to non-pending portion
  const finalPct = (100 - pendingPct) * approvedPct / 100

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-border/40 overflow-hidden min-w-[60px]">
        <div className="flex h-full">
          <div className="bg-green-500/70 rounded-l-full" style={{ width: `${finalPct}%` }} />
          <div className="bg-yellow-500/50" style={{ width: `${pendingPct}%` }} />
          {rejectionRate != null && rejectionRate > 0 && (
            <div className="bg-red-500/60 rounded-r-full" style={{ width: `${(100 - pendingPct) * (rejectionRate / 100)}%` }} />
          )}
        </div>
      </div>
      <span className={`text-[10px] font-mono tabular-nums w-9 text-right ${
        approvalRate == null ? 'text-muted-foreground' :
        approvalRate >= 90 ? 'text-green-400' :
        approvalRate >= 70 ? 'text-yellow-400' : 'text-red-400'
      }`}>
        {approvalRate != null ? `${approvalRate.toFixed(0)}%` : '—'}
      </span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ConversionQuality() {
  const [tab, setTab]             = useState<Tab>('offers')
  const [preset, setPreset]       = useState<Preset>('90d')
  const [refreshKey, setRefreshKey] = useState(0)
  const [search, setSearch]       = useState('')

  const [offers, setOffers]           = useState<OfferQuality[] | null>(null)
  const [delta, setDelta]             = useState<RevenueDeltaRow[] | null>(null)
  const [loadingOffers, setLoadingOffers] = useState(false)
  const [loadingDelta, setLoadingDelta]   = useState(false)

  const [offerSort, setOfferSort] = useState<{ key: OfferSortKey; dir: 'asc' | 'desc' }>({ key: 'totalDep', dir: 'desc' })
  const [deltaSort, setDeltaSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'delta', dir: 'desc' })

  const { from, to } = useMemo(() => getRange(preset), [preset])

  useEffect(() => {
    setLoadingOffers(true)
    const qs = new URLSearchParams({ from, to }).toString()
    fetch(`/api/analytics/traffic-quality/offers?${qs}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setOffers(d) })
      .catch(() => {})
      .finally(() => setLoadingOffers(false))
  }, [from, to, refreshKey])

  useEffect(() => {
    setLoadingDelta(true)
    const qs = new URLSearchParams({ from, to }).toString()
    fetch(`/api/analytics/traffic-quality/revenue-delta?${qs}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDelta(d) })
      .catch(() => {})
      .finally(() => setLoadingDelta(false))
  }, [from, to, refreshKey])

  const sortedOffers = useMemo(() => {
    if (!offers) return []
    let list = offers
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(o => o.offerName.toLowerCase().includes(q) || o.offerId.includes(q))
    }
    return [...list].sort((a, b) => {
      const k = offerSort.key
      const av = (k === 'approvalRate' || k === 'rejectionRate' || k === 'avgDaysApprove')
        ? (a[k] ?? (offerSort.dir === 'desc' ? -1 : 9999))
        : (a[k] as number)
      const bv = (k === 'approvalRate' || k === 'rejectionRate' || k === 'avgDaysApprove')
        ? (b[k] ?? (offerSort.dir === 'desc' ? -1 : 9999))
        : (b[k] as number)
      return offerSort.dir === 'desc' ? bv - av : av - bv
    })
  }, [offers, offerSort, search])

  const sortedDelta = useMemo(() => {
    if (!delta) return []
    let list = delta
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(r => r.adCampaignId.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      const k = deltaSort.key as keyof RevenueDeltaRow
      const av = a[k] as number ?? -99999
      const bv = b[k] as number ?? -99999
      return deltaSort.dir === 'desc' ? bv - av : av - bv
    })
  }, [delta, deltaSort, search])

  function handleOfferSort(key: string) {
    setOfferSort(s => s.key === key ? { ...s, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key: key as OfferSortKey, dir: 'desc' })
  }
  function handleDeltaSort(key: string) {
    setDeltaSort(s => s.key === key ? { ...s, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' })
  }

  // Virtualizer for offers table
  const offersTableRef = useRef<HTMLDivElement>(null)
  const offersVirtualizer = useVirtualizer({
    count: sortedOffers.length,
    getScrollElement: () => offersTableRef.current,
    estimateSize: () => 34,
    overscan: 15,
  })

  const deltaTableRef = useRef<HTMLDivElement>(null)
  const deltaVirtualizer = useVirtualizer({
    count: sortedDelta.length,
    getScrollElement: () => deltaTableRef.current,
    estimateSize: () => 34,
    overscan: 15,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-base font-semibold">Conversion Quality</h2>

        {/* Tabs */}
        <div className="flex gap-1 p-0.5 rounded-lg border border-border/50 bg-card/30">
          {([['offers', 'Offer Approval'], ['delta', 'Revenue Delta']] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                tab === key
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}>{label}</button>
          ))}
        </div>

        {/* Presets */}
        <div className="flex gap-1 p-0.5 rounded-lg border border-border/50 bg-card/30">
          {PRESETS.map(({ key, label }) => (
            <button key={key} onClick={() => setPreset(key)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                preset === key
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}>{label}</button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[180px] max-w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none"/>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full pl-7 pr-6 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"/>
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3"/>
            </button>
          )}
        </div>

        <button onClick={() => setRefreshKey(k => k + 1)}
          className="text-muted-foreground hover:text-foreground transition-colors ml-auto">
          <RefreshCw className="h-4 w-4"/>
        </button>
      </div>

      {/* ── Offer Approval Tab ─────────────────────────────────── */}
      {tab === 'offers' && (
        loadingOffers ? (
          <div className="flex flex-col gap-2">{Array.from({length:8}).map((_,i) => <Skeleton key={i} className="h-8"/>)}</div>
        ) : (
          <>
            {/* Summary cards */}
            {offers && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="text-[10px] text-muted-foreground mb-1">Total Offers</div>
                  <div className="text-lg font-bold">{offers.length}</div>
                  <div className="text-[10px] text-muted-foreground">≥5 DEP conversions</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="text-[10px] text-muted-foreground mb-1">Total DEPs</div>
                  <div className="text-lg font-bold text-emerald-400">
                    {offers.reduce((s, o) => s + o.totalDep, 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {offers.reduce((s, o) => s + o.approved, 0).toLocaleString()} approved
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="text-[10px] text-muted-foreground mb-1">Pending</div>
                  <div className="text-lg font-bold text-yellow-400">
                    {offers.reduce((s, o) => s + o.pending, 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground">awaiting approval</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="text-[10px] text-muted-foreground mb-1">Rejected</div>
                  <div className="text-lg font-bold text-red-400">
                    {offers.reduce((s, o) => s + o.rejected, 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {offers.filter(o => o.rejectionRate != null && o.rejectionRate > 10).length} offers &gt;10% rejection
                  </div>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 text-[9px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><span className="w-2 h-1.5 rounded bg-green-500/70 inline-block"/>Approved</span>
              <span className="flex items-center gap-1"><span className="w-2 h-1.5 rounded bg-yellow-500/50 inline-block"/>Pending</span>
              <span className="flex items-center gap-1"><span className="w-2 h-1.5 rounded bg-red-500/60 inline-block"/>Rejected</span>
              <span className="ml-2 text-muted-foreground/60">Approval Rate = Approved / (Approved + Rejected)</span>
            </div>

            <div ref={offersTableRef} className="rounded-xl border border-border overflow-auto" style={{ maxHeight: '520px' }}>
              <table className="w-full text-[11px] border-collapse table-fixed min-w-[820px]">
                <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[52px] min-w-[52px]">ID</th>
                    <th className="text-left px-2 py-2 font-medium text-muted-foreground w-[260px] min-w-[260px]">Offer Name</th>
                    <SortTh label="DEPs"       col="totalDep"       sortKey={offerSort.key} dir={offerSort.dir} onSort={handleOfferSort} className="w-[72px] min-w-[72px]"/>
                    <SortTh label="Approved"   col="approved"       sortKey={offerSort.key} dir={offerSort.dir} onSort={handleOfferSort} className="w-[80px] min-w-[80px]"/>
                    <SortTh label="Pending"    col="pending"        sortKey={offerSort.key} dir={offerSort.dir} onSort={handleOfferSort} className="w-[72px] min-w-[72px]"/>
                    <SortTh label="Rejected"   col="rejected"       sortKey={offerSort.key} dir={offerSort.dir} onSort={handleOfferSort} className="w-[72px] min-w-[72px]"/>
                    <SortTh label="Approv. Rate"  col="approvalRate"   sortKey={offerSort.key} dir={offerSort.dir} onSort={handleOfferSort} className="w-[180px] min-w-[180px]"/>
                    <SortTh label="Avg Days"   col="avgDaysApprove" sortKey={offerSort.key} dir={offerSort.dir} onSort={handleOfferSort} className="w-[80px] min-w-[80px]"/>
                    <th className="w-auto"/>
                  </tr>
                </thead>
                <tbody style={{ height: `${offersVirtualizer.getTotalSize()}px`, display: 'block', position: 'relative' }}>
                  {offersVirtualizer.getVirtualItems().map(vRow => {
                    const o = sortedOffers[vRow.index]
                    return (
                      <tr key={o.offerId}
                        data-index={vRow.index}
                        ref={offersVirtualizer.measureElement}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }}
                        className="border-b border-border/30 hover:bg-accent/30 transition-colors table table-fixed">
                        <td className="px-3 py-2 font-mono text-muted-foreground w-[52px] min-w-[52px]">{o.offerId}</td>
                        <td className="px-2 py-2 w-[260px] min-w-[260px]">
                          <span className="truncate block max-w-[248px] text-foreground" title={o.offerName}>{o.offerName}</span>
                        </td>
                        <td className="text-right px-2 py-2 font-mono w-[72px] min-w-[72px]">{o.totalDep.toLocaleString()}</td>
                        <td className="text-right px-2 py-2 text-green-400 font-mono w-[80px] min-w-[80px]">{o.approved.toLocaleString()}</td>
                        <td className="text-right px-2 py-2 text-yellow-400/80 font-mono w-[72px] min-w-[72px]">
                          {o.pending > 0 ? o.pending.toLocaleString() : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="text-right px-2 py-2 font-mono w-[72px] min-w-[72px]">
                          {o.rejected > 0
                            ? <span className="text-red-400">{o.rejected.toLocaleString()}</span>
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-2 py-2 w-[180px] min-w-[180px]">
                          <ApprovalBar approvalRate={o.approvalRate} rejectionRate={o.rejectionRate}
                            pending={o.pending} total={o.totalDep}/>
                        </td>
                        <td className="text-right px-2 py-2 w-[80px] min-w-[80px]">
                          {o.avgDaysApprove != null
                            ? <span className={`font-mono ${o.avgDaysApprove > 60 ? 'text-red-400' : o.avgDaysApprove > 30 ? 'text-yellow-400' : 'text-green-400'}`}>
                                {o.avgDaysApprove.toFixed(1)}d
                              </span>
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="w-auto"/>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {sortedOffers.length === 0 && (
                <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">No data</div>
              )}
            </div>
          </>
        )
      )}

      {/* ── Revenue Delta Tab ──────────────────────────────────── */}
      {tab === 'delta' && (
        loadingDelta ? (
          <div className="flex flex-col gap-2">{Array.from({length:8}).map((_,i) => <Skeleton key={i} className="h-8"/>)}</div>
        ) : (
          <>
            <div className="text-[11px] text-muted-foreground">
              Difference between Keitaro-tracked revenue and Scaleo-reported revenue per ad campaign.
              Large delta may indicate tracking issues.
            </div>
            <div ref={deltaTableRef} className="rounded-xl border border-border overflow-auto" style={{ maxHeight: '520px' }}>
              <table className="w-full text-[11px] border-collapse table-fixed min-w-[680px]">
                <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[220px] min-w-[220px]">Ad Campaign ID</th>
                    <SortTh label="Clicks"    col="clicks"         sortKey={deltaSort.key} dir={deltaSort.dir} onSort={handleDeltaSort} className="w-[80px] min-w-[80px]"/>
                    <SortTh label="Keitaro"   col="keitaroRevenue" sortKey={deltaSort.key} dir={deltaSort.dir} onSort={handleDeltaSort} className="w-[100px] min-w-[100px]"/>
                    <SortTh label="Scaleo"    col="scaleoRevenue"  sortKey={deltaSort.key} dir={deltaSort.dir} onSort={handleDeltaSort} className="w-[100px] min-w-[100px]"/>
                    <SortTh label="Delta"     col="delta"          sortKey={deltaSort.key} dir={deltaSort.dir} onSort={handleDeltaSort} className="w-[100px] min-w-[100px]"/>
                    <SortTh label="Delta %"   col="deltaPct"       sortKey={deltaSort.key} dir={deltaSort.dir} onSort={handleDeltaSort} className="w-[80px] min-w-[80px]"/>
                    <th className="w-auto"/>
                  </tr>
                </thead>
                <tbody style={{ height: `${deltaVirtualizer.getTotalSize()}px`, display: 'block', position: 'relative' }}>
                  {deltaVirtualizer.getVirtualItems().map(vRow => {
                    const r = sortedDelta[vRow.index]
                    const deltaColor = r.delta > 0 ? 'text-green-400' : r.delta < 0 ? 'text-red-400' : 'text-muted-foreground'
                    return (
                      <tr key={r.adCampaignId}
                        data-index={vRow.index}
                        ref={deltaVirtualizer.measureElement}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }}
                        className="border-b border-border/30 hover:bg-accent/30 transition-colors table table-fixed">
                        <td className="px-3 py-2 font-mono text-foreground w-[220px] min-w-[220px]">
                          <span className="truncate block max-w-[208px]" title={r.adCampaignId}>{r.adCampaignId}</span>
                        </td>
                        <td className="text-right px-2 py-2 text-muted-foreground font-mono w-[80px] min-w-[80px]">
                          {r.clicks.toLocaleString()}
                        </td>
                        <td className="text-right px-2 py-2 font-mono w-[100px] min-w-[100px]">
                          {fmtMoney(r.keitaroRevenue)}
                        </td>
                        <td className="text-right px-2 py-2 font-mono w-[100px] min-w-[100px]">
                          {fmtMoney(r.scaleoRevenue)}
                        </td>
                        <td className={`text-right px-2 py-2 font-mono font-semibold w-[100px] min-w-[100px] ${deltaColor}`}>
                          {r.delta > 0 ? '+' : ''}{fmtMoney(r.delta)}
                        </td>
                        <td className={`text-right px-2 py-2 font-mono w-[80px] min-w-[80px] ${
                          r.deltaPct == null ? 'text-muted-foreground' :
                          Math.abs(r.deltaPct) > 20 ? 'text-red-400' :
                          Math.abs(r.deltaPct) > 5 ? 'text-yellow-400' : 'text-muted-foreground'
                        }`}>
                          {r.deltaPct != null ? `${r.deltaPct > 0 ? '+' : ''}${r.deltaPct.toFixed(1)}%` : '—'}
                        </td>
                        <td className="w-auto"/>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {sortedDelta.length === 0 && (
                <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">No data</div>
              )}
            </div>
          </>
        )
      )}
    </div>
  )
}
