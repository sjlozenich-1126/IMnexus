import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  GitFork,
  Layers,
  Network,
  ShieldCheck,
  Tag,
  Users,
} from 'lucide-react';
import type { NexusGraphData, NexusNode, NexusNodeKind } from '../utils/nexusEngine';

interface NexusMapViewProps {
  graph: NexusGraphData;
  subtitle?: string;
  onSelectCaseId?: (caseId: string) => void;
  onInspectNodeArtifact?: (node: NexusNode) => void;
  compact?: boolean;
}

const KIND_LABELS: Record<NexusNodeKind, string> = {
  case: 'Case / Core',
  actor: 'Actors',
  timeline: 'Timeline',
  collection: 'Collections',
  document: 'Documents',
  evidence: 'Evidence',
  tag: 'Shared Tags',
};

const KIND_MARKER: Record<
  NexusNodeKind,
  { shape: 'diamond' | 'square' | 'circle'; strokeLight: string; strokeDark: string; fillLight: string; fillDark: string }
> = {
  case: {
    shape: 'diamond',
    strokeLight: '#0f1210',
    strokeDark: '#f3f0e9',
    fillLight: '#1a2e24',
    fillDark: '#f3f0e9',
  },
  actor: {
    shape: 'circle',
    strokeLight: '#2d5a3d',
    strokeDark: '#7fb892',
    fillLight: '#faf8f4',
    fillDark: '#161916',
  },
  timeline: {
    shape: 'square',
    strokeLight: '#7a642e',
    strokeDark: '#d4bc7d',
    fillLight: '#faf8f4',
    fillDark: '#161916',
  },
  collection: {
    shape: 'diamond',
    strokeLight: '#1a2e24',
    strokeDark: '#a8c4b0',
    fillLight: '#e9e5db',
    fillDark: '#1f2621',
  },
  document: {
    shape: 'square',
    strokeLight: '#6a716b',
    strokeDark: '#9ca39d',
    fillLight: '#faf8f4',
    fillDark: '#161916',
  },
  evidence: {
    shape: 'circle',
    strokeLight: '#0f1210',
    strokeDark: '#d8d3c8',
    fillLight: '#f3f0e9',
    fillDark: '#1f2420',
  },
  tag: {
    shape: 'diamond',
    strokeLight: '#8b3a3a',
    strokeDark: '#d17b7b',
    fillLight: '#faf8f4',
    fillDark: '#1c1515',
  },
};

export const NexusMapView: React.FC<NexusMapViewProps> = ({
  graph,
  subtitle,
  onSelectCaseId,
  onInspectNodeArtifact,
  compact = false,
}) => {
  const [kindFilter, setKindFilter] = useState<'all' | NexusNodeKind>('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    () => graph.nodes.find((n) => n.kind === 'case')?.id || graph.nodes[0]?.id || null
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const nodeMap = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);

  const visibleNodes = useMemo(() => {
    if (kindFilter === 'all') return graph.nodes;
    return graph.nodes.filter((n) => n.kind === kindFilter || n.kind === 'case');
  }, [graph.nodes, kindFilter]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleEdges = useMemo(
    () =>
      graph.edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)),
    [graph.edges, visibleNodeIds]
  );

  const activeNodeId = hoveredNodeId || selectedNodeId;

  const connectedToActive = useMemo(() => {
    if (!activeNodeId) return new Set<string>();
    const set = new Set<string>([activeNodeId]);
    for (const e of visibleEdges) {
      if (e.source === activeNodeId) set.add(e.target);
      if (e.target === activeNodeId) set.add(e.source);
    }
    return set;
  }, [activeNodeId, visibleEdges]);

  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) || null : null;

  const selectedConnections = useMemo(() => {
    if (!selectedNode) return [];
    return graph.edges
      .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
      .map((e) => {
        const otherId = e.source === selectedNode.id ? e.target : e.source;
        const other = nodeMap.get(otherId);
        return other ? { edge: e, node: other } : null;
      })
      .filter((x): x is { edge: (typeof graph.edges)[number]; node: NexusNode } => Boolean(x));
  }, [selectedNode, graph.edges, nodeMap]);

  const availableKinds = useMemo(() => {
    const present = new Set<NexusNodeKind>(graph.nodes.map((n) => n.kind));
    return (['case', 'actor', 'timeline', 'collection', 'document', 'evidence', 'tag'] as NexusNodeKind[]).filter(
      (k) => present.has(k)
    );
  }, [graph.nodes]);

  if (graph.nodes.length === 0) {
    return (
      <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-8 text-center">
        <Network className="w-6 h-6 text-[#6a716b] mx-auto mb-2" />
        <p className="text-xs text-[#6a716b] dark:text-[#8d948e]">
          Add cases, actors, timeline events, tags, or vault items to generate a visual Nexus connection map.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header & Layer Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0f1210] dark:text-[#f3f0e9]">
            <GitFork className="w-3.5 h-3.5 text-[#1a2e24] dark:text-[#7fb892]" />
            <span>{graph.title}</span>
          </div>
          {subtitle && (
            <p className="text-xs text-[#6a716b] dark:text-[#8d948e] mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setKindFilter('all')}
            className={`px-2.5 py-1 text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap ${
              kindFilter === 'all'
                ? 'bg-[#0f1210] text-[#faf8f4] border-[#0f1210] dark:bg-[#f3f0e9] dark:text-[#0f1210] dark:border-[#f3f0e9]'
                : 'bg-[#faf8f4] dark:bg-[#161916] text-[#6a716b] dark:text-[#8d948e] border-[#ddd8ce] dark:border-[#262b27] hover:border-[#0f1210]'
            }`}
          >
            All Layers ({graph.nodes.length})
          </button>
          {availableKinds.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setKindFilter(kind)}
              className={`px-2.5 py-1 text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                kindFilter === kind
                  ? 'bg-[#0f1210] text-[#faf8f4] border-[#0f1210] dark:bg-[#f3f0e9] dark:text-[#0f1210] dark:border-[#f3f0e9]'
                  : 'bg-[#faf8f4] dark:bg-[#161916] text-[#6a716b] dark:text-[#8d948e] border-[#ddd8ce] dark:border-[#262b27] hover:border-[#0f1210]'
              }`}
            >
              {KIND_LABELS[kind]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Graph + Node Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Interactive SVG Nexus Diagram */}
        <div className="lg:col-span-8 bg-[#faf8f4] dark:bg-[#111413] border border-[#ddd8ce] dark:border-[#262b27] relative overflow-hidden">
          {/* Subtle architectural crosshair axis */}
          <svg
            viewBox="0 0 1000 580"
            className={`w-full ${compact ? 'h-[360px] sm:h-[420px]' : 'h-[400px] sm:h-[490px]'} select-none`}
            role="img"
            aria-label="Interactive IMnexus connection diagram"
          >
            {/* Axis Grid Hairlines */}
            <line
              x1="500"
              y1="20"
              x2="500"
              y2="560"
              className="stroke-[#e9e5db] dark:stroke-[#1d221e]"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
            <line
              x1="30"
              y1="290"
              x2="970"
              y2="290"
              className="stroke-[#e9e5db] dark:stroke-[#1d221e]"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
            <ellipse
              cx="500"
              cy="290"
              rx="220"
              ry="135"
              fill="none"
              className="stroke-[#e9e5db] dark:stroke-[#1d221e]"
              strokeWidth="1"
            />
            <ellipse
              cx="500"
              cy="290"
              rx="385"
              ry="225"
              fill="none"
              className="stroke-[#e9e5db] dark:stroke-[#1d221e]"
              strokeWidth="1"
            />

            {/* Quadrant Annotations */}
            <text
              x="28"
              y="32"
              className="fill-[#6a716b] dark:fill-[#6f7870] text-[10px] uppercase tracking-[0.12em] font-medium"
            >
              Actors &amp; Entities
            </text>
            <text
              x="972"
              y="32"
              textAnchor="end"
              className="fill-[#6a716b] dark:fill-[#6f7870] text-[10px] uppercase tracking-[0.12em] font-medium"
            >
              Timeline Chronology
            </text>
            <text
              x="28"
              y="558"
              className="fill-[#6a716b] dark:fill-[#6f7870] text-[10px] uppercase tracking-[0.12em] font-medium"
            >
              Curated Collections
            </text>
            <text
              x="972"
              y="558"
              textAnchor="end"
              className="fill-[#6a716b] dark:fill-[#6f7870] text-[10px] uppercase tracking-[0.12em] font-medium"
            >
              Documents &amp; Evidence
            </text>

            {/* Edges */}
            {visibleEdges.map((edge) => {
              const src = nodeMap.get(edge.source);
              const tgt = nodeMap.get(edge.target);
              if (!src || !tgt) return null;
              const isHighlighted =
                activeNodeId !== null &&
                (edge.source === activeNodeId || edge.target === activeNodeId);
              const isDimmed = activeNodeId !== null && !isHighlighted;

              return (
                <line
                  key={edge.id}
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  strokeWidth={isHighlighted ? 1.8 : edge.strength === 2 ? 1.1 : 0.9}
                  strokeDasharray={edge.strength === 1 ? '4 3' : undefined}
                  className={
                    isHighlighted
                      ? 'stroke-[#1a2e24] dark:stroke-[#f3f0e9] transition-opacity duration-150'
                      : isDimmed
                      ? 'stroke-[#ddd8ce]/45 dark:stroke-[#262b27]/45 transition-opacity duration-150'
                      : 'stroke-[#c9c3b6] dark:stroke-[#323833] transition-opacity duration-150'
                  }
                />
              );
            })}

            {/* Nodes */}
            {visibleNodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isActive = connectedToActive.has(node.id);
              const isDimmed = activeNodeId !== null && !isActive;
              const spec = KIND_MARKER[node.kind];
              const size = node.kind === 'case' ? 14 : node.kind === 'collection' ? 10 : 8;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => setSelectedNodeId(node.id)}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{ cursor: 'pointer', opacity: isDimmed ? 0.35 : 1 }}
                  className="transition-opacity duration-150"
                >
                  {/* Selection halo */}
                  {isSelected && (
                    <circle
                      r={size + 6}
                      fill="none"
                      strokeWidth="1"
                      className="stroke-[#1a2e24] dark:stroke-[#f3f0e9]"
                    />
                  )}

                  {spec.shape === 'diamond' ? (
                    <polygon
                      points={`0,${-size} ${size},0 0,${size} ${-size},0`}
                      strokeWidth={node.kind === 'case' ? 1.8 : 1.3}
                      style={{
                        stroke: isSelected ? undefined : spec.strokeLight,
                        fill: node.kind === 'case' ? spec.fillLight : undefined,
                      }}
                      className={
                        node.kind === 'case'
                          ? 'fill-[#1a2e24] stroke-[#0f1210] dark:fill-[#f3f0e9] dark:stroke-[#f3f0e9]'
                          : 'fill-[#faf8f4] stroke-[#1a2e24] dark:fill-[#1c211d] dark:stroke-[#a8c4b0]'
                      }
                    />
                  ) : spec.shape === 'square' ? (
                    <rect
                      x={-size}
                      y={-size}
                      width={size * 2}
                      height={size * 2}
                      strokeWidth="1.3"
                      className={
                        node.kind === 'timeline'
                          ? 'fill-[#faf8f4] stroke-[#7a642e] dark:fill-[#161916] dark:stroke-[#d4bc7d]'
                          : 'fill-[#faf8f4] stroke-[#6a716b] dark:fill-[#161916] dark:stroke-[#9ca39d]'
                      }
                    />
                  ) : (
                    <circle
                      r={size}
                      strokeWidth="1.3"
                      className={
                        node.kind === 'actor'
                          ? 'fill-[#faf8f4] stroke-[#2d5a3d] dark:fill-[#161916] dark:stroke-[#7fb892]'
                          : 'fill-[#f3f0e9] stroke-[#0f1210] dark:fill-[#1e2420] dark:stroke-[#d8d3c8]'
                      }
                    />
                  )}

                  {/* Label Pillless Crisp Tag */}
                  <text
                    y={size + 13}
                    textAnchor="middle"
                    className={`text-[10.5px] font-medium ${
                      isSelected
                        ? 'fill-[#0f1210] dark:fill-[#f3f0e9] font-semibold'
                        : 'fill-[#0f1210]/85 dark:fill-[#e5e1d8]/90'
                    }`}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Subtle Bottom Legend */}
          <div className="px-4 py-2.5 border-t border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9]/60 dark:bg-[#0c0e0c]/70 flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#6a716b] dark:text-[#8d948e]">
            <div className="flex flex-wrap items-center gap-3">
              <span>◆ Case / Collection</span>
              <span>● Actor / Evidence</span>
              <span>■ Timeline / Document</span>
              <span>--- Semantic / Tag Pattern</span>
            </div>
            <span className="font-mono-tabular">
              {visibleNodes.length} nodes · {visibleEdges.length} links
            </span>
          </div>
        </div>

        {/* Selected Node Inspector Rail */}
        <div className="lg:col-span-4 bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-4 flex flex-col justify-between">
          {!selectedNode ? (
            <div className="text-xs text-[#6a716b] dark:text-[#8d948e] my-auto text-center p-6">
              Select any node on the Nexus diagram to inspect its connected actors, timeline events, tags, and evidence.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="pb-3 border-b border-[#e9e5db] dark:border-[#242924]">
                <div className="text-[10px] uppercase tracking-[0.1em] text-[#6a716b] dark:text-[#8d948e] mb-1">
                  {KIND_LABELS[selectedNode.kind]} · {selectedNode.degree} connections
                </div>
                <h4 className="text-sm font-semibold text-[#0f1210] dark:text-[#f3f0e9]">
                  {selectedNode.label}
                </h4>
                {selectedNode.subtitle && (
                  <p className="text-xs text-[#6a716b] dark:text-[#8d948e] mt-0.5">
                    {selectedNode.subtitle}
                  </p>
                )}
              </div>

              {selectedNode.description && (
                <p className="text-xs text-[#0f1210]/80 dark:text-[#f3f0e9]/80 leading-relaxed line-clamp-4">
                  {selectedNode.description}
                </p>
              )}

              <div>
                <div className="text-[10px] uppercase tracking-[0.1em] text-[#6a716b] dark:text-[#8d948e] mb-2">
                  Connected Records ({selectedConnections.length})
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-[#e9e5db] dark:divide-[#242924] border border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9]/50 dark:bg-[#0c0e0c]/50">
                  {selectedConnections.length === 0 ? (
                    <div className="p-3 text-xs text-[#6a716b]">No direct links in this filter.</div>
                  ) : (
                    selectedConnections.map(({ edge, node }) => (
                      <button
                        key={edge.id}
                        type="button"
                        onClick={() => setSelectedNodeId(node.id)}
                        className="w-full text-left px-3 py-2 hover:bg-[#faf8f4] dark:hover:bg-[#1c201c] flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-[#0f1210] dark:text-[#f3f0e9] truncate">
                            {node.label}
                          </div>
                          <div className="text-[10px] text-[#6a716b] dark:text-[#8d948e] truncate">
                            {edge.relation}
                          </div>
                        </div>
                        <span className="text-[10px] uppercase text-[#6a716b] shrink-0">
                          {node.kind}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Quick Jump Action */}
              <div className="pt-2 flex flex-wrap gap-2">
                {selectedNode.kind === 'case' && selectedNode.refId && onSelectCaseId && (
                  <button
                    type="button"
                    onClick={() => onSelectCaseId(selectedNode.refId!)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#0f1210] text-[#faf8f4] dark:bg-[#f3f0e9] dark:text-[#0f1210] hover:opacity-85 cursor-pointer"
                  >
                    <span>Open Case Workspace</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {(selectedNode.kind === 'document' || selectedNode.kind === 'evidence') &&
                  onInspectNodeArtifact && (
                    <button
                      type="button"
                      onClick={() => onInspectNodeArtifact(selectedNode)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] text-[#0f1210] dark:text-[#f3f0e9] hover:border-[#0f1210] cursor-pointer"
                    >
                      <span>Inspect Artifact</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detected Patterns & Insights Row */}
      {graph.insights.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {graph.insights.map((ins) => {
            const Icon =
              ins.category === 'bridge'
                ? Users
                : ins.category === 'pattern'
                ? Tag
                : ins.category === 'coverage'
                ? Layers
                : ShieldCheck;
            return (
              <button
                key={ins.id}
                type="button"
                onClick={() => {
                  if (ins.focusNodeId && nodeMap.has(ins.focusNodeId)) {
                    setSelectedNodeId(ins.focusNodeId);
                  }
                }}
                className={`text-left bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-3.5 transition-colors ${
                  ins.focusNodeId
                    ? 'hover:border-[#0f1210] dark:hover:border-[#8d948e] cursor-pointer'
                    : 'cursor-default'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-[#6a716b] dark:text-[#8d948e] mb-1">
                  <Icon className="w-3 h-3 text-[#2d5a3d] dark:text-[#7fb892]" />
                  <span>{ins.category}</span>
                </div>
                <div className="text-xs font-semibold text-[#0f1210] dark:text-[#f3f0e9] mb-1">
                  {ins.title}
                </div>
                <p className="text-[11px] text-[#6a716b] dark:text-[#8d948e] leading-relaxed">
                  {ins.detail}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
