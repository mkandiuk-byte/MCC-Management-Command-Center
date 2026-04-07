"use client"

import { useMemo } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, type NodeTypes,
} from '@xyflow/react'
import { AdCampaignNode, CampaignNode, CloakCampaignNode, OfferChainNode } from './chain-nodes'

function useDarkMode() {
  if (typeof document === 'undefined') return true
  return document.documentElement.classList.contains('dark')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: NodeTypes = {
  adCampaign:    AdCampaignNode    as any,
  campaign:      CampaignNode      as any,
  cloakCampaign: CloakCampaignNode as any,
  offer:         OfferChainNode    as any,
}

function nodeColor(n: Node): string {
  if (n.type === 'adCampaign')    return '#818cf8'
  if (n.type === 'campaign')      return '#f59e0b'
  if (n.type === 'cloakCampaign') return '#f97316'
  return '#10b981'
}

interface Props {
  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null
  onSelectNode: (id: string | null) => void
}

export default function ChainCanvas({ nodes: rawNodes, edges: rawEdges, selectedNodeId, onSelectNode }: Props) {
  const dark = useDarkMode()

  const flowNodes: Node[] = useMemo(() => rawNodes.map(n => ({
    ...n,
    data: { ...n.data, selected: n.id === selectedNodeId },
    className: selectedNodeId && n.id !== selectedNodeId &&
      !rawEdges.some(e => (e.source === selectedNodeId && e.target === n.id) || (e.target === selectedNodeId && e.source === n.id))
        ? 'opacity-20 transition-opacity duration-150'
        : 'transition-opacity duration-150',
    draggable: true,
    selectable: true,
  })), [rawNodes, selectedNodeId, rawEdges])

  const flowEdges: Edge[] = useMemo(() => rawEdges.map(e => ({
    ...e,
    animated: false,
    style: {
      ...(e.style as object ?? {}),
      opacity: selectedNodeId && e.source !== selectedNodeId && e.target !== selectedNodeId ? 0.08 : 0.7,
      transition: 'opacity 150ms',
    },
    label: e.data?.clicks ? `${Number(e.data.clicks) >= 1000 ? `${(Number(e.data.clicks) / 1000).toFixed(1)}k` : e.data.clicks}` : undefined,
    labelStyle: { fontSize: 9, fill: '#9ca3af' },
    labelBgStyle: { fill: 'transparent' },
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
      fitViewOptions={{ padding: 0.1 }}
      minZoom={0.03}
      maxZoom={2}
      nodesDraggable
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
