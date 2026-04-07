import dagre from 'dagre'
import type { GraphNode, GraphEdge } from '@aap/types'

const NODE_WIDTH  = 260
const NODE_HEIGHT = 120

interface DagreOptions { rankdir?: 'LR' | 'TB'; nodesep?: number; ranksep?: number }

export function applyDagreLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  opts: DagreOptions = {},
): GraphNode[] {
  if (nodes.length === 0) return nodes
  const { rankdir = 'LR', nodesep = 24, ranksep = 220 } = opts

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir, nodesep, ranksep, marginx: 40, marginy: 40 })

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  return nodes.map(node => {
    const pos = g.node(node.id)
    if (!pos) return node
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH  / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    }
  })
}
