import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Calendar,
  GitFork,
  Grid3X3,
  Layers,
  Network,
  ShieldCheck,
  Tag,
  Users,
} from 'lucide-react';
import {
  computeNexusAxisMatrix,
  type NexusAxisDimension,
  type NexusGraphData,
  type NexusMatrixCell,
  type NexusNode,
  type NexusNodeKind,
} from '../utils/nexusEngine';

interface NexusMapViewProps {
  graph: NexusGraphData;
  subtitle?: string;
  onSelectCaseId?: (caseId: string) => void;
  onInspectNodeArtifact?: (node: NexusNode) => void;
  compact?: boolean;
}

type NexusViewMode = 'constellation' | 'matrix' | 'chronology';

const KIND_LABELS: Record<NexusNodeKind, string> = {
  case: 'Cases',
  tag: 'Tags (#)',
  metadata: 'Metadata',
  actor: 'Actors',
  collection: 'Collections',
  timeline: 'Timeline',
  evidence: 'Exhibits',
  document: 'Documents',
};

const AXIS_LABELS: Record<NexusAxisDimension, string> = {
  tag: 'Tags (#)',
  metadata: 'Case Metadata',
  case: 'Cases',
  actor: 'Actors',
  timeline: 'Timeline',
  collection: 'Collections',
  artifact: 'Tagged Records',
};

const KIND_MARKER: Record<
  NexusNodeKind,
  { shape: 'diamond' | 'square' | 'circle' }
> = {
  case: { shape: 'diamond' },
  tag: { shape: 'diamond' },
  metadata: { shape: 'square' },
  actor: { shape: 'circle' },
  timeline: { shape: 'square' },
  collection: { shape: 'diamond' },
  document: { shape: 'square' },
  evidence: { shape: 'circle' },
};

export const NexusMapView: React.FC<NexusMapViewProps> = ({
  graph,
  subtitle,
  onSelectCaseId,
  onInspectNodeArtifact,
  compact = false,
}) => {
  const [viewMode, setViewMode] = useState<NexusViewMode>('constellation');
  const [kindFilter, setKindFilter] = useState<'core' | 'all' | NexusNodeKind>('core');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    () =>
      graph.nodes.find((n) => n.kind === 'tag')?.id ||
      graph.nodes.find((n) => n.kind === 'case')?.id ||
      graph.nodes[0]?.id ||
      null
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Matrix axes state
  const [yAxis, setYAxis] = useState<NexusAxisDimension>(() =>
    graph.scope === 'portfolio' ? 'case' : 'tag'
  );
  const [xAxis, setXAxis] = useState<NexusAxisDimension>(() =>
    graph.scope === 'portfolio' ? 'tag' : 'timeline'
  );
  const [selectedMatrixCell, setSelectedMatrixCell] = useState<NexusMatrixCell | null>(null);

  const nodeMap = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);

  const effectiveSelectedNodeId = useMemo(() => {
    if (selectedNodeId && nodeMap.has(selectedNodeId)) return selectedNodeId;
    return (
      graph.nodes.find((n) => n.kind === 'tag')?.id ||
      graph.nodes.find((n) => n.kind === 'case')?.id ||
      graph.nodes[0]?.id ||
      null
    );
  }, [selectedNodeId, nodeMap, graph.nodes]);

  const availableKinds = useMemo(() => {
    const present = new Set<NexusNodeKind>(graph.nodes.map((n) => n.kind));
    return (
      [
        'tag',
        'metadata',
        'case',
        'actor',
        'collection',
        'timeline',
        'evidence',
        'document',
      ] as NexusNodeKind[]
    ).filter((k) => present.has(k));
  }, [graph.nodes]);

  // Available matrix dimensions that actually have nodes in this graph
  const availableAxes = useMemo(() => {
    const dims: NexusAxisDimension[] = [];
    const has = (k: NexusNodeKind) => graph.nodes.some((n) => n.kind === k);
    if (has('case')) dims.push('case');
    if (has('tag')) dims.push('tag');
    if (has('metadata')) dims.push('metadata');
    if (has('actor')) dims.push('actor');
    if (has('timeline')) dims.push('timeline');
    if (has('collection')) dims.push('collection');
    if (has('evidence') || has('document')) dims.push('artifact');
    return dims;
  }, [graph.nodes]);

  // Resolve effective Y/X axes cleanly even if defaults have 0 nodes
  const effectiveYAxis: NexusAxisDimension = availableAxes.includes(yAxis)
    ? yAxis
    : availableAxes[0] || 'case';
  const effectiveXAxis: NexusAxisDimension = availableAxes.includes(xAxis)
    ? xAxis
    : availableAxes[1] || availableAxes[0] || 'metadata';

  const matrixResult = useMemo(
    () => computeNexusAxisMatrix(graph, effectiveYAxis, effectiveXAxis),
    [graph, effectiveYAxis, effectiveXAxis]
  );

  // Constellation node filtering: 'core' focuses on Tags, Metadata, Cases, Actors, Collections & Timeline without unrequested document spoke noise
  const visibleNodes = useMemo(() => {
    if (kindFilter === 'all') return graph.nodes;
    if (kindFilter === 'core') {
      return graph.nodes.filter((n) => n.kind !== 'document' && n.kind !== 'evidence');
    }
    return graph.nodes.filter((n) => n.kind === kindFilter || n.kind === 'case');
  }, [graph.nodes, kindFilter]);

  const visibleTagNodes = useMemo(
    () => visibleNodes.filter((n) => n.kind === 'tag'),
    [visibleNodes]
  );

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleEdges = useMemo(
    () =>
      graph.edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)),
    [graph.edges, visibleNodeIds]
  );

  const activeNodeId = hoveredNodeId || effectiveSelectedNodeId;

  const connectedToActive = useMemo(() => {
    if (!activeNodeId) return new Set<string>();
    const set = new Set<string>([activeNodeId]);
    for (const e of visibleEdges) {
      if (e.source === activeNodeId) set.add(e.target);
      if (e.target === activeNodeId) set.add(e.source);
    }
    return set;
  }, [activeNodeId, visibleEdges]);

  const selectedNode = effectiveSelectedNodeId ? nodeMap.get(effectiveSelectedNodeId) || null : null;

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

  if (graph.nodes.length === 0) {
    return (
      <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-8 text-center">
        <Network className="w-6 h-6 text-[#6a716b] mx-auto mb-2" />
        <p className="text-xs text-[#6a716b] dark:text-[#8d948e]">
          Add cases, metadata fields, or tags to generate an interactive Nexus relationship map and axis matrix.
        </p>
      </div>
    );
  }

  const presetAxes =
    graph.scope === 'portfolio'
      ? ([
          { label: 'Cases × Tags', y: 'case', x: 'tag' },
          { label: 'Cases × Metadata', y: 'case', x: 'metadata' },
          { label: 'Case Overlap Matrix', y: 'case', x: 'case' },
          { label: 'Tags × Collections', y: 'tag', x: 'collection' },
        ] as Array<{ label: string; y: NexusAxisDimension; x: NexusAxisDimension }>)
      : ([
          { label: 'Tags × Timeline', y: 'tag', x: 'timeline' },
          { label: 'Metadata × Timeline', y: 'metadata', x: 'timeline' },
          { label: 'Actors × Timeline', y: 'actor', x: 'timeline' },
          { label: 'Tags × Collections', y: 'tag', x: 'collection' },
        ] as Array<{ label: string; y: NexusAxisDimension; x: NexusAxisDimension }>);

  return (
    <div className="space-y-4">
      {/* Header + View Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0f1210] dark:text-[#f3f0e9]">
            <GitFork className="w-3.5 h-3.5 text-[#1a2e24] dark:text-[#7fb892]" />
            <span>{graph.title}</span>
          </div>
          {subtitle && (
            <p className="text-xs text-[#6a716b] dark:text-[#8d948e] mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Visualization Mode Tabs */}
        <div className="flex items-center border border-[#ddd8ce] dark:border-[#262b27] bg-[#faf8f4] dark:bg-[#161916] shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              setViewMode('constellation');
              setSelectedMatrixCell(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === 'constellation'
                ? 'bg-[#0f1210] text-[#faf8f4] dark:bg-[#f3f0e9] dark:text-[#0f1210]'
                : 'text-[#6a716b] dark:text-[#8d948e] hover:text-[#0f1210] dark:hover:text-[#f3f0e9]'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Relationship Web</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('matrix')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-l border-[#ddd8ce] dark:border-[#262b27] transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === 'matrix'
                ? 'bg-[#0f1210] text-[#faf8f4] dark:bg-[#f3f0e9] dark:text-[#0f1210]'
                : 'text-[#6a716b] dark:text-[#8d948e] hover:text-[#0f1210] dark:hover:text-[#f3f0e9]'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            <span>Axis Matrix</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode('chronology');
              setSelectedMatrixCell(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-l border-[#ddd8ce] dark:border-[#262b27] transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === 'chronology'
                ? 'bg-[#0f1210] text-[#faf8f4] dark:bg-[#f3f0e9] dark:text-[#0f1210]'
                : 'text-[#6a716b] dark:text-[#8d948e] hover:text-[#0f1210] dark:hover:text-[#f3f0e9]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Chronology Axis</span>
          </button>
        </div>
      </div>

      {/* Mode-Specific Controls */}
      {viewMode === 'constellation' && (
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setKindFilter('core')}
            className={`px-2.5 py-1 text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap ${
              kindFilter === 'core'
                ? 'bg-[#1a2e24] text-[#faf8f4] border-[#1a2e24] dark:bg-[#7fb892] dark:text-[#0c0e0c] dark:border-[#7fb892]'
                : 'bg-[#faf8f4] dark:bg-[#161916] text-[#6a716b] dark:text-[#8d948e] border-[#ddd8ce] dark:border-[#262b27] hover:border-[#0f1210]'
            }`}
          >
            Tags, Metadata &amp; Entities
          </button>
          <button
            type="button"
            onClick={() => setKindFilter('all')}
            className={`px-2.5 py-1 text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap ${
              kindFilter === 'all'
                ? 'bg-[#0f1210] text-[#faf8f4] border-[#0f1210] dark:bg-[#f3f0e9] dark:text-[#0f1210] dark:border-[#f3f0e9]'
                : 'bg-[#faf8f4] dark:bg-[#161916] text-[#6a716b] dark:text-[#8d948e] border-[#ddd8ce] dark:border-[#262b27] hover:border-[#0f1210]'
            }`}
          >
            Include Bridged Docs ({graph.nodes.length})
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
      )}

      {viewMode === 'matrix' && (
        <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="inline-flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.08em] text-[#6a716b] dark:text-[#8d948e]">
                Y-Axis (Rows)
              </span>
              <select
                value={effectiveYAxis}
                onChange={(e) => {
                  setYAxis(e.target.value as NexusAxisDimension);
                  setSelectedMatrixCell(null);
                }}
                className="px-2 py-1 text-xs bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] text-[#0f1210] dark:text-[#f3f0e9] outline-none"
              >
                {availableAxes.map((ax) => (
                  <option key={ax} value={ax}>
                    {AXIS_LABELS[ax]}
                  </option>
                ))}
              </select>
            </label>

            <span className="text-[#6a716b]">×</span>

            <label className="inline-flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.08em] text-[#6a716b] dark:text-[#8d948e]">
                X-Axis (Columns)
              </span>
              <select
                value={effectiveXAxis}
                onChange={(e) => {
                  setXAxis(e.target.value as NexusAxisDimension);
                  setSelectedMatrixCell(null);
                }}
                className="px-2 py-1 text-xs bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] text-[#0f1210] dark:text-[#f3f0e9] outline-none"
              >
                {availableAxes.map((ax) => (
                  <option key={ax} value={ax}>
                    {AXIS_LABELS[ax]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {presetAxes
              .filter((p) => availableAxes.includes(p.y) && availableAxes.includes(p.x))
              .map((preset) => {
                const isActive = effectiveYAxis === preset.y && effectiveXAxis === preset.x;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setYAxis(preset.y);
                      setXAxis(preset.x);
                      setSelectedMatrixCell(null);
                    }}
                    className={`px-2 py-1 text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-[#1a2e24] text-[#faf8f4] border-[#1a2e24] dark:bg-[#7fb892] dark:text-[#0c0e0c] dark:border-[#7fb892]'
                        : 'bg-[#f3f0e9] dark:bg-[#0c0e0c] text-[#6a716b] dark:text-[#8d948e] border-[#ddd8ce] dark:border-[#262b27] hover:border-[#0f1210]'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Main Viewport + Inspector Rail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-8 bg-[#faf8f4] dark:bg-[#111413] border border-[#ddd8ce] dark:border-[#262b27] relative overflow-hidden flex flex-col justify-between">
          {/* VIEW 1: RELATIONSHIP WEB SVG */}
          {viewMode === 'constellation' && (
            <>
              <svg
                viewBox="0 0 1000 580"
                className={`w-full ${
                  compact ? 'h-[360px] sm:h-[420px]' : 'h-[400px] sm:h-[490px]'
                } select-none`}
                role="img"
                aria-label="Interactive IMnexus connection diagram"
              >
                {/* Axis Crosshair Hairlines */}
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
                  rx="215"
                  ry="145"
                  fill="none"
                  className="stroke-[#e9e5db] dark:stroke-[#1d221e]"
                  strokeWidth="1"
                />
                <ellipse
                  cx="500"
                  cy="290"
                  rx="400"
                  ry="220"
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
                  {graph.scope === 'portfolio' ? 'Tags (#) & Themes' : 'Actors & #Tags'}
                </text>
                <text
                  x="972"
                  y="32"
                  textAnchor="end"
                  className="fill-[#6a716b] dark:fill-[#6f7870] text-[10px] uppercase tracking-[0.12em] font-medium"
                >
                  {graph.scope === 'portfolio'
                    ? 'Metadata Hubs (Court · Lead · Status)'
                    : 'Timeline & Metadata'}
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
                  {kindFilter === 'core'
                    ? 'Metadata & Relational Bridges'
                    : 'Tagged & Corroborated Records'}
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
                      strokeWidth={isHighlighted ? 1.9 : edge.strength === 2 ? 1.15 : 0.9}
                      strokeDasharray={edge.strength === 1 ? '4 3' : undefined}
                      className={
                        isHighlighted
                          ? 'stroke-[#1a2e24] dark:stroke-[#7fb892] transition-opacity duration-150'
                          : isDimmed
                          ? 'stroke-[#ddd8ce]/40 dark:stroke-[#262b27]/40 transition-opacity duration-150'
                          : 'stroke-[#c9c3b6] dark:stroke-[#323833] transition-opacity duration-150'
                      }
                    />
                  );
                })}

                {/* Nodes */}
                {visibleNodes.map((node) => {
                  const isSelected = effectiveSelectedNodeId === node.id;
                  const isActive = connectedToActive.has(node.id);
                  const isDimmed = activeNodeId !== null && !isActive;
                  const spec = KIND_MARKER[node.kind];
                  const size =
                    node.kind === 'case'
                      ? 13
                      : node.kind === 'tag' || node.kind === 'metadata'
                      ? 10
                      : 8;
                  const tooltip = `${node.fullLabel || node.label}${
                    node.subtitle ? ` · ${node.subtitle}` : ''
                  }`;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={() => setSelectedNodeId(node.id)}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      style={{ cursor: 'pointer', opacity: isDimmed ? 0.3 : 1 }}
                      className="transition-opacity duration-150"
                    >
                      <title>{tooltip}</title>
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
                          strokeWidth={node.kind === 'case' ? 1.8 : 1.4}
                          className={
                            node.kind === 'case'
                              ? 'fill-[#1a2e24] stroke-[#0f1210] dark:fill-[#f3f0e9] dark:stroke-[#f3f0e9]'
                              : node.kind === 'tag'
                              ? 'fill-[#faf8f4] stroke-[#8b3a3a] dark:fill-[#1c1515] dark:stroke-[#d17b7b]'
                              : 'fill-[#e9e5db] stroke-[#1a2e24] dark:fill-[#1c211d] dark:stroke-[#a8c4b0]'
                          }
                        />
                      ) : spec.shape === 'square' ? (
                        <rect
                          x={-size}
                          y={-size}
                          width={size * 2}
                          height={size * 2}
                          strokeWidth="1.35"
                          className={
                            node.kind === 'metadata'
                              ? 'fill-[#faf8f4] stroke-[#2d5a3d] dark:fill-[#151c17] dark:stroke-[#7fb892]'
                              : node.kind === 'timeline'
                              ? 'fill-[#faf8f4] stroke-[#7a642e] dark:fill-[#161916] dark:stroke-[#d4bc7d]'
                              : 'fill-[#faf8f4] stroke-[#6a716b] dark:fill-[#161916] dark:stroke-[#9ca39d]'
                          }
                        />
                      ) : (
                        <circle
                          r={size}
                          strokeWidth="1.35"
                          className={
                            node.kind === 'actor'
                              ? 'fill-[#faf8f4] stroke-[#2d5a3d] dark:fill-[#161916] dark:stroke-[#7fb892]'
                              : 'fill-[#f3f0e9] stroke-[#0f1210] dark:fill-[#1e2420] dark:stroke-[#d8d3c8]'
                          }
                        />
                      )}

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

              {visibleTagNodes.length > 0 && (
                <div className="px-4 py-2 border-t border-[#e9e5db] dark:border-[#202521] bg-[#faf8f4] dark:bg-[#141815] flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-[#6a716b] dark:text-[#8d948e] shrink-0">
                    Active Tags ({visibleTagNodes.length}):
                  </span>
                  {visibleTagNodes.map((tagNode) => {
                    const isSel = effectiveSelectedNodeId === tagNode.id;
                    return (
                      <button
                        key={tagNode.id}
                        type="button"
                        onClick={() => setSelectedNodeId(tagNode.id)}
                        onMouseEnter={() => setHoveredNodeId(tagNode.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        className={`text-left transition-colors cursor-pointer ${
                          isSel
                            ? 'text-[#0f1210] dark:text-[#f3f0e9] font-semibold underline underline-offset-4'
                            : 'text-[#8b3a3a] dark:text-[#e39b9b] hover:underline underline-offset-4'
                        }`}
                      >
                        {tagNode.fullLabel || tagNode.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="px-4 py-2.5 border-t border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9]/60 dark:bg-[#0c0e0c]/70 flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#6a716b] dark:text-[#8d948e]">
                <div className="flex flex-wrap items-center gap-3">
                  <span>◆ Case / #Tag / Collection</span>
                  <span>■ Metadata / Timeline</span>
                  <span>● Actor / Bridged Exhibit</span>
                  <span>--- Tag or Metadata Bridge</span>
                </div>
                <span className="font-mono-tabular">
                  {visibleNodes.length} nodes · {visibleEdges.length} links
                </span>
              </div>
            </>
          )}

          {/* VIEW 2: INTERACTIVE AXIS MATRIX */}
          {viewMode === 'matrix' && (
            <>
              <div className="p-4 flex-1 overflow-auto">
                {matrixResult.rows.length === 0 || matrixResult.cols.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[#6a716b] dark:text-[#8d948e]">
                    No overlapping records found for {AXIS_LABELS[effectiveYAxis]} ×{' '}
                    {AXIS_LABELS[effectiveXAxis]}. Try another axis pair or add case tags &amp; metadata.
                  </div>
                ) : (
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="p-2 text-left text-[10px] uppercase tracking-[0.08em] text-[#6a716b] dark:text-[#8d948e] border-b border-r border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9]/60 dark:bg-[#0c0e0c]/60 min-w-[150px]">
                          {AXIS_LABELS[effectiveYAxis]} ↓ / {AXIS_LABELS[effectiveXAxis]} →
                        </th>
                        {matrixResult.cols.map((col) => (
                          <th
                            key={col.id}
                            onClick={() => {
                              setSelectedNodeId(col.id);
                              setSelectedMatrixCell(null);
                            }}
                            title={col.fullLabel || col.label}
                            className="p-2 text-center font-medium text-[11px] text-[#0f1210] dark:text-[#f3f0e9] border-b border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9]/40 dark:bg-[#0c0e0c]/40 min-w-[92px] max-w-[140px] cursor-pointer hover:bg-[#e9e5db] dark:hover:bg-[#1b201c]"
                          >
                            <div className="truncate">{col.fullLabel || col.label}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrixResult.rows.map((row) => (
                        <tr key={row.id}>
                          <th
                            onClick={() => {
                              setSelectedNodeId(row.id);
                              setSelectedMatrixCell(null);
                            }}
                            title={row.fullLabel || row.label}
                            className="p-2 text-left font-medium text-[11px] text-[#0f1210] dark:text-[#f3f0e9] border-b border-r border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9]/40 dark:bg-[#0c0e0c]/40 max-w-[210px] cursor-pointer hover:bg-[#e9e5db] dark:hover:bg-[#1b201c]"
                          >
                            <div className="truncate">{row.fullLabel || row.label}</div>
                            {row.subtitle && (
                              <div className="text-[10px] font-normal text-[#6a716b] dark:text-[#8d948e] truncate">
                                {row.subtitle}
                              </div>
                            )}
                          </th>

                          {matrixResult.cols.map((col) => {
                            const isSelf = row.id === col.id;
                            const cell = matrixResult.cells.get(`${row.id}::${col.id}`);
                            const isCellSelected =
                              selectedMatrixCell?.rowId === row.id &&
                              selectedMatrixCell?.colId === col.id;

                            if (isSelf) {
                              return (
                                <td
                                  key={col.id}
                                  className="p-2 text-center border-b border-l border-[#e9e5db] dark:border-[#222723] bg-black/[0.03] dark:bg-white/[0.03] text-[#6a716b]"
                                >
                                  —
                                </td>
                              );
                            }

                            const intensity =
                              cell && matrixResult.maxScore > 0
                                ? cell.score / matrixResult.maxScore
                                : 0;

                            return (
                              <td
                                key={col.id}
                                onClick={() => {
                                  if (cell) {
                                    setSelectedMatrixCell(cell);
                                    setSelectedNodeId(row.id);
                                  }
                                }}
                                title={
                                  cell
                                    ? `${row.label} × ${col.label}: ${cell.reasons.join(', ')}`
                                    : 'No direct or shared bridge'
                                }
                                className={`p-2 text-center border-b border-l border-[#e9e5db] dark:border-[#222723] font-mono-tabular transition-colors ${
                                  cell ? 'cursor-pointer' : 'text-[#6a716b]/40'
                                } ${
                                  isCellSelected
                                    ? 'ring-2 ring-inset ring-[#1a2e24] dark:ring-[#f3f0e9]'
                                    : ''
                                }`}
                                style={
                                  cell
                                    ? {
                                        backgroundColor:
                                          intensity > 0.65
                                            ? 'rgba(26, 46, 36, 0.22)'
                                            : 'rgba(45, 90, 61, 0.11)',
                                      }
                                    : undefined
                                }
                              >
                                {cell ? (
                                  <span className="inline-block font-semibold text-[#1a2e24] dark:text-[#7fb892]">
                                    {cell.score}
                                  </span>
                                ) : (
                                  '·'
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="px-4 py-2.5 border-t border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9]/60 dark:bg-[#0c0e0c]/70 flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#6a716b] dark:text-[#8d948e]">
                <span>Click any numbered intersection cell to inspect shared #tags, metadata, or bridge records.</span>
                <span className="font-mono-tabular">
                  {matrixResult.rows.length} rows × {matrixResult.cols.length} cols ·{' '}
                  {matrixResult.cells.size} intersections
                </span>
              </div>
            </>
          )}

          {/* VIEW 3: CHRONOLOGY & TAG/METADATA SWIMLANE AXIS */}
          {viewMode === 'chronology' && (
            <>
              <div className="p-4 flex-1 overflow-x-auto">
                {graph.chronology.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[#6a716b] dark:text-[#8d948e]">
                    Add chronological timeline events (or cases with key dates) to inspect alignments along the Time Axis.
                  </div>
                ) : (
                  <div className="min-w-[640px] space-y-4">
                    {/* Horizontal Time Axis Header */}
                    <div
                      className="grid gap-2 pb-3 border-b border-[#ddd8ce] dark:border-[#262b27]"
                      style={{
                        gridTemplateColumns: `110px repeat(${graph.chronology.length}, minmax(135px, 1fr))`,
                      }}
                    >
                      <div className="text-[10px] uppercase tracking-[0.1em] text-[#6a716b] dark:text-[#8d948e] self-end pb-1">
                        {graph.scope === 'portfolio' ? 'Case Axis →' : 'Time Axis →'}
                      </div>
                      {graph.chronology.map((pt) => {
                        const isSel = effectiveSelectedNodeId === pt.nodeId;
                        return (
                          <button
                            key={pt.id}
                            type="button"
                            onClick={() => setSelectedNodeId(pt.nodeId)}
                            className={`text-left p-2.5 border transition-colors cursor-pointer ${
                              isSel
                                ? 'bg-[#1a2e24] text-[#faf8f4] border-[#1a2e24] dark:bg-[#f3f0e9] dark:text-[#0f1210] dark:border-[#f3f0e9]'
                                : 'bg-[#f3f0e9] dark:bg-[#161916] border-[#ddd8ce] dark:border-[#262b27] hover:border-[#0f1210]'
                            }`}
                          >
                            <div
                              className={`font-mono-tabular text-[10px] ${
                                isSel
                                  ? 'opacity-80'
                                  : 'text-[#7a642e] dark:text-[#d4bc7d]'
                              }`}
                            >
                              {pt.dateLabel}
                            </div>
                            <div className="text-xs font-semibold truncate mt-0.5">
                              {pt.title}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Swimlane 1: Tags (#) */}
                    <div
                      className="grid gap-2 items-start"
                      style={{
                        gridTemplateColumns: `110px repeat(${graph.chronology.length}, minmax(135px, 1fr))`,
                      }}
                    >
                      <div className="text-[10px] uppercase tracking-[0.1em] text-[#8b3a3a] dark:text-[#d17b7b] pt-1 font-medium">
                        Tags (#)
                      </div>
                      {graph.chronology.map((pt) => (
                        <div
                          key={`${pt.id}:tags`}
                          className="min-h-[42px] p-1.5 border-l border-[#e9e5db] dark:border-[#222723] space-y-1"
                        >
                          {pt.tagNodeIds.length === 0 ? (
                            <span className="text-[10px] text-[#6a716b]/50">—</span>
                          ) : (
                            pt.tagNodeIds.map((nid) => {
                              const n = nodeMap.get(nid);
                              if (!n) return null;
                              return (
                                <button
                                  key={nid}
                                  type="button"
                                  title={n.fullLabel || n.label}
                                  onClick={() => setSelectedNodeId(nid)}
                                  className="block w-full text-left px-1.5 py-0.5 text-[11px] font-medium border border-[#8b3a3a]/30 text-[#8b3a3a] dark:text-[#e39b9b] hover:border-[#8b3a3a] truncate cursor-pointer"
                                >
                                  {n.fullLabel || n.label}
                                </button>
                              );
                            })
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Swimlane 2: Metadata */}
                    <div
                      className="grid gap-2 items-start"
                      style={{
                        gridTemplateColumns: `110px repeat(${graph.chronology.length}, minmax(135px, 1fr))`,
                      }}
                    >
                      <div className="text-[10px] uppercase tracking-[0.1em] text-[#2d5a3d] dark:text-[#7fb892] pt-1 font-medium">
                        Metadata
                      </div>
                      {graph.chronology.map((pt) => (
                        <div
                          key={`${pt.id}:meta`}
                          className="min-h-[42px] p-1.5 border-l border-[#e9e5db] dark:border-[#222723] space-y-1"
                        >
                          {pt.metadataNodeIds.length === 0 ? (
                            <span className="text-[10px] text-[#6a716b]/50">—</span>
                          ) : (
                            pt.metadataNodeIds.map((nid) => {
                              const n = nodeMap.get(nid);
                              if (!n) return null;
                              return (
                                <button
                                  key={nid}
                                  type="button"
                                  onClick={() => setSelectedNodeId(nid)}
                                  className="block w-full text-left px-1.5 py-0.5 text-[11px] border border-[#2d5a3d]/30 text-[#1a2e24] dark:text-[#7fb892] hover:border-[#2d5a3d] truncate cursor-pointer"
                                >
                                  {n.label}
                                </button>
                              );
                            })
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Swimlane 3: Actors & Collections */}
                    <div
                      className="grid gap-2 items-start"
                      style={{
                        gridTemplateColumns: `110px repeat(${graph.chronology.length}, minmax(135px, 1fr))`,
                      }}
                    >
                      <div className="text-[10px] uppercase tracking-[0.1em] text-[#6a716b] dark:text-[#8d948e] pt-1 font-medium">
                        {graph.scope === 'portfolio' ? 'Collections' : 'Actors & Sets'}
                      </div>
                      {graph.chronology.map((pt) => {
                        const laneIds = [...pt.actorNodeIds, ...pt.collectionNodeIds];
                        return (
                          <div
                            key={`${pt.id}:ent`}
                            className="min-h-[42px] p-1.5 border-l border-[#e9e5db] dark:border-[#222723] space-y-1"
                          >
                            {laneIds.length === 0 ? (
                              <span className="text-[10px] text-[#6a716b]/50">—</span>
                            ) : (
                              laneIds.map((nid) => {
                                const n = nodeMap.get(nid);
                                if (!n) return null;
                                return (
                                  <button
                                    key={nid}
                                    type="button"
                                    onClick={() => setSelectedNodeId(nid)}
                                    className="block w-full text-left px-1.5 py-0.5 text-[11px] border border-[#ddd8ce] dark:border-[#262b27] text-[#0f1210] dark:text-[#f3f0e9] hover:border-[#0f1210] truncate cursor-pointer"
                                  >
                                    {n.label}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-4 py-2.5 border-t border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9]/60 dark:bg-[#0c0e0c]/70 flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#6a716b] dark:text-[#8d948e]">
                <span>Vertical tracks reveal which #tags, case metadata, and actors converge at each milestone.</span>
                <span className="font-mono-tabular">
                  {graph.chronology.length} axis points
                </span>
              </div>
            </>
          )}
        </div>

        {/* Selected Node / Matrix Intersection Inspector Rail */}
        <div className="lg:col-span-4 bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-4 flex flex-col justify-between">
          {selectedMatrixCell && viewMode === 'matrix' ? (
            <div className="space-y-4">
              <div className="pb-3 border-b border-[#e9e5db] dark:border-[#242924]">
                <div className="text-[10px] uppercase tracking-[0.1em] text-[#2d5a3d] dark:text-[#7fb892] mb-1">
                  Axis Intersection · {selectedMatrixCell.score} link
                  {selectedMatrixCell.score === 1 ? '' : 's'}
                </div>
                <h4 className="text-sm font-semibold text-[#0f1210] dark:text-[#f3f0e9]">
                  {nodeMap.get(selectedMatrixCell.rowId)?.fullLabel ||
                    nodeMap.get(selectedMatrixCell.rowId)?.label}{' '}
                  ×{' '}
                  {nodeMap.get(selectedMatrixCell.colId)?.fullLabel ||
                    nodeMap.get(selectedMatrixCell.colId)?.label}
                </h4>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.1em] text-[#6a716b] dark:text-[#8d948e] mb-2">
                  Connecting Bridges
                </div>
                <ul className="divide-y divide-[#e9e5db] dark:divide-[#242924] border border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9]/50 dark:bg-[#0c0e0c]/50">
                  {selectedMatrixCell.reasons.map((reason, idx) => (
                    <li
                      key={idx}
                      className="px-3 py-2 text-xs text-[#0f1210] dark:text-[#f3f0e9]"
                    >
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>

              {selectedMatrixCell.bridgeNodeIds.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.1em] text-[#6a716b] dark:text-[#8d948e] mb-2">
                    Inspect Bridge Node
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMatrixCell.bridgeNodeIds.map((bid) => {
                      const bn = nodeMap.get(bid);
                      if (!bn) return null;
                      return (
                        <button
                          key={bid}
                          type="button"
                          onClick={() => {
                            setSelectedNodeId(bid);
                            setSelectedMatrixCell(null);
                          }}
                          className="px-2 py-1 text-[11px] font-medium border border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9] dark:bg-[#0c0e0c] hover:border-[#0f1210] cursor-pointer"
                        >
                          {bn.fullLabel || bn.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : !selectedNode ? (
            <div className="text-xs text-[#6a716b] dark:text-[#8d948e] my-auto text-center p-6">
              Select any tag, metadata attribute, case, or matrix cell to inspect its connected relationships.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="pb-3 border-b border-[#e9e5db] dark:border-[#242924]">
                <div className="text-[10px] uppercase tracking-[0.1em] text-[#6a716b] dark:text-[#8d948e] mb-1">
                  {KIND_LABELS[selectedNode.kind]} · {selectedNode.degree} connections
                </div>
                <h4 className="text-sm font-semibold text-[#0f1210] dark:text-[#f3f0e9] break-words">
                  {selectedNode.fullLabel || selectedNode.label}
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
                  Connected Nodes ({selectedConnections.length})
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-[#e9e5db] dark:divide-[#242924] border border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9]/50 dark:bg-[#0c0e0c]/50">
                  {selectedConnections.length === 0 ? (
                    <div className="p-3 text-xs text-[#6a716b]">
                      No cross-links recorded yet.
                    </div>
                  ) : (
                    selectedConnections.map(({ edge, node }) => (
                      <button
                        key={edge.id}
                        type="button"
                        onClick={() => setSelectedNodeId(node.id)}
                        title={node.fullLabel || node.label}
                        className="w-full text-left px-3 py-2 hover:bg-[#faf8f4] dark:hover:bg-[#1c201c] flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-[#0f1210] dark:text-[#f3f0e9] truncate">
                            {node.fullLabel || node.label}
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
                    setSelectedMatrixCell(null);
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
