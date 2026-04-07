"use client"

import { useMemo } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, type NodeTypes,
} from '@xyflow/react'
import { StreamNode, OfferNode } from './graph-nodes'
import type { GraphNode, GraphEdge } from '@aap/types'

// Detect dark mode from the <html> class set by next-themes
function useDarkMode() {
  if (typeof document === 'undefined') return true
  return document.documentElement.classList.contains('dark')
}

const nodeTypes: NodeTypes = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stream: StreamNode as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  offer:  OfferNode  as any,
}

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
  selectedNodeId: string | null
  onSelectNode: (id: string | null) => void
}

function nodeColor(node: Node): string {
  return node.type === 'stream' ? '#f59e0b' : '#10b981'
}

export default function GraphCanvas({ nodes: rawNodes, edges: rawEdges, selectedNodeId, onSelectNode }: Props) {
  const dark = useDarkMode()
  const flowNodes: Node[] = useMemo(() => rawNodes.map(n => ({
    id: n.id, type: n.type, position: n.position,
    data: { ...n.data, selected: n.id === selectedNodeId },
    className: selectedNodeId && n.id !== selectedNodeId &&
      !rawEdges.some(e => (e.source === selectedNodeId && e.target === n.id) || (e.target === selectedNodeId && e.source === n.id))
        ? 'opacity-25 transition-opacity duration-150'
        : 'transition-opacity duration-150',
    draggable: false,
    selectable: true,
  })), [rawNodes, selectedNodeId, rawEdges])

  const flowEdges: Edge[] = useMemo(() => rawEdges.map(e => ({
    id: e.id, source: e.source, target: e.target,
    animated: e.clicks > 0,
    style: selectedNodeId && e.source !== selectedNodeId && e.target !== selectedNodeId
      ? { opacity: 0.08, transition: 'opacity 150ms' }
      : { strokeWidth: 2, transition: 'opacity 150ms' },
  })), [rawEdges, selectedNodeId])

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onSelectNode(selectedNodeId === node.id ? null : node.id)}
      onPaneClick={() => onSelectNode(null)}
      colorMode={dark ? 'dark' : 'light'}
      fitView
      fitViewOptions={{ padding: 0.12 }}
      minZoom={0.05}
      maxZoom={2}
      nodesDraggable={false}
      nodesConnectable={false}
      proOptions={{ hideAttribution: true }}
    >
      <Background color={dark ? '#374151' : '#e5e7eb'} gap={20} />
      <Controls showInteractive={false} />
      <MiniMap
        nodeColor={nodeColor}
        maskColor={dark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.04)'}
        style={dark ? { background: '#1f2937' } : undefined}
      />
    </ReactFlow>
  )
}
