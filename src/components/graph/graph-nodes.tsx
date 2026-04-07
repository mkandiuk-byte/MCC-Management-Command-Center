"use client"

import { Handle, Position } from '@xyflow/react'
import type { GraphNodeData } from '@aap/types'

function geoFlag(code: string): string {
  if (!code || code.length !== 2) return ''
  return code.toUpperCase().split('').map(c => String.fromCodePoint(0x1F1A5 + c.charCodeAt(0))).join('')
}

interface NodeProps {
  data: GraphNodeData & { selected?: boolean }
  selected?: boolean
}

function fmt$(v: number) {
  if (v === 0) return '$0'
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`
  return `$${v.toFixed(0)}`
}

const SCHEMA_LABELS: Record<string, string> = {
  'landing':           'Landing',
  'prelanding':        'Pre-land',
  'prelanding+landing':'Pre→Land',
  'direct':            'Direct',
}

export function StreamNode({ data }: NodeProps) {
  const sel = data.selected
  return (
    <div className={`rounded-xl border-2 bg-background shadow-md w-[260px] cursor-pointer select-none transition-all ${
      sel ? 'border-amber-500 shadow-amber-200/50 dark:shadow-amber-900/30 scale-[1.02]' : 'border-border hover:border-amber-400'
    }`}>
      <Handle type="target" position={Position.Left}  className="!w-2.5 !h-2.5 !bg-amber-400 !border-amber-600" />
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-amber-400 !border-amber-600" />
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">Поток</span>
          <div className="flex items-center gap-1">
            {data.schema && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium">
                {SCHEMA_LABELS[data.schema] ?? data.schema}
              </span>
            )}
            {data.weight !== undefined && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{data.weight}%</span>
            )}
          </div>
        </div>
        <div className="text-sm font-semibold leading-tight truncate mb-2" title={data.label}>
          {data.label}
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-[10px]">
          <div className="text-center">
            <div className="font-semibold text-foreground">{data.clicks.toLocaleString()}</div>
            <div className="text-muted-foreground">кликов</div>
          </div>
          <div className="text-center">
            <div className={`font-semibold ${data.roi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {data.roi.toFixed(0)}%
            </div>
            <div className="text-muted-foreground">ROI</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-foreground">{data.cr.toFixed(1)}%</div>
            <div className="text-muted-foreground">CR</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function OfferNode({ data }: NodeProps) {
  const sel = data.selected
  const flag = data.offerGeo ? geoFlag(data.offerGeo) : ''
  const hasMeta = data.offerBrand || data.offerGeo || data.offerLandingType || data.offerConvAction

  return (
    <div className={`rounded-xl border-2 bg-background shadow-md w-[260px] cursor-pointer select-none transition-all ${
      sel ? 'border-emerald-500 shadow-emerald-200/50 dark:shadow-emerald-900/30 scale-[1.02]' : 'border-border hover:border-emerald-400'
    }`}>
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-emerald-400 !border-emerald-600" />
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Оффер</span>
          {data.offerPayoutUpsell && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-medium">upsell</span>
          )}
        </div>
        {/* Brand name (large) */}
        <div className="text-sm font-semibold leading-tight truncate mb-1" title={data.offerBrand || data.label}>
          {data.offerBrand || data.label}
        </div>
        {/* Meta tags row */}
        {hasMeta && (
          <div className="flex items-center gap-1 flex-wrap mb-1.5">
            {flag && data.offerGeo && (
              <span className="text-[10px] font-mono">{flag} {data.offerGeo}</span>
            )}
            {data.offerLandingType && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium">
                {data.offerLandingType}{data.offerTier ? ` ${data.offerTier}` : ''}
              </span>
            )}
            {data.offerConvAction && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-medium">
                {data.offerConvAction}
              </span>
            )}
          </div>
        )}
        {/* Network */}
        {data.offerNetwork && (
          <div className="text-[9px] text-muted-foreground truncate mb-1.5" title={data.offerNetwork}>
            {data.offerNetwork}
          </div>
        )}
        {/* Bonus */}
        {data.offerBonus && (
          <div className="text-[9px] px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 mb-1.5 truncate">
            🎁 {data.offerBonus}
          </div>
        )}
        {/* Stats */}
        <div className="grid grid-cols-3 gap-1.5 text-[10px] border-t border-border/30 pt-1.5">
          <div className="text-center">
            <div className="font-semibold text-foreground">{data.conversions.toLocaleString()}</div>
            <div className="text-muted-foreground">конв.</div>
          </div>
          <div className="text-center">
            <div className={`font-semibold ${data.roi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {data.roi.toFixed(0)}%
            </div>
            <div className="text-muted-foreground">ROI</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-foreground">{fmt$(data.cpa)}</div>
            <div className="text-muted-foreground">CPA</div>
          </div>
        </div>
      </div>
    </div>
  )
}
