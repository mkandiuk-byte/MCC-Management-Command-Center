import { describe, it, expect } from 'vitest'
import { applyDagreLayout } from '../src/lib/layout.js'
import type { GraphNode, GraphEdge } from '@aap/types'

function makeNode(id: string, type: GraphNode['type']): GraphNode {
  return {
    id, type, position: { x: 0, y: 0 },
    data: { label: id, type, clicks: 0, conversions: 0, revenue: 0, profit: 0, roi: 0, cr: 0, cpa: 0, cost: 0 },
  }
}

function makeEdge(id: string, source: string, target: string): GraphEdge {
  return { id, source, target, clicks: 0, conversions: 0 }
}

describe('applyDagreLayout', () => {
  it('returns empty array for empty input', () => {
    expect(applyDagreLayout([], [])).toEqual([])
  })

  it('returns node with same id as input', () => {
    const result = applyDagreLayout([makeNode('campaign:1', 'campaign')], [])
    expect(result[0].id).toBe('campaign:1')
  })

  it('assigns non-zero positions when graph has edges', () => {
    const nodes = [
      makeNode('campaign:1', 'campaign'),
      makeNode('stream:10', 'stream'),
      makeNode('offer:X', 'offer'),
    ]
    const edges = [
      makeEdge('e1', 'campaign:1', 'stream:10'),
      makeEdge('e2', 'stream:10', 'offer:X'),
    ]

    const result = applyDagreLayout(nodes, edges)

    // At least some nodes should have non-zero x positions
    const hasNonZero = result.some(n => n.position.x !== 0 || n.position.y !== 0)
    expect(hasNonZero).toBe(true)
  })

  it('places campaigns left of streams (rankdir LR)', () => {
    const nodes = [
      makeNode('campaign:1', 'campaign'),
      makeNode('stream:10', 'stream'),
      makeNode('offer:X', 'offer'),
    ]
    const edges = [
      makeEdge('e1', 'campaign:1', 'stream:10'),
      makeEdge('e2', 'stream:10', 'offer:X'),
    ]

    const result = applyDagreLayout(nodes, edges)
    const campaign = result.find(n => n.id === 'campaign:1')!
    const stream = result.find(n => n.id === 'stream:10')!
    const offer = result.find(n => n.id === 'offer:X')!

    expect(campaign.position.x).toBeLessThan(stream.position.x)
    expect(stream.position.x).toBeLessThan(offer.position.x)
  })

  it('does not throw for isolated nodes (no edges)', () => {
    const nodes = [
      makeNode('campaign:1', 'campaign'),
      makeNode('campaign:2', 'campaign'),
    ]
    expect(() => applyDagreLayout(nodes, [])).not.toThrow()
  })

  it('preserves all input node ids', () => {
    const nodes = [
      makeNode('campaign:1', 'campaign'),
      makeNode('stream:10', 'stream'),
      makeNode('offer:X', 'offer'),
    ]
    const edges = [
      makeEdge('e1', 'campaign:1', 'stream:10'),
      makeEdge('e2', 'stream:10', 'offer:X'),
    ]

    const result = applyDagreLayout(nodes, edges)
    const ids = result.map(n => n.id).sort()
    expect(ids).toEqual(['campaign:1', 'offer:X', 'stream:10'])
  })

  it('positions multiple streams vertically spread (non-zero y spread)', () => {
    const nodes = [
      makeNode('campaign:1', 'campaign'),
      makeNode('stream:10', 'stream'),
      makeNode('stream:11', 'stream'),
      makeNode('stream:12', 'stream'),
    ]
    const edges = [
      makeEdge('e1', 'campaign:1', 'stream:10'),
      makeEdge('e2', 'campaign:1', 'stream:11'),
      makeEdge('e3', 'campaign:1', 'stream:12'),
    ]

    const result = applyDagreLayout(nodes, edges)
    const streamPositions = result.filter(n => n.type === 'stream').map(n => n.position.y)
    const allSame = streamPositions.every(y => y === streamPositions[0])
    expect(allSame).toBe(false)
  })
})
