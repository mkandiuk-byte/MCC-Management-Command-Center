// ─── Campaign type detection (emoji prefix) ───────────────────────────────────

export type CampaignType =
  | 'offer' | 'app' | 'cloak' | 'funnel_owner' | 'offer_manager' | 'default_app' | 'unknown'

export function detectCampaignType(name: string): CampaignType {
  if (name.startsWith('🟢')) return 'offer'
  if (name.startsWith('🟠')) return 'app'
  if (name.startsWith('🟡')) return 'cloak'
  if (name.startsWith('🟦')) return 'funnel_owner'
  if (name.startsWith('🟩')) return 'offer_manager'
  if (name.startsWith('🟨')) return 'default_app'
  return 'unknown'
}

// ─── Ad network detection (ad_campaign_id format heuristic) ──────────────────

export function detectNetwork(id: string): 'Meta' | 'Google' | 'TikTok' | 'Other' {
  if (/^\d{15,25}$/.test(id)) return 'Meta'
  if (/^\d{9,14}$/.test(id)) return 'Google'
  if (/^[A-Za-z0-9_-]{18,25}$/.test(id)) return 'TikTok'
  return 'Other'
}

export const NETWORK_COLOR: Record<string, string> = {
  Meta:   '#1877f2',
  Google: '#4285f4',
  TikTok: '#010101',
  Other:  '#6b7280',
}

// ─── Offer name parser ────────────────────────────────────────────────────────

function stripLeading(s: string): string {
  return s.replace(/^[^A-Za-z0-9(]+/, '').trim()
}

export function parseOfferName(name: string) {
  const segs = name.split('|').map(stripLeading).filter(Boolean)
  const tierSeg = segs[3] ?? ''
  const m = tierSeg.match(/^(\S+)\s+T(\d+)([A-Z]+\d+)?$/i)
  return {
    brand:       segs[0] ?? '',
    geo:         segs[1] ?? '',
    source:      segs[2] ?? '',
    landingType: (m ? m[1] : tierSeg.split(/\s+/)[0] ?? '').toUpperCase(),
    tier:        m ? `T${m[2]}` : '',
    variant:     m ? (m[3] ?? '') : '',
    convAction:  segs[4] ?? '',
    network:     segs[5] ?? '',
  }
}

// ─── Stream schema normalisation ──────────────────────────────────────────────

export function normalizeSchema(raw: string): string {
  const s = (raw ?? '').trim().toLowerCase()
  if (s === 'landings')            return 'landing'
  if (s === 'prelandings')         return 'prelanding'
  if (s === 'prelanding_landings') return 'prelanding+landing'
  return s || 'direct'
}

// ─── Date formatting ──────────────────────────────────────────────────────────

export function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ─── Derived metrics ─────────────────────────────────────────────────────────

export function deriveMetrics(
  clicks: number,
  conversions: number,
  revenue: number,
  cost: number,
) {
  const profit = revenue - cost
  const roi    = cost > 0 ? (profit / cost) * 100 : 0
  const cr     = clicks > 0 ? (conversions / clicks) * 100 : 0
  const cpa    = conversions > 0 ? cost / conversions : 0
  const cpc    = clicks > 0 ? cost / clicks : 0
  const epc    = clicks > 0 ? revenue / clicks : 0
  return { profit, roi, cr, cpa, cpc, epc }
}

// ─── Campaign classification ──────────────────────────────────────────────────

const MIN_COST_FOR_DATA  = 150
const MIN_CLICKS_FOR_DATA = 100
const TARGET_PAYBACK_MONTHS = 3
const MAX_PAYBACK_MONTHS    = 4

export type CampaignStatus = 'success' | 'failed' | 'decision' | 'no_data'

export function classifyCampaign(
  type: CampaignType,
  cost: number,
  clicks: number,
  conversions: number,
  roi: number,
): CampaignStatus {
  if (type !== 'offer') return 'no_data'
  if (cost < MIN_COST_FOR_DATA || clicks < MIN_CLICKS_FOR_DATA) return 'no_data'
  if (conversions === 0) return 'failed'
  if (roi >= 0) return 'success'
  if (roi < -70) return 'failed'
  return 'decision'
}

export type CostModel = 'cpc' | 'cpa' | 'cpm' | 'revshare' | 'fixed' | 'unknown'

export function parseCostModel(raw: string): CostModel {
  const v = raw.toLowerCase().trim()
  if (['cpc', 'cpa', 'cpm', 'revshare', 'fixed'].includes(v)) return v as CostModel
  return 'unknown'
}

function costModelLabel(m: CostModel): string {
  switch (m) {
    case 'cpc':     return 'CPC (оплата за клік)'
    case 'cpm':     return 'CPM (оплата за 1000 показів)'
    case 'cpa':     return 'CPA (оплата за дію)'
    case 'revshare':return 'RevShare (% від доходу)'
    case 'fixed':   return 'Fixed (фіксована вартість)'
    default:        return 'невідома модель витрат'
  }
}

export function buildRecommendation(
  status: CampaignStatus,
  type: CampaignType,
  cost: number,
  clicks: number,
  conversions: number,
  cpa: number,
  roi: number,
  cr: number,
  cpc: number,
  costModel: CostModel,
  paybackMonths: number | null,
): string {
  if (type === 'app') {
    const parts = [
      `Кампанія ${costModelLabel(costModel)} (APP/PWA): основна задача — маршрутизація та фільтрація трафіку, CPA-аналітика не застосовується.`,
    ]
    if (clicks > 0) {
      const cpcNote = costModel === 'cpc' && cpc > 0 ? `, CPC $${cpc.toFixed(3)}` : ''
      parts.push(`Трафік: ${clicks.toLocaleString()} кліків, витрати $${cost.toFixed(0)}${cpcNote}.`)
      if (conversions > 0) parts.push(`Прохідність (FLOW): ${conversions.toLocaleString()} подій, CR ${cr.toFixed(2)}%.`)
      else parts.push('Конверсії не відстежуються — це нормально для routing-кампаній.')
    }
    return parts.join(' ')
  }

  if (type !== 'offer') {
    const labels: Record<CampaignType, string> = {
      cloak:         'CLOAK (вхідна фільтрація)',
      offer_manager: 'OFFER MANAGER (розподіл між офферами)',
      funnel_owner:  'FUNNEL OWNER (редіректи на продукти)',
      default_app:   'DEFAULT APP (органічний трафік)',
      app: 'APP/PWA', offer: 'OFFER', unknown: 'невідомий тип',
    }
    const costPart = costModel !== 'unknown' ? ` Модель витрат: ${costModelLabel(costModel)}.` : ''
    return `Інфраструктурна кампанія типу ${labels[type]}. Трафік: ${clicks.toLocaleString()} кліків.${costPart} CPA/ROI аналітика не застосовується.`
  }

  // offer type
  const parts: string[] = []
  if (costModel === 'cpc') parts.push(`Модель: CPC ($${cpc > 0 ? cpc.toFixed(3) : '?'}/клік).`)
  else if (costModel === 'revshare') parts.push('Модель: RevShare — трафік-сорс бере % від доходу.')
  else if (costModel === 'cpm') parts.push(`Модель: CPM ($${cpc > 0 ? (cpc * 1000).toFixed(2) : '?'}/1000 показів).`)

  if (conversions === 0) {
    parts.push(`За вказаний період нема конверсій при витратах $${cost.toFixed(0)}. Перевір постбэк і налаштування оффера.`)
  } else {
    if (roi >= 0) parts.push(`CPA $${cpa.toFixed(0)}, ROI ${roi.toFixed(0)}% — кампанія прибуткова. Якщо CPA нижче еталону по гео — масштабуй бюджет.`)
    else parts.push(`CPA $${cpa.toFixed(0)}, ROI ${roi.toFixed(0)}% — кампанія збиткова. Оптимізуй ставки та тестуй нові креативи.`)
  }

  if (paybackMonths !== null && conversions > 0) {
    if (paybackMonths <= TARGET_PAYBACK_MONTHS) {
      parts.push(`Окупність ~${paybackMonths.toFixed(1)} міс. — вкладається в норму ${TARGET_PAYBACK_MONTHS} міс.`)
    } else if (paybackMonths <= MAX_PAYBACK_MONTHS) {
      parts.push(`Окупність ~${paybackMonths.toFixed(1)} міс. — на межі допустимого (max ${MAX_PAYBACK_MONTHS} міс.).`)
    } else {
      parts.push(`Окупність ~${paybackMonths.toFixed(1)} міс. перевищує норму. При поточній динаміці кампанія не окупиться.`)
    }
  }

  if (cr > 0 && cr < 1 && clicks > 500) {
    parts.push(`CR ${cr.toFixed(2)}% нижче 1% при ${clicks.toLocaleString()} кліках — основний потенціал на етапі LP→конверсія.`)
  }
  if (status === 'failed' && conversions > 0) {
    parts.push('Підсумок: кампанія потребує зупинки або повної перебудови.')
  } else if (status === 'decision') {
    parts.push(roi >= 0
      ? 'Підсумок: прибуткова, але не досягає KPI по окупності. Продовжувати з оптимізацією.'
      : 'Підсумок: рішення залежить від LTV-моделі.')
  }
  return parts.join(' ')
}
