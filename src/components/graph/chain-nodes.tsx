"use client"

import { Handle, Position } from '@xyflow/react'

function fmt(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return String(v)
}
function fmtMoney(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`
  return `$${v.toFixed(0)}`
}

const TYPE_COLOR: Record<string, { border: string; badge: string; bg: string; label: string }> = {
  offer:         { border: 'border-green-500',   badge: 'bg-green-500/15 text-green-300',   bg: 'bg-green-500/5',   label: '🟢 Offer'        },
  app:           { border: 'border-orange-500',  badge: 'bg-orange-500/15 text-orange-300', bg: 'bg-orange-500/5',  label: '🟠 App/PWA'      },
  cloak:         { border: 'border-yellow-500',  badge: 'bg-yellow-500/15 text-yellow-300', bg: 'bg-yellow-500/5',  label: '🟡 Cloak'        },
  funnel_owner:  { border: 'border-blue-500',    badge: 'bg-blue-500/15 text-blue-300',     bg: 'bg-blue-500/5',    label: '🟦 Funnel'       },
  offer_manager: { border: 'border-emerald-500', badge: 'bg-emerald-500/15 text-emerald-300', bg: 'bg-emerald-500/5', label: '🟩 Mgr'        },
  default_app:   { border: 'border-amber-500',   badge: 'bg-amber-500/15 text-amber-300',   bg: 'bg-amber-500/5',   label: '🟨 Default'     },
  unknown:       { border: 'border-zinc-500',    badge: 'bg-zinc-500/15 text-zinc-300',     bg: 'bg-zinc-500/5',    label: '⚪ Unknown'     },
}

// ─── Ad Campaign Node ─────────────────────────────────────────────────────────
export function AdCampaignNode({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  const adId = String(data.adId ?? '')
  const network = String(data.network ?? 'Other')
  const networkColor = String(data.networkColor ?? '#6b7280')
  const clicks = Number(data.clicks ?? 0)
  const conversions = Number(data.conversions ?? 0)
  const cr = Number(data.cr ?? 0)

  return (
    <div className={`w-[270px] rounded-xl border-2 bg-background shadow-md select-none transition-all
      ${selected ? 'border-violet-400 shadow-violet-400/20 scale-[1.02]' : 'border-violet-500/50 hover:border-violet-400'}
    `}>
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-violet-400 !border-violet-600" />
      <div className="px-3 pt-2.5 pb-2">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-violet-400">Ad Campaign</span>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded font-semibold ml-auto"
            style={{ backgroundColor: networkColor + '22', color: networkColor }}
          >
            {network}
          </span>
        </div>
        <div className="font-mono text-[11px] font-semibold text-foreground truncate mb-2 bg-muted/40 px-2 py-1 rounded" title={adId}>
          {adId}
        </div>
        <div className="grid grid-cols-3 gap-1 text-[10px]">
          <div className="text-center">
            <div className="font-semibold text-indigo-300">{fmt(clicks)}</div>
            <div className="text-muted-foreground">clicks</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-green-400">{fmt(conversions)}</div>
            <div className="text-muted-foreground">conv</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-amber-400">{cr.toFixed(1)}%</div>
            <div className="text-muted-foreground">CR</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Campaign Node ────────────────────────────────────────────────────────────
export function CampaignNode({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  const name = String(data.name ?? '')
  const keitaroId = Number(data.keitaroId ?? 0)
  const alias = String(data.alias ?? '')
  const campaignType = String(data.campaignType ?? 'unknown')
  const state = String(data.state ?? 'unknown')
  const clicks = Number(data.clicks ?? 0)
  const conversions = Number(data.conversions ?? 0)
  const cr = Number(data.cr ?? 0)
  const revenue = Number(data.revenue ?? 0)

  const tm = TYPE_COLOR[campaignType] ?? TYPE_COLOR.unknown

  return (
    <div className={`w-[300px] rounded-xl border-2 bg-background shadow-md select-none transition-all
      ${selected ? `${tm.border} shadow-lg scale-[1.02]` : `${tm.border.replace('border-', 'border-')}/50 hover:${tm.border}`}
    `}>
      <Handle type="target" position={Position.Left}  className="!w-2.5 !h-2.5 !bg-indigo-400 !border-indigo-600" />
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-green-400 !border-green-600" />
      <div className="px-3 pt-2.5 pb-2">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${tm.badge}`}>{tm.label}</span>
          {state !== 'active' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400">{state}</span>
          )}
        </div>
        {/* Name */}
        <div className="text-[11px] font-semibold text-foreground truncate mb-2" title={name}>{name}</div>
        {/* Identifiers */}
        <div className="space-y-1 mb-2">
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-muted-foreground w-20 shrink-0">campaign_id</span>
            <span className="font-mono font-semibold text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded">{keitaroId || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-muted-foreground w-20 shrink-0">cloak_id</span>
            <span className="font-mono font-semibold text-yellow-300 bg-yellow-500/10 px-1.5 py-0.5 rounded truncate max-w-[160px]" title={alias}>
              {alias || '—'}
            </span>
          </div>
        </div>
        {/* Metrics */}
        <div className="grid grid-cols-4 gap-1 text-[10px] border-t border-border/30 pt-1.5">
          <div className="text-center">
            <div className="font-semibold text-indigo-300">{fmt(clicks)}</div>
            <div className="text-muted-foreground">clicks</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-green-400">{fmt(conversions)}</div>
            <div className="text-muted-foreground">conv</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-amber-400">{cr.toFixed(1)}%</div>
            <div className="text-muted-foreground">CR</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-blue-400">{fmtMoney(revenue)}</div>
            <div className="text-muted-foreground">rev</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Cloak Campaign Node (Collector) ─────────────────────────────────────────
// Shown instead of campaign nodes for "[GEO] OFFERS [NETWORK]" collector campaigns.
// The meaningful entity here is cloak_campaign_id, not campaign_id.
export function CloakCampaignNode({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  const cloakId  = String(data.cloakId  ?? '')
  const campName = String(data.campName ?? '')
  const geo      = String(data.geo      ?? '')
  const clicks      = Number(data.clicks      ?? 0)
  const conversions = Number(data.conversions ?? 0)
  const cr          = Number(data.cr          ?? 0)
  const revenue     = Number(data.revenue     ?? 0)
  const cost        = Number(data.cost        ?? 0)
  const profit      = revenue - cost
  const roi         = cost > 0 ? (profit / cost) * 100 : 0

  return (
    <div className={`w-[300px] rounded-xl border-2 bg-background shadow-md select-none transition-all
      ${selected ? 'border-orange-400 shadow-orange-400/20 scale-[1.02]' : 'border-orange-500/50 hover:border-orange-400'}
    `}>
      <Handle type="target" position={Position.Left}  className="!w-2.5 !h-2.5 !bg-orange-400 !border-orange-600" />
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-orange-300 !border-orange-500" />
      <div className="px-3 pt-2.5 pb-2">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-orange-500/15 text-orange-300">⚡ Collector</span>
          {geo && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-300 font-mono">{geo}</span>
          )}
        </div>
        {/* Collector campaign name */}
        <div className="text-[10px] text-muted-foreground truncate mb-1.5" title={campName}>{campName}</div>
        {/* cloak_id */}
        <div className="flex items-center gap-2 text-[10px] mb-2">
          <span className="text-muted-foreground w-16 shrink-0">cloak_id</span>
          <span className="font-mono font-semibold text-orange-300 bg-orange-500/10 px-1.5 py-0.5 rounded truncate max-w-[170px]" title={cloakId}>
            {cloakId || '—'}
          </span>
        </div>
        {/* Metrics */}
        <div className="grid grid-cols-4 gap-1 text-[10px] border-t border-border/30 pt-1.5">
          <div className="text-center">
            <div className="font-semibold text-indigo-300">{fmt(clicks)}</div>
            <div className="text-muted-foreground">clicks</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-green-400">{fmt(conversions)}</div>
            <div className="text-muted-foreground">conv</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-amber-400">{cr.toFixed(1)}%</div>
            <div className="text-muted-foreground">CR</div>
          </div>
          <div className="text-center">
            <div className={`font-semibold ${roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>{roi.toFixed(0)}%</div>
            <div className="text-muted-foreground">ROI</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Offer Node ───────────────────────────────────────────────────────────────
export function OfferChainNode({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  const name = String(data.name ?? '')
  const offerId = Number(data.offerId ?? 0)
  const clicks = Number(data.clicks ?? 0)
  const conversions = Number(data.conversions ?? 0)
  const cr = Number(data.cr ?? 0)
  const revenue = Number(data.revenue ?? 0)
  const leads = Number(data.leads ?? 0)
  const sales = Number(data.sales ?? 0)

  return (
    <div className={`w-[270px] rounded-xl border-2 bg-background shadow-md select-none transition-all
      ${selected ? 'border-emerald-400 shadow-emerald-400/20 scale-[1.02]' : 'border-emerald-500/50 hover:border-emerald-400'}
    `}>
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-emerald-400 !border-emerald-600" />
      <div className="px-3 pt-2.5 pb-2">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">Offer</span>
          <span className="font-mono text-[9px] text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-auto">
            id: {offerId || '—'}
          </span>
        </div>
        <div className="text-[11px] font-semibold text-foreground truncate mb-2" title={name}>{name}</div>
        <div className="grid grid-cols-3 gap-1 text-[10px]">
          <div className="text-center">
            <div className="font-semibold text-green-400">{fmt(conversions)}</div>
            <div className="text-muted-foreground">conv</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-blue-400">{fmt(leads)}</div>
            <div className="text-muted-foreground">leads</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-violet-400">{fmt(sales)}</div>
            <div className="text-muted-foreground">sales</div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/30 text-[10px]">
          <span className="text-muted-foreground">CR</span>
          <span className="text-amber-400 font-semibold">{cr.toFixed(2)}%</span>
          <span className="text-muted-foreground">Revenue</span>
          <span className="text-blue-400 font-semibold">{fmtMoney(revenue)}</span>
          <span className="text-muted-foreground">Clicks</span>
          <span className="text-indigo-300 font-semibold">{fmt(clicks)}</span>
        </div>
      </div>
    </div>
  )
}
