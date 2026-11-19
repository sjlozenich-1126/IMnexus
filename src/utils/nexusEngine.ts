import type {
  CaseActor,
  CaseRecord,
  CaseSection,
  CustomField,
  EvidenceCollection,
  PublicSite,
  TimelineEvent,
  VaultItem,
} from '../types';

export type NexusNodeKind =
  | 'case'
  | 'tag'
  | 'metadata'
  | 'actor'
  | 'collection'
  | 'timeline'
  | 'evidence'
  | 'document';

export interface NexusNode {
  id: string;
  label: string;
  subtitle?: string;
  kind: NexusNodeKind;
  x: number;
  y: number;
  degree: number;
  isPublic?: boolean;
  refId?: string;
  date?: string;
  metaCategory?: string;
  mediaType?: string;
  fileId?: string;
  fileName?: string;
  sha256?: string;
  textContent?: string;
  description?: string;
}

export interface NexusEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  strength: number; // 1 = semantic / tag / metadata bridge, 2 = direct structural link
}

export interface NexusInsight {
  id: string;
  category: 'pattern' | 'bridge' | 'coverage' | 'integrity';
  title: string;
  detail: string;
  focusNodeId?: string;
}

export interface NexusChronoPoint {
  id: string;
  nodeId: string;
  dateLabel: string;
  title: string;
  subtitle?: string;
  tagNodeIds: string[];
  metadataNodeIds: string[];
  actorNodeIds: string[];
  collectionNodeIds: string[];
  artifactNodeIds: string[];
}

export interface NexusGraphData {
  scope: 'case' | 'portfolio';
  title: string;
  nodes: NexusNode[];
  edges: NexusEdge[];
  insights: NexusInsight[];
  chronology: NexusChronoPoint[];
}

export type NexusAxisDimension =
  | 'tag'
  | 'metadata'
  | 'case'
  | 'actor'
  | 'timeline'
  | 'collection'
  | 'artifact';

export interface NexusMatrixCell {
  rowId: string;
  colId: string;
  score: number;
  reasons: string[];
  bridgeNodeIds: string[];
}

export interface NexusMatrixResult {
  rows: NexusNode[];
  cols: NexusNode[];
  cells: Map<string, NexusMatrixCell>;
  maxScore: number;
  isSameAxis: boolean;
}

function truncateLabel(text: string, max = 26): string {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function normalizeToken(input: string): string {
  return input.trim().toLowerCase();
}

function placeArc(
  count: number,
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
  startDeg: number,
  endDeg: number
): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  if (count === 1) {
    const mid = ((startDeg + endDeg) / 2) * (Math.PI / 180);
    return [{ x: cx + Math.cos(mid) * radiusX, y: cy + Math.sin(mid) * radiusY }];
  }
  const coords: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const deg = startDeg + t * (endDeg - startDeg);
    const rad = deg * (Math.PI / 180);
    coords.push({
      x: cx + Math.cos(rad) * radiusX,
      y: cy + Math.sin(rad) * radiusY,
    });
  }
  return coords;
}

function textMentionsToken(haystack: string, needle: string): boolean {
  const clean = normalizeToken(needle);
  if (clean.length < 3) return false;
  const lower = haystack.toLowerCase();
  if (lower.includes(clean)) return true;
  const parts = clean.split(/[\s\-_/]+/).filter((p) => p.length >= 4);
  if (parts.length >= 2) {
    return parts.some((p) => lower.includes(p));
  }
  return false;
}

interface ExtractedMeta {
  key: string;
  category: string;
  value: string;
}

function extractCaseMetadata(params: {
  court?: string;
  judge?: string;
  charge?: string;
  status?: string;
  disposition?: string;
  customFields?: CustomField[];
}): ExtractedMeta[] {
  const items: ExtractedMeta[] = [];
  if (params.court?.trim()) {
    items.push({
      key: `jurisdiction:${normalizeToken(params.court)}`,
      category: 'Jurisdiction / Court',
      value: params.court.trim(),
    });
  }
  if (params.judge?.trim()) {
    items.push({
      key: `lead:${normalizeToken(params.judge)}`,
      category: 'Presiding Lead / Judge',
      value: params.judge.trim(),
    });
  }
  if (params.charge?.trim()) {
    items.push({
      key: `subject:${normalizeToken(params.charge)}`,
      category: 'Subject / Cause',
      value: params.charge.trim(),
    });
  }
  const dispVal = params.disposition?.trim() || params.status?.trim();
  if (dispVal) {
    items.push({
      key: `disposition:${normalizeToken(dispVal)}`,
      category: 'Disposition / Status',
      value: dispVal,
    });
  }
  (params.customFields || []).forEach((cf) => {
    if (cf.label?.trim() && cf.value?.trim()) {
      items.push({
        key: `cf:${normalizeToken(cf.label)}:${normalizeToken(cf.value)}`,
        category: cf.label.trim(),
        value: cf.value.trim(),
      });
    }
  });
  return items;
}

function finalizeDegrees(
  nodes: NexusNode[],
  edges: NexusEdge[]
): {
  nodes: NexusNode[];
  edges: NexusEdge[];
} {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const uniqueEdgesMap = new Map<string, NexusEdge>();
  for (const e of edges) {
    if (e.source === e.target) continue;
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
    const pair = [e.source, e.target].sort().join('::') + `::${e.relation}`;
    if (!uniqueEdgesMap.has(pair)) {
      uniqueEdgesMap.set(pair, e);
    }
  }
  const uniqueEdges = Array.from(uniqueEdgesMap.values());
  const degreeMap = new Map<string, number>();
  for (const e of uniqueEdges) {
    degreeMap.set(e.source, (degreeMap.get(e.source) || 0) + 1);
    degreeMap.set(e.target, (degreeMap.get(e.target) || 0) + 1);
  }
  return {
    nodes: nodes.map((n) => ({ ...n, degree: degreeMap.get(n.id) || 0 })),
    edges: uniqueEdges,
  };
}

export function buildCaseNexus(params: {
  caseId: string;
  caseNumber?: string;
  title: string;
  subtitle?: string;
  court?: string;
  judge?: string;
  charge?: string;
  status?: string;
  disposition?: string;
  customFields?: CustomField[];
  caseTags?: string[];
  sections: Array<{ id: string; order: number; title: string; content: string }>;
  timeline: Array<{ id: string; date: string; time?: string; title: string; description: string }>;
  actors: Array<{ id: string; name: string; role: string; organization?: string; notes?: string }>;
  documents: Array<{
    id: string;
    title: string;
    docType?: string;
    fileId?: string;
    fileName?: string;
    sha256?: string;
    description?: string;
    tags?: string[];
  }>;
  evidence: Array<{
    id: string;
    title: string;
    mediaType: string;
    fileId?: string;
    fileName?: string;
    sha256?: string;
    textContent?: string;
    description?: string;
    tags?: string[];
  }>;
  collections: Array<{
    id: string;
    title: string;
    explanation: string;
    tags?: string[];
    itemIds?: string[];
  }>;
}): NexusGraphData {
  const cx = 500;
  const cy = 290;
  const caseNodeId = `case:${params.caseId}`;
  const nodes: NexusNode[] = [
    {
      id: caseNodeId,
      label: truncateLabel(params.title, 28),
      subtitle: `Case No. ${params.caseNumber || params.caseId}`,
      kind: 'case',
      x: cx,
      y: cy,
      degree: 0,
      refId: params.caseId,
    },
  ];
  const edges: NexusEdge[] = [];

  // 1. Metadata hubs from Case Metadata (Court, Judge, Charge, Disposition, Custom Fields)
  const metaList = extractCaseMetadata({
    court: params.court,
    judge: params.judge,
    charge: params.charge,
    status: params.status,
    disposition: params.disposition,
    customFields: params.customFields,
  }).slice(0, 8);

  const metaCoords = placeArc(metaList.length, cx, cy, 200, 145, -52, 52);
  metaList.forEach((m, idx) => {
    const metaId = `meta:${m.key}`;
    nodes.push({
      id: metaId,
      label: truncateLabel(m.value, 24),
      subtitle: `Case Metadata · ${m.category}`,
      kind: 'metadata',
      metaCategory: m.category,
      x: metaCoords[idx].x,
      y: metaCoords[idx].y,
      degree: 0,
      description: `${m.category}: ${m.value}`,
    });
    edges.push({
      id: `e:case:${metaId}`,
      source: caseNodeId,
      target: metaId,
      relation: m.category,
      strength: 2,
    });
  });

  // 2. Register ALL Tags across Case Metadata, Collections, Evidence, and Documents
  const tagMap = new Map<
    string,
    {
      fromCase: boolean;
      collectionIds: string[];
      evidenceIds: string[];
      docIds: string[];
    }
  >();

  const ensureTag = (raw: string) => {
    const k = normalizeToken(raw);
    if (!k) return null;
    if (!tagMap.has(k)) {
      tagMap.set(k, { fromCase: false, collectionIds: [], evidenceIds: [], docIds: [] });
    }
    return { key: k, entry: tagMap.get(k)! };
  };

  (params.caseTags || []).forEach((t) => {
    const res = ensureTag(t);
    if (res) res.entry.fromCase = true;
  });

  const cappedCollections = params.collections.slice(0, 8);
  const cappedEvidence = params.evidence.slice(0, 12);
  const cappedDocs = params.documents.slice(0, 10);
  const cappedActors = params.actors.slice(0, 10);
  const cappedTimeline = [...params.timeline]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 12);

  cappedCollections.forEach((c) => {
    (c.tags || []).forEach((t) => {
      const res = ensureTag(t);
      if (res && !res.entry.collectionIds.includes(c.id)) {
        res.entry.collectionIds.push(c.id);
      }
    });
  });
  cappedEvidence.forEach((e) => {
    (e.tags || []).forEach((t) => {
      const res = ensureTag(t);
      if (res && !res.entry.evidenceIds.includes(e.id)) {
        res.entry.evidenceIds.push(e.id);
      }
    });
  });
  cappedDocs.forEach((d) => {
    (d.tags || []).forEach((t) => {
      const res = ensureTag(t);
      if (res && !res.entry.docIds.includes(d.id)) {
        res.entry.docIds.push(d.id);
      }
    });
  });

  const sortedTags = Array.from(tagMap.entries())
    .sort((a, b) => {
      const scoreA =
        (a[1].fromCase ? 3 : 0) +
        a[1].collectionIds.length * 2 +
        a[1].evidenceIds.length +
        a[1].docIds.length;
      const scoreB =
        (b[1].fromCase ? 3 : 0) +
        b[1].collectionIds.length * 2 +
        b[1].evidenceIds.length +
        b[1].docIds.length;
      return scoreB - scoreA;
    })
    .slice(0, 10);

  const tagCoords = placeArc(sortedTags.length, cx, cy, 200, 145, 128, 232);
  sortedTags.forEach(([tag, info], idx) => {
    const tagId = `tag:${tag}`;
    const totalLinked =
      (info.fromCase ? 1 : 0) +
      info.collectionIds.length +
      info.evidenceIds.length +
      info.docIds.length;

    nodes.push({
      id: tagId,
      label: `#${tag}`,
      subtitle: `${info.fromCase ? 'Case Metadata Tag · ' : ''}${totalLinked} tagged links`,
      kind: 'tag',
      x: tagCoords[idx].x,
      y: tagCoords[idx].y,
      degree: 0,
      description: `Tag #${tag} links ${
        info.fromCase ? 'this case metadata, ' : ''
      }${info.collectionIds.length} collection(s), ${info.evidenceIds.length} exhibit(s), and ${
        info.docIds.length
      } document(s).`,
    });

    if (info.fromCase) {
      edges.push({
        id: `e:case:${tagId}`,
        source: caseNodeId,
        target: tagId,
        relation: 'case metadata tag',
        strength: 2,
      });
    }
  });

  // 3. Actors & Entities (Upper-Left Outer Arc)
  const actorCoords = placeArc(cappedActors.length, cx, cy, 405, 220, 196, 255);
  cappedActors.forEach((act, idx) => {
    const id = `actor:${act.id}`;
    nodes.push({
      id,
      label: truncateLabel(act.name, 22),
      subtitle: `${act.role}${act.organization ? ` · ${act.organization}` : ''}`,
      kind: 'actor',
      x: actorCoords[idx].x,
      y: actorCoords[idx].y,
      degree: 0,
      refId: act.id,
      description: act.notes,
    });
    edges.push({
      id: `e:case:${id}`,
      source: caseNodeId,
      target: id,
      relation: act.role || 'Party / Actor',
      strength: 2,
    });

    // Cross-link actors to matching Case Metadata (e.g. Judge/Court/CustomField) & Case Tags
    const actorText = `${act.name} ${act.role} ${act.organization || ''} ${act.notes || ''}`;
    metaList.forEach((m) => {
      if (textMentionsToken(actorText, m.value) || textMentionsToken(m.value, act.name)) {
        edges.push({
          id: `e:${id}:meta:${m.key}`,
          source: id,
          target: `meta:${m.key}`,
          relation: `aligned with ${m.category}`,
          strength: 1,
        });
      }
    });
    sortedTags.forEach(([tag]) => {
      if (textMentionsToken(actorText, tag)) {
        edges.push({
          id: `e:${id}:tag:${tag}`,
          source: id,
          target: `tag:${tag}`,
          relation: `referenced under #${tag}`,
          strength: 1,
        });
      }
    });
  });

  // 4. Timeline Events (Upper-Right Outer Arc)
  const timelineCoords = placeArc(cappedTimeline.length, cx, cy, 405, 220, 285, 344);
  cappedTimeline.forEach((ev, idx) => {
    const id = `timeline:${ev.id}`;
    nodes.push({
      id,
      label: truncateLabel(ev.title, 24),
      subtitle: `${ev.date}${ev.time ? ` · ${ev.time}` : ''}`,
      kind: 'timeline',
      date: ev.date,
      x: timelineCoords[idx].x,
      y: timelineCoords[idx].y,
      degree: 0,
      refId: ev.id,
      description: ev.description,
    });
    edges.push({
      id: `e:case:${id}`,
      source: caseNodeId,
      target: id,
      relation: ev.date,
      strength: 2,
    });

    const combinedText = `${ev.title} ${ev.description || ''}`;

    // Link timeline events to Actors mentioned
    cappedActors.forEach((act) => {
      if (textMentionsToken(combinedText, act.name)) {
        edges.push({
          id: `e:act:${act.id}:${id}`,
          source: `actor:${act.id}`,
          target: id,
          relation: 'referenced in event',
          strength: 1,
        });
      }
    });

    // Link timeline events to Case Tags & Metadata mentioned
    sortedTags.forEach(([tag]) => {
      if (textMentionsToken(combinedText, tag)) {
        edges.push({
          id: `e:tag:${tag}:${id}`,
          source: `tag:${tag}`,
          target: id,
          relation: `topic #${tag} in timeline`,
          strength: 1,
        });
      }
    });
    metaList.forEach((m) => {
      if (textMentionsToken(combinedText, m.value)) {
        edges.push({
          id: `e:meta:${m.key}:${id}`,
          source: `meta:${m.key}`,
          target: id,
          relation: `metadata match (${m.category})`,
          strength: 1,
        });
      }
    });
  });

  // 5. Collections (Bottom-Left Outer Arc)
  const collectionCoords = placeArc(cappedCollections.length, cx, cy, 385, 210, 120, 170);
  const collectionItemSet = new Set<string>();
  cappedCollections.forEach((col, idx) => {
    const id = `collection:${col.id}`;
    (col.itemIds || []).forEach((it) => collectionItemSet.add(it));
    nodes.push({
      id,
      label: truncateLabel(col.title, 24),
      subtitle: `${col.itemIds?.length || 0} grouped exhibits`,
      kind: 'collection',
      x: collectionCoords[idx].x,
      y: collectionCoords[idx].y,
      degree: 0,
      refId: col.id,
      description: col.explanation,
    });
    edges.push({
      id: `e:case:${id}`,
      source: caseNodeId,
      target: id,
      relation: 'curated collection',
      strength: 2,
    });
    (col.tags || []).forEach((t) => {
      const k = normalizeToken(t);
      if (tagMap.has(k) && sortedTags.some(([tk]) => tk === k)) {
        edges.push({
          id: `e:tag:${k}:${id}`,
          source: `tag:${k}`,
          target: id,
          relation: `tagged #${k}`,
          strength: 1,
        });
      }
    });
    // Connect collection to actors mentioned in collection explanation
    cappedActors.forEach((act) => {
      if (textMentionsToken(`${col.title} ${col.explanation}`, act.name)) {
        edges.push({
          id: `e:act:${act.id}:${id}`,
          source: `actor:${act.id}`,
          target: id,
          relation: 'featured in collection',
          strength: 1,
        });
      }
    });
  });

  // 6. Bridged Exhibits & Documents ONLY (No raw "Case -> Court Doc" clutter!)
  // An exhibit or document appears ONLY if it bridges via a #Tag, Collection, Timeline match, or Actor mention.
  const bridgedArtifacts: Array<{
    kind: 'evidence' | 'document';
    nodeId: string;
    refId: string;
    label: string;
    subtitle: string;
    mediaType: string;
    fileId?: string;
    fileName?: string;
    sha256?: string;
    textContent?: string;
    description?: string;
    tags: string[];
    bridgeEdges: NexusEdge[];
  }> = [];

  const collectBridgeEdges = (
    itemId: string,
    nodeId: string,
    title: string,
    desc: string | undefined,
    tags: string[]
  ): NexusEdge[] => {
    const found: NexusEdge[] = [];
    // Bridge via #Tag
    tags.forEach((t) => {
      const k = normalizeToken(t);
      if (sortedTags.some(([tk]) => tk === k)) {
        found.push({
          id: `e:tag:${k}:${nodeId}`,
          source: `tag:${k}`,
          target: nodeId,
          relation: `tagged #${k}`,
          strength: 1,
        });
      }
    });
    // Bridge via Collection
    cappedCollections.forEach((col) => {
      if ((col.itemIds || []).includes(itemId)) {
        found.push({
          id: `e:col:${col.id}:${nodeId}`,
          source: `collection:${col.id}`,
          target: nodeId,
          relation: 'grouped in collection',
          strength: 2,
        });
      }
    });
    // Bridge via Timeline corroboration
    const keywords = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 5);
    cappedTimeline.forEach((ev) => {
      const evText = `${ev.title} ${ev.description || ''}`.toLowerCase();
      if (keywords.some((kw) => evText.includes(kw))) {
        found.push({
          id: `e:tl:${ev.id}:${nodeId}`,
          source: `timeline:${ev.id}`,
          target: nodeId,
          relation: 'corroborates event',
          strength: 1,
        });
      }
    });
    // Bridge via Actor mention
    const artText = `${title} ${desc || ''}`;
    cappedActors.forEach((act) => {
      if (textMentionsToken(artText, act.name)) {
        found.push({
          id: `e:act:${act.id}:${nodeId}`,
          source: `actor:${act.id}`,
          target: nodeId,
          relation: 'cites actor',
          strength: 1,
        });
      }
    });
    return found;
  };

  cappedEvidence.forEach((evItem) => {
    const nodeId = `ev:${evItem.id}`;
    const bridges = collectBridgeEdges(
      evItem.id,
      nodeId,
      evItem.title,
      `${evItem.description || ''} ${evItem.textContent || ''}`,
      evItem.tags || []
    );
    if (bridges.length > 0) {
      bridgedArtifacts.push({
        kind: 'evidence',
        nodeId,
        refId: evItem.id,
        label: truncateLabel(evItem.title, 22),
        subtitle: `${evItem.mediaType.toUpperCase()} Exhibit`,
        mediaType: evItem.mediaType,
        fileId: evItem.fileId,
        fileName: evItem.fileName,
        sha256: evItem.sha256,
        textContent: evItem.textContent,
        description: evItem.description,
        tags: evItem.tags || [],
        bridgeEdges: bridges,
      });
    }
  });

  cappedDocs.forEach((docItem) => {
    const nodeId = `doc:${docItem.id}`;
    const bridges = collectBridgeEdges(
      docItem.id,
      nodeId,
      docItem.title,
      docItem.description,
      docItem.tags || []
    );
    // Only include documents that actually bridge via a Tag, Collection, Actor, or Timeline!
    if (bridges.length > 0) {
      bridgedArtifacts.push({
        kind: 'document',
        nodeId,
        refId: docItem.id,
        label: truncateLabel(docItem.title, 22),
        subtitle: docItem.docType || 'Tagged / Linked Record',
        mediaType: 'pdf',
        fileId: docItem.fileId,
        fileName: docItem.fileName,
        sha256: docItem.sha256,
        description: docItem.description,
        tags: docItem.tags || [],
        bridgeEdges: bridges,
      });
    }
  });

  const cappedArtifacts = bridgedArtifacts.slice(0, 12);
  const artifactCoords = placeArc(cappedArtifacts.length, cx, cy, 400, 215, 14, 72);
  cappedArtifacts.forEach((art, idx) => {
    nodes.push({
      id: art.nodeId,
      label: art.label,
      subtitle: art.subtitle,
      kind: art.kind,
      x: artifactCoords[idx].x,
      y: artifactCoords[idx].y,
      degree: 0,
      refId: art.refId,
      mediaType: art.mediaType,
      fileId: art.fileId,
      fileName: art.fileName,
      sha256: art.sha256,
      textContent: art.textContent,
      description: art.description,
    });
    edges.push(...art.bridgeEdges);
  });

  const finalized = finalizeDegrees(nodes, edges);

  // Build Chronology points for the Time-Axis Flow
  const adj = new Map<string, Set<string>>();
  finalized.edges.forEach((e) => {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  });

  const finalizedNodeMap = new Map(finalized.nodes.map((n) => [n.id, n]));
  const chronology: NexusChronoPoint[] = cappedTimeline.map((ev) => {
    const tlId = `timeline:${ev.id}`;
    const direct = Array.from(adj.get(tlId) || []);
    return {
      id: ev.id,
      nodeId: tlId,
      dateLabel: ev.date,
      title: truncateLabel(ev.title, 28),
      subtitle: ev.time || undefined,
      tagNodeIds: direct.filter((id) => finalizedNodeMap.get(id)?.kind === 'tag'),
      metadataNodeIds: direct.filter((id) => finalizedNodeMap.get(id)?.kind === 'metadata'),
      actorNodeIds: direct.filter((id) => finalizedNodeMap.get(id)?.kind === 'actor'),
      collectionNodeIds: direct.filter((id) => finalizedNodeMap.get(id)?.kind === 'collection'),
      artifactNodeIds: direct.filter((id) => {
        const k = finalizedNodeMap.get(id)?.kind;
        return k === 'evidence' || k === 'document';
      }),
    };
  });

  // Insights
  const insights: NexusInsight[] = [];
  if (sortedTags.length > 0) {
    const [topTag, info] = sortedTags[0];
    const count =
      (info.fromCase ? 1 : 0) +
      info.collectionIds.length +
      info.evidenceIds.length +
      info.docIds.length;
    insights.push({
      id: 'ins:tag-hub',
      category: 'pattern',
      title: `Primary Tag Hub: #${topTag}`,
      detail: `Connects ${count} entities across ${info.fromCase ? 'case metadata, ' : ''}${
        info.collectionIds.length
      } collection(s), and ${info.evidenceIds.length + info.docIds.length} tagged record(s).`,
      focusNodeId: `tag:${topTag}`,
    });
  } else {
    insights.push({
      id: 'ins:add-tags',
      category: 'pattern',
      title: 'Add Case & Artifact Tags',
      detail: 'Add comma-separated tags in Case Metadata or Vault items to illuminate recurring themes across the Nexus.',
      focusNodeId: caseNodeId,
    });
  }

  if (metaList.length > 0) {
    const topMeta =
      finalized.nodes
        .filter((n) => n.kind === 'metadata')
        .sort((a, b) => b.degree - a.degree)[0] || null;
    insights.push({
      id: 'ins:metadata-axis',
      category: 'bridge',
      title: `${metaList.length} Metadata Axis Node${metaList.length === 1 ? '' : 's'}`,
      detail: topMeta
        ? `${topMeta.metaCategory || 'Metadata'} ("${topMeta.label}") anchors ${topMeta.degree} relational link(s).`
        : 'Jurisdiction, presiding lead, subject, disposition, and custom fields active in Nexus.',
      focusNodeId: topMeta?.id,
    });
  }

  const topActor = finalized.nodes
    .filter((n) => n.kind === 'actor')
    .sort((a, b) => b.degree - a.degree)[0];
  if (topActor) {
    insights.push({
      id: 'ins:actor-hub',
      category: 'bridge',
      title: `Actor Axis: ${topActor.label}`,
      detail: `Connected across ${topActor.degree} chronological events, metadata alignments, and records.`,
      focusNodeId: topActor.id,
    });
  }

  const narrativeCorroborations = params.sections.reduce((acc, s) => {
    const body = `${s.title} ${s.content}`.toLowerCase();
    return (
      acc +
      cappedActors.filter((a) => textMentionsToken(body, a.name)).length +
      sortedTags.filter(([t]) => textMentionsToken(body, t)).length
    );
  }, 0);

  const hashedCount = [...cappedDocs, ...cappedEvidence].filter((i) => Boolean(i.sha256)).length;
  insights.push({
    id: 'ins:integrity',
    category: 'integrity',
    title: 'Cross-Layer Traceability',
    detail: `${bridgedArtifacts.length} tagged/grouped record(s) bridged via tags & collections; ${narrativeCorroborations} actor/tag citations verified; ${hashedCount} SHA-256 digests.`,
  });

  return {
    scope: 'case',
    title: params.title,
    nodes: finalized.nodes,
    edges: finalized.edges,
    insights: insights.slice(0, 4),
    chronology,
  };
}

export function buildPublicSiteNexus(site: PublicSite): NexusGraphData {
  const collectionsWithIds = (site.collections || []).map((c) => ({
    id: c.id,
    title: c.title,
    explanation: c.explanation,
    tags: c.tags || [],
    itemIds: c.items.map((it) => it.id),
  }));

  // Derive concise thematic tags from metadata & evidence/collections
  const derivedCaseTags = Array.from(
    new Set([
      ...(site.collections || []).flatMap((c) => c.tags || []),
      ...(site.evidence || []).flatMap((e) => e.tags || []),
    ])
  ).slice(0, 8);

  return buildCaseNexus({
    caseId: site.caseId || site.slug,
    caseNumber: site.caseNumber,
    title: site.headline || site.title,
    subtitle: site.subtitle,
    court: site.court,
    judge: site.judge,
    charge: site.charge,
    status: site.status,
    disposition: site.disposition,
    customFields: site.customFields,
    caseTags: derivedCaseTags,
    sections: site.sections || [],
    timeline: site.timeline || [],
    actors: site.actors || [],
    documents: site.documents || [],
    evidence: site.evidence || [],
    collections: collectionsWithIds,
  });
}

export function buildPortfolioNexus(params: {
  cases: CaseRecord[];
  vaultItems: VaultItem[];
  collections: EvidenceCollection[];
}): NexusGraphData {
  const { cases, vaultItems, collections } = params;
  const cx = 500;
  const cy = 290;
  const nodes: NexusNode[] = [];
  const edges: NexusEdge[] = [];

  const cappedCases = cases.slice(0, 12);
  const cappedCols = collections.slice(0, 8);

  // 1. Place Cases cleanly at the heart of the portfolio nexus
  const caseCoords =
    cappedCases.length === 1
      ? [{ x: cx, y: cy }]
      : placeArc(cappedCases.length, cx, cy, 175, 115, -90, 230);

  cappedCases.forEach((c, idx) => {
    nodes.push({
      id: `case:${c.id}`,
      label: truncateLabel(c.title, 24),
      subtitle: `Case ${c.caseNumber} · ${c.status}`,
      kind: 'case',
      date: c.arrestDates || c.closureDate || c.caseNumber,
      x: caseCoords[idx].x,
      y: caseCoords[idx].y,
      degree: 0,
      isPublic: c.isPublished,
      refId: c.id,
      description: c.summary,
    });
  });

  // 2. Shared & Case Metadata Attributes (Court/Jurisdiction, Judge/Lead, Subject/Charge, Disposition, Custom Fields)
  const metaIndex = new Map<
    string,
    { meta: ExtractedMeta; caseIds: string[] }
  >();

  cappedCases.forEach((c) => {
    const metas = extractCaseMetadata({
      court: c.court,
      judge: c.judge,
      charge: c.charge,
      status: c.status,
      disposition: c.disposition,
      customFields: c.customFields,
    });
    metas.forEach((m) => {
      if (!metaIndex.has(m.key)) {
        metaIndex.set(m.key, { meta: m, caseIds: [] });
      }
      const bucket = metaIndex.get(m.key)!;
      if (!bucket.caseIds.includes(c.id)) {
        bucket.caseIds.push(c.id);
      }
    });
  });

  // Prioritize Metadata Hubs shared by 2+ cases, plus primary jurisdiction/subject metadata
  const sortedMetas = Array.from(metaIndex.values())
    .sort((a, b) => b.caseIds.length - a.caseIds.length)
    .slice(0, 10);

  const metaCoords = placeArc(sortedMetas.length, cx, cy, 405, 220, -58, 58);
  sortedMetas.forEach((entry, idx) => {
    const metaNodeId = `meta:${entry.meta.key}`;
    nodes.push({
      id: metaNodeId,
      label: truncateLabel(entry.meta.value, 24),
      subtitle: `${entry.meta.category} · ${entry.caseIds.length} case(s)`,
      kind: 'metadata',
      metaCategory: entry.meta.category,
      x: metaCoords[idx].x,
      y: metaCoords[idx].y,
      degree: 0,
      description: `${entry.meta.category}: ${entry.meta.value} (linked across ${entry.caseIds.length} case${
        entry.caseIds.length === 1 ? '' : 's'
      })`,
    });
    entry.caseIds.forEach((cid) => {
      edges.push({
        id: `e:meta:${entry.meta.key}:case:${cid}`,
        source: metaNodeId,
        target: `case:${cid}`,
        relation: entry.meta.category,
        strength: entry.caseIds.length >= 2 ? 2 : 1,
      });
    });
  });

  // 3. Tags across Cases, Collections, and Vault Items (Primary connective tissue!)
  const tagMap = new Map<
    string,
    { caseIds: string[]; collectionIds: string[]; bridgeItemIds: string[] }
  >();
  const ensureTag = (raw: string) => {
    const k = normalizeToken(raw);
    if (!k) return null;
    if (!tagMap.has(k)) {
      tagMap.set(k, { caseIds: [], collectionIds: [], bridgeItemIds: [] });
    }
    return tagMap.get(k)!;
  };

  cappedCases.forEach((c) => {
    (c.tags || []).forEach((t) => {
      const bucket = ensureTag(t);
      if (bucket && !bucket.caseIds.includes(c.id)) bucket.caseIds.push(c.id);
    });
  });
  cappedCols.forEach((col) => {
    (col.tags || []).forEach((t) => {
      const bucket = ensureTag(t);
      if (bucket && !bucket.collectionIds.includes(col.id)) bucket.collectionIds.push(col.id);
    });
  });
  vaultItems.forEach((v) => {
    (v.tags || []).forEach((t) => {
      const bucket = ensureTag(t);
      if (bucket) {
        if (!bucket.bridgeItemIds.includes(v.id)) bucket.bridgeItemIds.push(v.id);
        // Also propagate evidence tag to its linked cases for cross-case tag discovery
        v.caseIds.forEach((cid) => {
          if (cappedCases.some((c) => c.id === cid) && !bucket.caseIds.includes(cid)) {
            bucket.caseIds.push(cid);
          }
        });
      }
    });
  });

  const sortedTags = Array.from(tagMap.entries())
    .sort((a, b) => {
      const countA = a[1].caseIds.length * 3 + a[1].collectionIds.length * 2 + a[1].bridgeItemIds.length;
      const countB = b[1].caseIds.length * 3 + b[1].collectionIds.length * 2 + b[1].bridgeItemIds.length;
      return countB - countA;
    })
    .slice(0, 12);

  const tagCoords = placeArc(sortedTags.length, cx, cy, 400, 215, 192, 345);
  sortedTags.forEach(([tag, info], idx) => {
    const tagId = `tag:${tag}`;
    nodes.push({
      id: tagId,
      label: `#${tag}`,
      subtitle: `${info.caseIds.length} case(s) · ${info.collectionIds.length} col(s) · ${info.bridgeItemIds.length} item(s)`,
      kind: 'tag',
      x: tagCoords[idx].x,
      y: tagCoords[idx].y,
      degree: 0,
      description: `Portfolio tag #${tag} links ${info.caseIds.length} case(s), ${info.collectionIds.length} collection(s), and ${info.bridgeItemIds.length} tagged item(s).`,
    });
    info.caseIds.forEach((cid) => {
      edges.push({
        id: `e:${tagId}:case:${cid}`,
        source: tagId,
        target: `case:${cid}`,
        relation: `shared tag #${tag}`,
        strength: 1,
      });
    });
  });

  // 4. Collections (Lower-Left Arc)
  const colCoords = placeArc(cappedCols.length, cx, cy, 380, 200, 130, 180);
  cappedCols.forEach((col, idx) => {
    const id = `collection:${col.id}`;
    nodes.push({
      id,
      label: truncateLabel(col.title, 22),
      subtitle: `${col.itemIds.length} grouped items`,
      kind: 'collection',
      x: colCoords[idx].x,
      y: colCoords[idx].y,
      degree: 0,
      isPublic: col.isPublic,
      refId: col.id,
      description: col.explanation,
    });
    if (col.caseId && cappedCases.some((c) => c.id === col.caseId)) {
      edges.push({
        id: `e:${id}:case:${col.caseId}`,
        source: id,
        target: `case:${col.caseId}`,
        relation: 'curated collection',
        strength: 2,
      });
    }
    (col.tags || []).forEach((t) => {
      const k = normalizeToken(t);
      if (sortedTags.some(([tk]) => tk === k)) {
        edges.push({
          id: `e:tag:${k}:${id}`,
          source: `tag:${k}`,
          target: id,
          relation: `tagged #${k}`,
          strength: 1,
        });
      }
    });
  });

  // 5. Bridge Vault Artifacts ONLY (items spanning 2+ cases OR carrying shared tags across collections/cases)
  const sharedTagKeys = new Set(
    sortedTags
      .filter(([, info]) => info.caseIds.length + info.collectionIds.length >= 2)
      .map(([k]) => k)
  );
  const bridgeItems = vaultItems
    .filter((v) => {
      const multiCase = v.caseIds.length >= 2;
      const hasSharedTag = v.tags.some((t) => sharedTagKeys.has(normalizeToken(t)));
      return multiCase || hasSharedTag;
    })
    .slice(0, 10);

  const bridgeCoords = placeArc(bridgeItems.length, cx, cy, 385, 210, 68, 120);
  bridgeItems.forEach((item, idx) => {
    const kind: NexusNodeKind = item.category === 'document' ? 'document' : 'evidence';
    const id = `vault:${item.id}`;
    nodes.push({
      id,
      label: truncateLabel(item.title, 22),
      subtitle: `${item.caseIds.length >= 2 ? 'Multi-case bridge · ' : ''}${item.mediaType.toUpperCase()}`,
      kind,
      x: bridgeCoords[idx].x,
      y: bridgeCoords[idx].y,
      degree: 0,
      isPublic: item.isPublic,
      refId: item.id,
      mediaType: item.mediaType,
      fileId: item.fileId,
      fileName: item.fileName,
      sha256: item.sha256,
      textContent: item.textContent,
      description: item.description,
    });

    item.tags.forEach((t) => {
      const k = normalizeToken(t);
      if (sortedTags.some(([tk]) => tk === k)) {
        edges.push({
          id: `e:tag:${k}:${id}`,
          source: `tag:${k}`,
          target: id,
          relation: `tagged #${k}`,
          strength: 1,
        });
      }
    });

    if (item.caseIds.length >= 2) {
      item.caseIds.forEach((cid) => {
        if (cappedCases.some((c) => c.id === cid)) {
          edges.push({
            id: `e:${id}:case:${cid}`,
            source: id,
            target: `case:${cid}`,
            relation: 'cross-case bridge',
            strength: 2,
          });
        }
      });
    }

    cappedCols.forEach((col) => {
      if (col.itemIds.includes(item.id)) {
        edges.push({
          id: `e:col:${col.id}:${id}`,
          source: `collection:${col.id}`,
          target: id,
          relation: 'member of collection',
          strength: 2,
        });
      }
    });
  });

  const finalized = finalizeDegrees(nodes, edges);

  // Portfolio chronology: Cases plotted as sequential axis entries aligned with Tags, Metadata & Collections
  const adj = new Map<string, Set<string>>();
  finalized.edges.forEach((e) => {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  });
  const nodeMap = new Map(finalized.nodes.map((n) => [n.id, n]));

  const chronology: NexusChronoPoint[] = cappedCases.map((c) => {
    const cNodeId = `case:${c.id}`;
    const direct = Array.from(adj.get(cNodeId) || []);
    return {
      id: c.id,
      nodeId: cNodeId,
      dateLabel: c.arrestDates || c.closureDate || c.caseNumber,
      title: truncateLabel(c.title, 26),
      subtitle: `${c.status}${c.court ? ` · ${c.court}` : ''}`,
      tagNodeIds: direct.filter((id) => nodeMap.get(id)?.kind === 'tag'),
      metadataNodeIds: direct.filter((id) => nodeMap.get(id)?.kind === 'metadata'),
      actorNodeIds: [],
      collectionNodeIds: direct.filter((id) => nodeMap.get(id)?.kind === 'collection'),
      artifactNodeIds: direct.filter((id) => {
        const k = nodeMap.get(id)?.kind;
        return k === 'evidence' || k === 'document';
      }),
    };
  });

  const insights: NexusInsight[] = [];
  const multiCaseTag = sortedTags.find(([, info]) => info.caseIds.length >= 2);
  if (multiCaseTag) {
    const [topTag, info] = multiCaseTag;
    insights.push({
      id: 'port:tag',
      category: 'pattern',
      title: `Cross-Case Tag Hub: #${topTag}`,
      detail: `Connects ${info.caseIds.length} cases, ${info.collectionIds.length} collections, and ${info.bridgeItemIds.length} items.`,
      focusNodeId: `tag:${topTag}`,
    });
  } else if (sortedTags.length > 0) {
    const [topTag, info] = sortedTags[0];
    insights.push({
      id: 'port:tag',
      category: 'pattern',
      title: `Active Tag Axis: #${topTag}`,
      detail: `Links ${info.caseIds.length + info.collectionIds.length + info.bridgeItemIds.length} metadata/vault entities.`,
      focusNodeId: `tag:${topTag}`,
    });
  }

  const sharedMeta = sortedMetas.find((m) => m.caseIds.length >= 2);
  if (sharedMeta) {
    insights.push({
      id: 'port:meta-bridge',
      category: 'bridge',
      title: `Shared ${sharedMeta.meta.category}`,
      detail: `"${sharedMeta.meta.value}" bridges ${sharedMeta.caseIds.length} distinct cases across the archive.`,
      focusNodeId: `meta:${sharedMeta.meta.key}`,
    });
  } else {
    const multiCaseItems = vaultItems.filter((v) => v.caseIds.length >= 2).length;
    insights.push({
      id: 'port:meta-bridge',
      category: 'bridge',
      title:
        multiCaseItems > 0
          ? `Shared Evidence Bridges (${multiCaseItems})`
          : `Metadata Nodes Active (${sortedMetas.length})`,
      detail:
        multiCaseItems > 0
          ? `${multiCaseItems} artifact(s) span 2 or more cases.`
          : `${sortedMetas.length} jurisdiction, lead, subject, and disposition fields indexed across ${cases.length} case(s).`,
      focusNodeId: sortedMetas[0] ? `meta:${sortedMetas[0].meta.key}` : undefined,
    });
  }

  const taggedCases = cases.filter((c) => (c.tags || []).length > 0).length;
  insights.push({
    id: 'port:tag-coverage',
    category: 'coverage',
    title: 'Case Metadata Tagging',
    detail: `${taggedCases} of ${cases.length} case dossier(s) carry structured metadata tags across ${sortedTags.length} tag hubs.`,
  });

  insights.push({
    id: 'port:published',
    category: 'integrity',
    title: 'Public Archive Readiness',
    detail: `${cases.filter((c) => c.isPublished).length} of ${cases.length} cases live with ${collections.filter((c) => c.isPublic).length} public collections.`,
  });

  return {
    scope: 'portfolio',
    title: 'IMnexus Portfolio Relationship & Axis Map',
    nodes: finalized.nodes,
    edges: finalized.edges,
    insights,
    chronology,
  };
}

export function buildSingleCaseFromWorkspace(params: {
  caseRecord: CaseRecord;
  sections: CaseSection[];
  timeline: TimelineEvent[];
  actors: CaseActor[];
  vaultItems: VaultItem[];
  collections: EvidenceCollection[];
}): NexusGraphData {
  const { caseRecord, sections, timeline, actors, vaultItems, collections } = params;
  const docs = vaultItems
    .filter((v) => v.category === 'document' && v.caseIds.includes(caseRecord.id))
    .map((d) => ({
      id: d.id,
      title: d.title,
      docType: d.docType,
      fileId: d.fileId,
      fileName: d.fileName,
      sha256: d.sha256,
      description: d.description,
      tags: d.tags,
    }));
  const ev = vaultItems
    .filter((v) => v.category === 'evidence' && v.caseIds.includes(caseRecord.id))
    .map((e) => ({
      id: e.id,
      title: e.title,
      mediaType: e.mediaType,
      fileId: e.fileId,
      fileName: e.fileName,
      sha256: e.sha256,
      textContent: e.textContent,
      description: e.description,
      tags: e.tags,
    }));
  const cols = collections
    .filter((c) => c.caseId === caseRecord.id)
    .map((c) => ({
      id: c.id,
      title: c.title,
      explanation: c.explanation,
      tags: c.tags,
      itemIds: c.itemIds,
    }));

  return buildCaseNexus({
    caseId: caseRecord.id,
    caseNumber: caseRecord.caseNumber,
    title: caseRecord.title,
    subtitle: caseRecord.court,
    court: caseRecord.court,
    judge: caseRecord.judge,
    charge: caseRecord.charge,
    status: caseRecord.status,
    disposition: caseRecord.disposition,
    customFields: caseRecord.customFields,
    caseTags: caseRecord.tags || [],
    sections,
    timeline,
    actors,
    documents: docs,
    evidence: ev,
    collections: cols,
  });
}

function getNodesForAxis(nodes: NexusNode[], axis: NexusAxisDimension): NexusNode[] {
  if (axis === 'artifact') {
    return nodes.filter((n) => n.kind === 'evidence' || n.kind === 'document');
  }
  return nodes.filter((n) => n.kind === axis);
}

/**
 * Computes an interactive X-Axis × Y-Axis Matrix from Nexus nodes & edges,
 * including both 1-hop direct connections and 2-hop shared-bridge connections
 * (e.g., Case A ↔ #Tag ↔ Case B, or Tag ↔ Collection ↔ Timeline).
 */
export function computeNexusAxisMatrix(
  graph: NexusGraphData,
  yAxis: NexusAxisDimension,
  xAxis: NexusAxisDimension
): NexusMatrixResult {
  const rows = getNodesForAxis(graph.nodes, yAxis).slice(0, 12);
  const cols = getNodesForAxis(graph.nodes, xAxis).slice(0, 12);
  const isSameAxis = yAxis === xAxis;

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const adj = new Map<string, Array<{ targetId: string; relation: string }>>();
  graph.edges.forEach((e) => {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push({ targetId: e.target, relation: e.relation });
    adj.get(e.target)!.push({ targetId: e.source, relation: e.relation });
  });

  const cells = new Map<string, NexusMatrixCell>();
  let maxScore = 0;

  for (const r of rows) {
    const rNeighbors = adj.get(r.id) || [];
    const rNeighborSet = new Set(rNeighbors.map((x) => x.targetId));

    for (const c of cols) {
      if (r.id === c.id) continue;
      const reasons: string[] = [];
      const bridgeNodeIds: string[] = [];

      // 1-hop direct edge
      for (const n of rNeighbors) {
        if (n.targetId === c.id) {
          reasons.push(`Direct: ${n.relation}`);
        }
      }

      // 2-hop shared bridge (prioritizing Tags, Metadata, Actors, Collections)
      const cNeighbors = adj.get(c.id) || [];
      for (const cn of cNeighbors) {
        if (rNeighborSet.has(cn.targetId)) {
          const bridgeNode = nodeMap.get(cn.targetId);
          if (!bridgeNode) continue;
          // In portfolio or same-axis comparisons, avoid trivial "central case" self-overlap when comparing non-case entities in single-case scope unless meaningful
          if (graph.scope === 'case' && bridgeNode.kind === 'case' && !isSameAxis) {
            continue;
          }
          if (!bridgeNodeIds.includes(bridgeNode.id)) {
            bridgeNodeIds.push(bridgeNode.id);
            reasons.push(`Via ${bridgeNode.kind}: ${bridgeNode.label}`);
          }
        }
      }

      if (reasons.length > 0) {
        const score = reasons.length;
        if (score > maxScore) maxScore = score;
        cells.set(`${r.id}::${c.id}`, {
          rowId: r.id,
          colId: c.id,
          score,
          reasons: reasons.slice(0, 8),
          bridgeNodeIds,
        });
      }
    }
  }

  return { rows, cols, cells, maxScore, isSameAxis };
}
