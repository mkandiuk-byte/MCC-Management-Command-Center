// ─── Keitaro Graph Visualization ──────────────────────────────────────────────

export type GraphNodeType = 'campaign' | 'stream' | 'offer'

export interface GraphNodeData {
  label: string
  type: GraphNodeType
  // stats (all node types)
  clicks: number
  conversions: number
  revenue: number
  profit: number
  roi: number
  cr: number
  cpa: number
  cost: number
  // campaign-specific
  campaignType?: string
  state?: string
  // stream-specific
  schema?: string
  weight?: number
  streamStatus?: string
  campaignId?: number
  // offer-specific (parsed from name)
  offerBrand?: string
  offerGeo?: string
  offerSource?: string
  offerLandingType?: string
  offerTier?: string
  offerConvAction?: string
  offerNetwork?: string
  offerBonus?: string
  offerCountry?: string[]
  offerPayoutUpsell?: boolean
}

export interface GraphNode {
  id: string
  type: GraphNodeType
  position: { x: number; y: number }
  data: GraphNodeData
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  clicks: number
  conversions: number
}

export interface GraphResponse {
  nodes: GraphNode[]
  edges: GraphEdge[]
  period: { from: string; to: string }
  lastUpdated: string
  error?: string
  meta?: {
    totalStreams?: number
    totalOffers?: number
    shownStreams?: number
    shownOffers?: number
  }
}
