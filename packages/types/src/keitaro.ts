// ─── Keitaro Offers ───────────────────────────────────────────────────────────

export type OfferStatus = 'success' | 'failed' | 'decision' | 'no_data'

export interface OfferStats {
  clicks: number
  conversions: number
  revenue: number
  profit: number
  roi: number
  cr: number
  cpa: number
  cost: number
}

export interface FunnelStat {
  streamId: number
  streamName: string
  campaignName: string
  campaignId: number
  schema: string
  streamType: string
  weight: number
  streamStatus: string
  clicks: number
  conversions: number
  revenue: number
  profit: number
  roi: number
  cr: number
  cpa: number
  cost: number
  recommendation: string
}

export interface OfferView {
  name: string
  status: OfferStatus
  stats: OfferStats
  recommendation: string
  funnels: FunnelStat[]
}

export interface OffersResponse {
  offers: OfferView[]
  period: { from: string; to: string }
  lastUpdated: string
  error?: string
}

// ─── Keitaro Campaigns ────────────────────────────────────────────────────────

export type CampaignType = 'offer' | 'app' | 'cloak' | 'funnel_owner' | 'offer_manager' | 'default_app' | 'unknown'
export type CampaignStatus = 'success' | 'failed' | 'decision' | 'no_data'
export type CostModel = 'cpc' | 'cpa' | 'cpm' | 'revshare' | 'fixed' | 'unknown'

export interface CampaignStats {
  clicks: number
  conversions: number
  revenue: number
  profit: number
  roi: number
  cr: number
  cpc: number
  cpa: number
  cost: number
  leads: number
  sales: number
}

export interface OfferStat {
  name: string
  clicks: number
  conversions: number
  revenue: number
  profit: number
  roi: number
  cr: number
  cpa: number
  cost: number
  shareClicks: number
}

export interface StreamInfo {
  id: number
  name: string
  schema: string
  status: string
  position: number
  weight: number
  offerNames: string[]
}

export interface CampaignStreamsResponse {
  streams: StreamInfo[]
  error?: string
}

export interface EnrichedCampaign {
  id: number
  name: string
  alias: string
  state: string
  group_id: number
  geo: string
  campaignType: CampaignType
  costModel: CostModel
  domain: string
  trafficSourceId: number
  rotationType: string
  status: CampaignStatus
  stats: CampaignStats
  paybackMonths: number | null
  recommendation: string
  offerBreakdown: OfferStat[]
}

export interface CampaignsResponse {
  campaigns: EnrichedCampaign[]
  period: { from: string; to: string }
  lastUpdated: string
  error?: string
}

export interface KeitaroDashboardResponse {
  campaigns: EnrichedCampaign[]
  summary: {
    total: number
    active: number
    success: number
    failed: number
    decision: number
    no_data: number
  }
  period: { from: string; to: string }
  lastUpdated: string
  error?: string
}

export type CostModelType = CostModel

// ─── Keitaro Geo Benchmarks ───────────────────────────────────────────────────

export interface GeoBenchmark {
  geo: string
  count: number
  avgCpa: number
  minCpa: number
  maxCpa: number
}

export interface GeoBenchmarksResponse {
  benchmarks: GeoBenchmark[]
  period: { from: string; to: string }
  lastUpdated: string
  error?: string
}
