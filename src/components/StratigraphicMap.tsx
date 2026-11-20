import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Layers,
  Tag,
} from 'lucide-react';
import type {
  StratigraphicItem,
  StratigraphicMapData,
  StratigraphicStratum,
} from '../utils/nexusEngine';
import { StatusLabel } from './BrandMark';

interface StratigraphicMapProps {
  data: StratigraphicMapData;
  accentVariant?: 'forest' | 'ember';
  onOpenStratum?: (stratum: StratigraphicStratum) => void;
}

function toRoman(num: number): string {
  const romans: Array<[number, string]> = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let n = Math.max(1, num);
  let out = '';
  for (const [val, sym] of romans) {
    while (n >= val) {
      out += sym;
      n -= val;
    }
  }
  return out;
}

export const StratigraphicMap: React.FC<StratigraphicMapProps> = ({
  data,
  accentVariant = 'forest',
  onOpenStratum,
}) => {
  const isEmber = accentVariant === 'ember';
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<{
    stratum: StratigraphicStratum;
    item: StratigraphicItem;
  } | null>(null);

  // Earliest is index 0 (bottom), Most Recent is index N-1 (top).
  // Render vertically from top (most recent) downward to bottom (earliest).
  const displayTopToBottom = useMemo(() => {
    const base = data.strataEarliestToLatest.map((st, idx) => ({
      stratum: st,
      stratumNumber: idx + 1, // I = Earliest at bottom
    }));
    return [...base].reverse();
  }, [data.strataEarliestToLatest]);

  if (data.strataEarliestToLatest.length === 0) {
    return (
      <div className="p-10 text-center text-xs text-[#6a716b] dark:text-[#8d948e]">
        Select one or more cases above to inspect their layered Procedural &amp; Institutional Analysis stratigraphy.
      </div>
    );
  }

  const totalItems = data.strataEarliestToLatest.reduce((acc, s) => acc + s.items.length, 0);

  return (
    <div className="flex flex-col flex-1">
      {/* Stratigraphic Header & Cross-Stratum Continuity Filter */}
      <div className="px-4 py-3 border-b border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9]/85 dark:bg-[#141815] space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <Layers
              className={`w-3.5 h-3.5 ${
                isEmber ? 'text-[#ef4423] dark:text-[#ff6b3d]' : 'text-[#2d5a3d] dark:text-[#7fb892]'
              }`}
            />
            <span className="font-semibold text-[#0f1210] dark:text-[#f3f0e9]">
              Procedural &amp; Institutional Stratigraphy
            </span>
            <span className="font-mono-tabular text-[10px] text-[#6a716b] dark:text-[#8d948e]">
              ({data.strataEarliestToLatest.length} strata · {totalItems} extracted items)
            </span>
          </div>

          <div className="inline-flex items-center gap-2 font-mono-tabular text-[10px] uppercase tracking-wider text-[#6a716b] dark:text-[#8d948e]">
            <span className="inline-flex items-center gap-1">
              <ArrowUp className="w-3 h-3 text-[#ef4423] dark:text-[#ff6b3d]" />
              Top: Most Recent
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <ArrowDown className="w-3 h-3" />
              Bottom: Earliest Case
            </span>
          </div>
        </div>

        {/* Cross-Stratum Systemic Theme Highlighter */}
        {data.recurringThemes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-mono-tabular uppercase tracking-wider text-[#6a716b] dark:text-[#8d948e] mr-1">
              <Tag className="w-3 h-3" />
              Trace Fault Line:
            </span>
            <button
              type="button"
              onClick={() => setActiveTheme(null)}
              className={`px-2 py-0.5 text-[10.5px] font-medium border cursor-pointer transition-colors ${
                activeTheme === null
                  ? 'bg-[#0f1210] text-[#faf8f4] border-[#0f1210] dark:bg-[#f3f0e9] dark:text-[#0f1210]'
                  : 'bg-[#faf8f4] dark:bg-[#111413] text-[#6a716b] dark:text-[#8d948e] border-[#ddd8ce] dark:border-[#262b27]'
              }`}
            >
              All Layers
            </button>
            {data.recurringThemes.map((theme) => {
              const active = activeTheme === theme.tag;
              return (
                <button
                  key={theme.tag}
                  type="button"
                  onClick={() => setActiveTheme(active ? null : theme.tag)}
                  className={`px-2 py-0.5 text-[10.5px] font-medium border cursor-pointer transition-colors ${
                    active
                      ? isEmber
                        ? 'bg-[#ef4423] text-white border-[#ef4423]'
                        : 'bg-[#1a2e24] text-[#faf8f4] border-[#1a2e24] dark:bg-[#7fb892] dark:text-[#0c0e0c]'
                      : 'bg-[#faf8f4] dark:bg-[#111413] text-[#4a514b] dark:text-[#a6aba7] border-[#ddd8ce] dark:border-[#262b27] hover:border-[#0f1210]'
                  }`}
                >
                  #{theme.tag}{' '}
                  <span className="font-mono-tabular opacity-75">
                    ({theme.caseCount})
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Top Surface Horizon Marker */}
      <div
        className={`px-4 py-1.5 text-[10px] font-mono-tabular uppercase tracking-[0.14em] flex items-center justify-between border-b border-[#ddd8ce] dark:border-[#262b27] ${
          isEmber
            ? 'bg-[#ef4423]/10 text-[#ef4423] dark:text-[#ff6b3d]'
            : 'bg-[#1a2e24]/10 text-[#1a2e24] dark:text-[#7fb892]'
        }`}
      >
        <span>▲ Surface Horizon — Most Recent Case Stratum</span>
        <span>Law of Superposition: Newest Top / Earliest Bottom</span>
      </div>

      {/* Geological / Institutional Strata Stack (Most Recent Top -> Earliest Bottom) */}
      <div className="divide-y-2 divide-[#c9c3b6] dark:divide-[#2e3530] flex-1 overflow-y-auto max-h-[640px]">
        {displayTopToBottom.map(({ stratum, stratumNumber }, layerIdx) => {
          const stratumMatchesTheme =
            !activeTheme ||
            stratum.tags.some((t) => t.toLowerCase() === activeTheme.toLowerCase()) ||
            stratum.items.some((it) =>
              it.matchedTags.some((mt) => mt.toLowerCase() === activeTheme.toLowerCase())
            );

          const isEven = layerIdx % 2 === 0;
          const layerBg = isEven
            ? 'bg-[#faf8f4] dark:bg-[#141715]'
            : 'bg-[#f1ede4] dark:bg-[#181c19]';

          return (
            <section
              key={stratum.id}
              className={`transition-opacity duration-200 ${layerBg} ${
                stratumMatchesTheme ? 'opacity-100' : 'opacity-35'
              }`}
            >
              <div className="grid grid-cols-1 md:grid-cols-[220px_1fr]">
                {/* Left Geological Horizon / Case Spine */}
                <div
                  className={`p-4 border-b md:border-b-0 md:border-r border-[#ddd8ce] dark:border-[#262b27] flex flex-col justify-between gap-2.5 ${
                    isEmber
                      ? 'border-l-4 border-l-[#ef4423]'
                      : 'border-l-4 border-l-[#2d5a3d]'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.12em] ${
                          isEmber
                            ? 'text-[#ef4423] dark:text-[#ff6b3d]'
                            : 'text-[#2d5a3d] dark:text-[#7fb892]'
                        }`}
                      >
                        Stratum {toRoman(stratumNumber)}
                      </span>
                      <StatusLabel
                        status={stratum.status}
                        variant={isEmber ? 'bright' : 'default'}
                      />
                    </div>

                    <div className="font-mono-tabular text-xs font-semibold text-[#0f1210] dark:text-[#f3f0e9]">
                      {stratum.dateLabel}
                    </div>

                    <div className="text-xs font-semibold text-[#0f1210] dark:text-[#f3f0e9] leading-snug">
                      {stratum.title}
                    </div>

                    <div className="font-mono-tabular text-[10px] text-[#6a716b] dark:text-[#8d948e]">
                      Case No. {stratum.caseNumber}
                      {stratum.court ? ` · ${stratum.court}` : ''}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#e9e5db] dark:border-[#222723] flex items-center justify-between gap-2">
                    <span className="font-mono-tabular text-[10px] text-[#6a716b] dark:text-[#8d948e]">
                      {stratum.items.length} deposit{stratum.items.length === 1 ? '' : 's'}
                    </span>
                    {onOpenStratum && (
                      <button
                        type="button"
                        onClick={() => onOpenStratum(stratum)}
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold hover:underline cursor-pointer ${
                          isEmber
                            ? 'text-[#ef4423] dark:text-[#ff6b3d]'
                            : 'text-[#2d5a3d] dark:text-[#7fb892]'
                        }`}
                      >
                        <span>Open Dossier</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Deposited Analysis Items Horizontal Layer */}
                <div className="p-4 space-y-2.5">
                  {stratum.items.length === 0 ? (
                    <div className="p-3.5 border border-dashed border-[#d4cfc4] dark:border-[#2b312c] text-xs text-[#6a716b] dark:text-[#8d948e] flex flex-wrap items-center justify-between gap-2">
                      <span>
                        No populated findings found in <strong>Procedural &amp; Institutional Analysis</strong> for this stratum yet.
                      </span>
                      {stratum.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {stratum.tags.slice(0, 4).map((t) => (
                            <span
                              key={t}
                              className="font-mono-tabular text-[10px] px-1.5 py-0.5 bg-[#e9e5db] dark:bg-[#1f2420] text-[#4a514b] dark:text-[#c4bfb4]"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono-tabular uppercase tracking-wider text-[#6a716b] dark:text-[#8d948e]">
                        <span>
                          {stratum.sourceMode === 'procedural-analysis'
                            ? `Source: ${stratum.items[0].sourceTitle}`
                            : `Context Fallback: ${stratum.items[0].sourceTitle} (Procedural & Institutional Analysis unpublished/empty)`}
                        </span>
                        {stratum.tags.length > 0 && (
                          <span className="hidden sm:inline">
                            {stratum.tags.slice(0, 3).map((t) => `#${t}`).join(' · ')}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {stratum.items.map((item) => {
                          const isSelected = selectedItem?.item.id === item.id;
                          const itemHighlighted =
                            activeTheme !== null &&
                            (item.matchedTags.some(
                              (mt) => mt.toLowerCase() === activeTheme.toLowerCase()
                            ) ||
                              item.text.toLowerCase().includes(activeTheme.toLowerCase()));

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() =>
                                setSelectedItem(
                                  isSelected ? null : { stratum, item }
                                )
                              }
                              className={`text-left p-3 border transition-colors flex flex-col justify-between gap-2 cursor-pointer ${
                                isSelected
                                  ? isEmber
                                    ? 'bg-[#ef4423]/10 border-[#ef4423] dark:border-[#ff6b3d]'
                                    : 'bg-[#1a2e24]/10 border-[#1a2e24] dark:border-[#7fb892]'
                                  : itemHighlighted
                                  ? isEmber
                                    ? 'bg-[#ef4423]/10 border-[#ef4423]/70'
                                    : 'bg-[#2d5a3d]/10 border-[#2d5a3d]/70'
                                  : 'bg-[#faf8f4]/90 dark:bg-[#0f1210]/70 border-[#ddd8ce] dark:border-[#262b27] hover:border-[#0f1210] dark:hover:border-[#8d948e]'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className={`font-mono-tabular text-[10px] font-semibold ${
                                      isEmber
                                        ? 'text-[#ef4423] dark:text-[#ff6b3d]'
                                        : 'text-[#2d5a3d] dark:text-[#7fb892]'
                                    }`}
                                  >
                                    LAYER {toRoman(stratumNumber)}.{item.index}
                                  </span>
                                  {item.matchedTags.length > 0 && (
                                    <span className="font-mono-tabular text-[9.5px] px-1.5 py-0.5 bg-[#8b3a3a]/10 text-[#8b3a3a] dark:text-[#e39b9b]">
                                      #{item.matchedTags[0]}
                                    </span>
                                  )}
                                </div>
                                {item.heading && (
                                  <div className="text-xs font-semibold text-[#0f1210] dark:text-[#f3f0e9] line-clamp-1">
                                    {item.heading}
                                  </div>
                                )}
                                <p className="text-xs text-[#2b302c] dark:text-[#c4bfb4] leading-relaxed line-clamp-3">
                                  {item.text}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Bottom Bedrock Horizon Marker */}
      <div className="px-4 py-1.5 text-[10px] font-mono-tabular uppercase tracking-[0.14em] flex items-center justify-between border-t border-[#ddd8ce] dark:border-[#262b27] bg-[#e9e5db] dark:bg-[#0e100f] text-[#4a514b] dark:text-[#9ca39d]">
        <span>▼ Bedrock Horizon — Earliest Case Stratum</span>
        <span>{data.strataEarliestToLatest[0]?.dateLabel || 'Foundation Layer'}</span>
      </div>

      {/* Selected Stratum Item Full Detail Drawer */}
      {selectedItem && (
        <div className="p-4 border-t border-[#ddd8ce] dark:border-[#262b27] bg-[#faf8f4] dark:bg-[#111413] space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`font-mono-tabular font-semibold uppercase ${
                  isEmber
                    ? 'text-[#ef4423] dark:text-[#ff6b3d]'
                    : 'text-[#2d5a3d] dark:text-[#7fb892]'
                }`}
              >
                {selectedItem.stratum.title} ({selectedItem.stratum.dateLabel})
              </span>
              <span className="text-[#6a716b]">·</span>
              <span className="font-mono-tabular text-[#6a716b] dark:text-[#8d948e]">
                {selectedItem.item.sourceTitle}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="text-[11px] font-mono-tabular text-[#6a716b] hover:text-[#0f1210] dark:hover:text-[#f3f0e9] cursor-pointer"
            >
              Close Detail ×
            </button>
          </div>
          {selectedItem.item.heading && (
            <div className="text-sm font-semibold text-[#0f1210] dark:text-[#f3f0e9]">
              {selectedItem.item.heading}
            </div>
          )}
          <p className="text-sm leading-relaxed text-[#2b302c] dark:text-[#c4bfb4]">
            {selectedItem.item.text}
          </p>
        </div>
      )}
    </div>
  );
};
