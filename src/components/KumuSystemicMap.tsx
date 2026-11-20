import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Focus,
  Maximize2,
  Move,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  computeKumuLayout,
  type NexusEdge,
  type NexusGraphData,
  type NexusNode,
  type NexusNodeKind,
} from '../utils/nexusEngine';

interface KumuSystemicMapProps {
  graph: NexusGraphData;
  visibleNodes: NexusNode[];
  visibleEdges: NexusEdge[];
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  onSelectNodeId: (id: string) => void;
  onHoverNodeId: (id: string | null) => void;
  accentVariant?: 'forest' | 'ember';
  compact?: boolean;
}

const ELEMENT_ROLE_LABEL: Record<NexusNodeKind, string> = {
  case: 'Case Dossier',
  tag: 'Systemic Mechanism (#Tag)',
  metadata: 'Institutional Hub',
  actor: 'Actor / Entity',
  collection: 'Evidence Set',
  timeline: 'Event',
  evidence: 'Exhibit',
  document: 'Document',
};

export const KumuSystemicMap: React.FC<KumuSystemicMapProps> = ({
  graph,
  visibleNodes,
  visibleEdges,
  selectedNodeId,
  hoveredNodeId,
  onSelectNodeId,
  onHoverNodeId,
  accentVariant = 'forest',
  compact = false,
}) => {
  const isEmber = accentVariant === 'ember';
  const svgRef = useRef<SVGSVGElement | null>(null);

  const layout = useMemo(() => computeKumuLayout(graph), [graph]);

  const [dragOverrides, setDragOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [hopDepth, setHopDepth] = useState<1 | 2>(2);
  const [showEdgeLabels, setShowEdgeLabels] = useState<boolean>(true);
  const [activeLoopId, setActiveLoopId] = useState<string | null>(null);

  // Reset drag overrides when graph composition changes
  useEffect(() => {
    setDragOverrides({});
    setActiveLoopId(null);
  }, [graph]);

  const nodeMap = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);

  const getPos = (id: string) => {
    const custom = dragOverrides[id];
    const base = layout.positions[id];
    if (custom && base) return { x: custom.x, y: custom.y, radius: base.radius };
    return base || { x: 500, y: 300, radius: 14 };
  };

  const activeNodeId = hoveredNodeId || selectedNodeId;

  // Compute 1-hop or 2-hop systemic neighborhood for Kumu Focus spotlight
  const neighborhoodIds = useMemo(() => {
    if (activeLoopId) {
      const loop = layout.loops.find((l) => l.id === activeLoopId);
      if (loop) return new Set(loop.nodes);
    }
    if (!activeNodeId) return null;
    const set = new Set<string>([activeNodeId]);
    const hop1 = new Set<string>();
    for (const e of visibleEdges) {
      if (e.source === activeNodeId) hop1.add(e.target);
      if (e.target === activeNodeId) hop1.add(e.source);
    }
    hop1.forEach((id) => set.add(id));

    if (hopDepth === 2) {
      for (const e of visibleEdges) {
        if (hop1.has(e.source)) set.add(e.target);
        if (hop1.has(e.target)) set.add(e.source);
      }
    }
    return set;
  }, [activeNodeId, activeLoopId, layout.loops, visibleEdges, hopDepth]);

  const screenToSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const viewW = 1000 / zoom;
    const viewH = 600 / zoom;
    const minX = (1000 - viewW) / 2;
    const minY = (600 - viewH) / 2;
    const x = minX + ((clientX - rect.left) / rect.width) * viewW;
    const y = minY + ((clientY - rect.top) / rect.height) * viewH;
    return {
      x: Math.max(40, Math.min(960, x)),
      y: Math.max(36, Math.min(564, y)),
    };
  };

  const viewBox = useMemo(() => {
    const w = 1000 / zoom;
    const h = 600 / zoom;
    const x = (1000 - w) / 2;
    const y = (600 - h) / 2;
    return `${x} ${y} ${w} ${h}`;
  }, [zoom]);

  const markerId = isEmber ? 'kumu-arrow-ember' : 'kumu-arrow-forest';
  const markerHiId = isEmber ? 'kumu-arrow-ember-hi' : 'kumu-arrow-forest-hi';

  const getNodeStyle = (kind: NexusNodeKind) => {
    switch (kind) {
      case 'case':
        return isEmber
          ? {
              fill: '#ef4423',
              ring: '#ffd6cc',
              stroke: '#0f1210',
              innerText: '#ffffff',
            }
          : {
              fill: '#1a2e24',
              ring: '#cde0d3',
              stroke: '#0f1210',
              innerText: '#faf8f4',
            };
      case 'tag':
        return {
          fill: '#8b3a3a',
          ring: '#f5d6d6',
          stroke: '#8b3a3a',
          innerText: '#ffffff',
        };
      case 'metadata':
        return isEmber
          ? {
              fill: '#faf8f4',
              ring: '#ff6b3d',
              stroke: '#ef4423',
              innerText: '#0f1210',
            }
          : {
              fill: '#faf8f4',
              ring: '#7fb892',
              stroke: '#2d5a3d',
              innerText: '#0f1210',
            };
      case 'actor':
        return {
          fill: '#7a642e',
          ring: '#efe4c4',
          stroke: '#52421c',
          innerText: '#ffffff',
        };
      case 'collection':
        return {
          fill: '#2b302c',
          ring: '#ddd8ce',
          stroke: '#0f1210',
          innerText: '#ffffff',
        };
      default:
        return {
          fill: '#e9e5db',
          ring: '#c4bfb4',
          stroke: '#6a716b',
          innerText: '#0f1210',
        };
    }
  };

  return (
    <div className="flex flex-col flex-1">
      {/* Kumu Systemic Toolbar */}
      <div className="px-3.5 py-2 border-b border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9]/80 dark:bg-[#141815] flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 font-mono-tabular uppercase tracking-wider text-[10px] text-[#6a716b] dark:text-[#8d948e]">
            <Move className="w-3 h-3" />
            Drag nodes · Click to spotlight
          </span>
          <div className="inline-flex border border-[#ddd8ce] dark:border-[#262b27] bg-[#faf8f4] dark:bg-[#0c0e0c]">
            <button
              type="button"
              onClick={() => setHopDepth(1)}
              className={`px-2 py-0.5 text-[10px] font-medium cursor-pointer ${
                hopDepth === 1
                  ? isEmber
                    ? 'bg-[#ef4423] text-white'
                    : 'bg-[#1a2e24] text-[#faf8f4]'
                  : 'text-[#6a716b] dark:text-[#8d948e]'
              }`}
            >
              1-Hop Direct
            </button>
            <button
              type="button"
              onClick={() => setHopDepth(2)}
              className={`px-2 py-0.5 text-[10px] font-medium border-l border-[#ddd8ce] dark:border-[#262b27] cursor-pointer ${
                hopDepth === 2
                  ? isEmber
                    ? 'bg-[#ef4423] text-white'
                    : 'bg-[#1a2e24] text-[#faf8f4]'
                  : 'text-[#6a716b] dark:text-[#8d948e]'
              }`}
            >
              2-Hop Systemic
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowEdgeLabels((v) => !v)}
            className={`px-2 py-0.5 text-[10px] font-medium border border-[#ddd8ce] dark:border-[#262b27] cursor-pointer ${
              showEdgeLabels
                ? 'bg-[#faf8f4] dark:bg-[#1c211d] text-[#0f1210] dark:text-[#f3f0e9]'
                : 'text-[#6a716b] dark:text-[#8d948e]'
            }`}
          >
            {showEdgeLabels ? 'Hide Arc Labels' : 'Show Arc Labels'}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.15).toFixed(2))))}
            title="Zoom out"
            className="p-1 border border-[#ddd8ce] dark:border-[#262b27] bg-[#faf8f4] dark:bg-[#0c0e0c] hover:border-[#0f1210] cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono-tabular text-[10px] px-1.5 text-[#6a716b] dark:text-[#8d948e]">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.15).toFixed(2))))}
            title="Zoom in"
            className="p-1 border border-[#ddd8ce] dark:border-[#262b27] bg-[#faf8f4] dark:bg-[#0c0e0c] hover:border-[#0f1210] cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setDragOverrides({});
              setActiveLoopId(null);
            }}
            title="Reset Kumu layout & zoom"
            className="inline-flex items-center gap-1 px-2 py-1 border border-[#ddd8ce] dark:border-[#262b27] bg-[#faf8f4] dark:bg-[#0c0e0c] hover:border-[#0f1210] text-[10px] font-medium cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Interactive Kumu Systemic SVG Canvas */}
      <svg
        ref={svgRef}
        viewBox={viewBox}
        onPointerMove={(e) => {
          if (!draggingId) return;
          const pt = screenToSvg(e.clientX, e.clientY);
          if (pt) {
            setDragOverrides((prev) => ({ ...prev, [draggingId]: pt }));
          }
        }}
        onPointerUp={() => setDraggingId(null)}
        onPointerLeave={() => setDraggingId(null)}
        className={`w-full ${
          compact ? 'h-[390px] sm:h-[440px]' : 'h-[440px] sm:h-[520px]'
        } select-none touch-none bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.02)_1px,transparent_1px)] [background-size:22px_22px]`}
        role="img"
        aria-label="Kumu-style Legal Systemic Relationship Map"
      >
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#9a958b" />
          </marker>
          <marker
            id={markerHiId}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path
              d="M 0 1.5 L 8.5 5 L 0 8.5 z"
              fill={isEmber ? '#ef4423' : '#2d5a3d'}
            />
          </marker>
        </defs>

        {/* Curved Bezier Systemic Causal/Structural Arcs */}
        {visibleEdges.map((edge, idx) => {
          const p1 = getPos(edge.source);
          const p2 = getPos(edge.target);
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));

          // Trim endpoints so arrow lands cleanly on node perimeter
          const startPad = p1.radius + 3;
          const endPad = p2.radius + 7;
          const sx = p1.x + (dx / dist) * startPad;
          const sy = p1.y + (dy / dist) * startPad;
          const tx = p2.x - (dx / dist) * endPad;
          const ty = p2.y - (dy / dist) * endPad;

          // Subtle curve offset perpendicular to edge (characteristic Kumu curved arcs)
          const curveSign = idx % 2 === 0 ? 1 : -1;
          const curveAmp = Math.min(34, dist * 0.14) * curveSign;
          const nx = -dy / dist;
          const ny = dx / dist;
          const ctrlX = (sx + tx) / 2 + nx * curveAmp;
          const ctrlY = (sy + ty) / 2 + ny * curveAmp;
          const midX = 0.25 * sx + 0.5 * ctrlX + 0.25 * tx;
          const midY = 0.25 * sy + 0.5 * ctrlY + 0.25 * ty;

          const isDirectTouch =
            activeNodeId !== null &&
            (edge.source === activeNodeId || edge.target === activeNodeId);
          const inNeighborhood =
            neighborhoodIds !== null &&
            neighborhoodIds.has(edge.source) &&
            neighborhoodIds.has(edge.target);
          const isDimmed = neighborhoodIds !== null && !inNeighborhood;

          return (
            <g key={edge.id}>
              <path
                d={`M ${sx} ${sy} Q ${ctrlX} ${ctrlY} ${tx} ${ty}`}
                fill="none"
                strokeWidth={isDirectTouch ? 2.1 : inNeighborhood ? 1.5 : 1}
                strokeDasharray={edge.strength === 1 ? '5 3' : undefined}
                markerEnd={`url(#${isDirectTouch || inNeighborhood ? markerHiId : markerId})`}
                className={
                  isDirectTouch
                    ? isEmber
                      ? 'stroke-[#ef4423] dark:stroke-[#ff6b3d]'
                      : 'stroke-[#1a2e24] dark:stroke-[#7fb892]'
                    : inNeighborhood
                    ? isEmber
                      ? 'stroke-[#ef4423]/70 dark:stroke-[#ff6b3d]/70'
                      : 'stroke-[#2d5a3d]/70 dark:stroke-[#7fb892]/70'
                    : isDimmed
                    ? 'stroke-[#ddd8ce]/35 dark:stroke-[#262b27]/35'
                    : 'stroke-[#b8b2a5] dark:stroke-[#3a413c]'
                }
              />
              {showEdgeLabels && isDirectTouch && (
                <g transform={`translate(${midX}, ${midY})`} style={{ pointerEvents: 'none' }}>
                  <rect
                    x={-Math.min(72, Math.max(30, edge.relation.length * 2.9))}
                    y={-8}
                    width={Math.min(144, Math.max(60, edge.relation.length * 5.8))}
                    height={15}
                    rx={2}
                    className="fill-[#faf8f4]/95 dark:fill-[#111413]/95 stroke-[#ddd8ce] dark:stroke-[#2e3530]"
                    strokeWidth="0.75"
                  />
                  <text
                    y={2.5}
                    textAnchor="middle"
                    className="fill-[#4a514b] dark:fill-[#c4bfb4] text-[8.5px] font-mono-tabular"
                  >
                    {edge.relation.length > 22
                      ? `${edge.relation.slice(0, 21)}…`
                      : edge.relation}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Kumu Disc Nodes */}
        {visibleNodes.map((node) => {
          const pos = getPos(node.id);
          const style = getNodeStyle(node.kind);
          const isSelected = selectedNodeId === node.id;
          const inHood = neighborhoodIds === null || neighborhoodIds.has(node.id);
          const r = pos.radius;

          return (
            <g
              key={node.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              onPointerDown={(e) => {
                e.stopPropagation();
                setActiveLoopId(null);
                setDraggingId(node.id);
                onSelectNodeId(node.id);
              }}
              onMouseEnter={() => onHoverNodeId(node.id)}
              onMouseLeave={() => onHoverNodeId(null)}
              style={{ cursor: draggingId === node.id ? 'grabbing' : 'grab', opacity: inHood ? 1 : 0.22 }}
              className="transition-opacity duration-150"
            >
              <title>
                {`${node.fullLabel || node.label} · ${ELEMENT_ROLE_LABEL[node.kind]}${
                  node.subtitle ? ` · ${node.subtitle}` : ''
                }`}
              </title>

              {/* Outer Halo Ring (Kumu cluster highlight) */}
              <circle
                r={r + (isSelected ? 7 : 3.5)}
                fill="none"
                stroke={isSelected ? (isEmber ? '#ef4423' : '#1a2e24') : style.ring}
                strokeWidth={isSelected ? 2 : 1.25}
                strokeOpacity={isSelected ? 0.95 : 0.65}
              />

              {/* Main Kumu Element Circle */}
              <circle
                r={r}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={node.kind === 'metadata' ? 2 : 1.25}
              />

              {/* Degree count badge inside large hub nodes */}
              {r >= 13 && (
                <text
                  y={3.5}
                  textAnchor="middle"
                  fill={style.innerText}
                  className="text-[9.5px] font-mono-tabular font-semibold pointer-events-none"
                >
                  {node.degree}
                </text>
              )}

              {/* Crisp Readable Label */}
              <text
                y={r + 14}
                textAnchor="middle"
                className={`text-[10.5px] pointer-events-none ${
                  isSelected
                    ? 'fill-[#0f1210] dark:fill-[#f3f0e9] font-semibold'
                    : 'fill-[#0f1210]/90 dark:fill-[#e5e1d8]/90 font-medium'
                }`}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Detected Systemic Leverage Hubs / Feedback Bridges */}
      {layout.loops.length > 0 && (
        <div className="px-3.5 py-2.5 border-t border-[#e9e5db] dark:border-[#222723] bg-[#faf8f4] dark:bg-[#141815] space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-mono-tabular uppercase tracking-wider text-[#6a716b] dark:text-[#8d948e]">
            <Focus className="w-3 h-3 text-[#ef4423] dark:text-[#ff6b3d]" />
            <span>Identified Systemic Loops &amp; Cross-Case Leverage Hubs (Click to isolate):</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {layout.loops.map((loop) => {
              const active = activeLoopId === loop.id;
              return (
                <button
                  key={loop.id}
                  type="button"
                  title={loop.description}
                  onClick={() => {
                    if (active) {
                      setActiveLoopId(null);
                    } else {
                      setActiveLoopId(loop.id);
                      const firstNode = loop.nodes[0];
                      if (firstNode && nodeMap.has(firstNode)) {
                        onSelectNodeId(firstNode);
                      }
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium border transition-colors cursor-pointer ${
                    active
                      ? isEmber
                        ? 'bg-[#ef4423] text-white border-[#ef4423]'
                        : 'bg-[#1a2e24] text-[#faf8f4] border-[#1a2e24] dark:bg-[#7fb892] dark:text-[#0c0e0c]'
                      : 'bg-[#f3f0e9] dark:bg-[#161916] border-[#ddd8ce] dark:border-[#262b27] text-[#0f1210] dark:text-[#f3f0e9] hover:border-[#0f1210]'
                  }`}
                >
                  <Maximize2 className="w-2.5 h-2.5 opacity-75" />
                  <span>{loop.label}</span>
                  <span className="font-mono-tabular text-[10px] opacity-75">
                    ({Math.max(0, loop.nodes.length - 1)} cases)
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend Bar */}
      <div className="px-4 py-2.5 border-t border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9]/60 dark:bg-[#0c0e0c]/70 flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#6a716b] dark:text-[#8d948e]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full inline-block ${
                isEmber ? 'bg-[#ef4423]' : 'bg-[#1a2e24] dark:bg-[#7fb892]'
              }`}
            />
            Case Dossier
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#8b3a3a]" />
            Systemic Mechanism (#Tag)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full inline-block border-2 bg-[#faf8f4] ${
                isEmber ? 'border-[#ef4423]' : 'border-[#2d5a3d]'
              }`}
            />
            Institutional / Metadata Hub
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#7a642e]" />
            Actor / Entity
          </span>
        </div>
        <span className="font-mono-tabular">
          Node size = Systemic centrality · {visibleNodes.length} nodes · {visibleEdges.length} arcs
        </span>
      </div>
    </div>
  );
};
