import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildGraphData } from '../src/lib/graph-builder.js'
import * as keitaroLib from '../src/lib/keitaro.js'

vi.mock('../src/lib/keitaro.js', async (importOriginal) => {
  const actual = await importOriginal<typeof keitaroLib>()
  return {
    ...actual,
    keitaroRequest: vi.fn(),
  }
})

const mockRequest = vi.mocked(keitaroLib.keitaroRequest)

function makeRow(campaign: string, stream: string, offer: string, clicks = 100, conversions = 5) {
  return { campaign, stream, offer, clicks, conversions, revenue: 500, profit: 100, roi: 25, cr: 5, cpa: 100, cost: 400 }
}

function makeRawStream(id: number, name: string, offerNames: string[], schema = 'landing') {
  return {
    id, name, schema, type: 'position', weight: 100, status: 'active',
    offers: offerNames.map(n => ({ offer_name: n })),
  }
}

describe('buildGraphData', () => {
  beforeEach(() => {
    process.env.KEITARO_URL = 'http://keitaro.test'
    process.env.KEITARO_API_KEY = 'test-key'
    vi.clearAllMocks()
  })

  it('returns empty response when env vars not configured', async () => {
    delete process.env.KEITARO_URL
    delete process.env.KEITARO_API_KEY

    const result = await buildGraphData('2026-03-01', '2026-03-30')

    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
    expect(result.error).toBeDefined()
  })

  it('builds campaign, stream, and offer nodes from report', async () => {
    mockRequest
      .mockResolvedValueOnce([{ id: 1, name: '🟢 Campaign One', state: 'active' }]) // GET /campaigns
      .mockResolvedValueOnce([]) // GET /offers
      .mockResolvedValueOnce({ rows: [makeRow('🟢 Campaign One', 'Stream A', 'Offer X')] }) // POST /report/build
      .mockResolvedValueOnce([makeRawStream(10, 'Stream A', ['Offer X'])]) // GET /campaigns/1/streams

    const result = await buildGraphData('2026-03-01', '2026-03-30')

    expect(result.error).toBeUndefined()
    expect(result.nodes).toHaveLength(3)

    const campaignNode = result.nodes.find(n => n.type === 'campaign')
    expect(campaignNode).toBeDefined()
    expect(campaignNode!.id).toBe('campaign:1')
    expect(campaignNode!.data.label).toBe('🟢 Campaign One')
    expect(campaignNode!.data.campaignType).toBe('offer')

    const streamNode = result.nodes.find(n => n.type === 'stream')
    expect(streamNode).toBeDefined()
    expect(streamNode!.id).toBe('stream:10')
    expect(streamNode!.data.schema).toBe('landing')

    const offerNode = result.nodes.find(n => n.type === 'offer')
    expect(offerNode).toBeDefined()
    expect(offerNode!.data.label).toBe('Offer X')
  })

  it('creates campaign→stream and stream→offer edges', async () => {
    mockRequest
      .mockResolvedValueOnce([{ id: 2, name: 'Campaign B', state: 'active' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ rows: [makeRow('Campaign B', 'Stream B', 'Offer Y', 50, 2)] })
      .mockResolvedValueOnce([makeRawStream(20, 'Stream B', ['Offer Y'])])

    const result = await buildGraphData('2026-03-01', '2026-03-30')

    const campStreamEdge = result.edges.find(e => e.source === 'campaign:2' && e.target === 'stream:20')
    expect(campStreamEdge).toBeDefined()
    expect(campStreamEdge!.clicks).toBe(50)

    const streamOfferEdge = result.edges.find(e => e.source === 'stream:20')
    expect(streamOfferEdge).toBeDefined()
    expect(streamOfferEdge!.target).toMatch(/^offer:/)
  })

  it('aggregates clicks/conversions/cost across streams for campaign node', async () => {
    mockRequest
      .mockResolvedValueOnce([{ id: 3, name: 'Campaign C', state: 'active' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        rows: [
          makeRow('Campaign C', 'S1', 'Offer Z', 100, 3),
          makeRow('Campaign C', 'S2', 'Offer Z', 200, 6),
        ]
      })
      .mockResolvedValueOnce([
        makeRawStream(30, 'S1', ['Offer Z']),
        makeRawStream(31, 'S2', ['Offer Z']),
      ])

    const result = await buildGraphData('2026-03-01', '2026-03-30')

    const camp = result.nodes.find(n => n.type === 'campaign')!
    expect(camp.data.clicks).toBe(300)
    expect(camp.data.conversions).toBe(9)
  })

  it('deduplicates offer nodes when same offer appears in multiple streams', async () => {
    mockRequest
      .mockResolvedValueOnce([{ id: 4, name: 'Campaign D', state: 'active' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        rows: [
          makeRow('Campaign D', 'S1', 'SharedOffer', 100, 5),
          makeRow('Campaign D', 'S2', 'SharedOffer', 50, 2),
        ]
      })
      .mockResolvedValueOnce([
        makeRawStream(40, 'S1', ['SharedOffer']),
        makeRawStream(41, 'S2', ['SharedOffer']),
      ])

    const result = await buildGraphData('2026-03-01', '2026-03-30')

    const offerNodes = result.nodes.filter(n => n.type === 'offer')
    expect(offerNodes).toHaveLength(1)
    expect(offerNodes[0].data.clicks).toBe(150)
  })

  it('normalizes stream schema names', async () => {
    mockRequest
      .mockResolvedValueOnce([{ id: 5, name: 'Camp E', state: 'active' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ rows: [makeRow('Camp E', 'S', 'O')] })
      .mockResolvedValueOnce([{
        id: 50, name: 'S', schema: 'prelanding_landings',
        type: 'position', weight: 100, status: 'active',
        offers: [{ offer_name: 'O' }],
      }])

    const result = await buildGraphData('2026-03-01', '2026-03-30')

    const stream = result.nodes.find(n => n.type === 'stream')!
    expect(stream.data.schema).toBe('prelanding+landing')
  })

  it('all nodes start with position {x:0, y:0} (layout applied separately)', async () => {
    mockRequest
      .mockResolvedValueOnce([{ id: 6, name: 'Camp F', state: 'active' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ rows: [makeRow('Camp F', 'S', 'O')] })
      .mockResolvedValueOnce([makeRawStream(60, 'S', ['O'])])

    const result = await buildGraphData('2026-03-01', '2026-03-30')

    for (const node of result.nodes) {
      expect(node.position).toEqual({ x: 0, y: 0 })
    }
  })
})
