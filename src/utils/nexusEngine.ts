import type {
  CaseActor,
  CaseRecord,
  CaseSection,
  EvidenceCollection,
  PublicSite,
  TimelineEvent,
  VaultItem,
} from '../types';

export type NexusNodeKind =
  | 'case'
  | 'actor'
  | 'timeline'
  | 'collection'
  | 'document'
  | 'evidence'
  | 'tag';

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
  strength: number; // 1 = contextual/tag/text match, 2 = structural link
}

export interface NexusInsight {
  id: string;
  category: 'pattern' | 'bridge' | 'coverage' | 'integrity';
  title: string;
  detail: string;
  focusNodeId?: string;
}

export interface NexusGraphData {
  title: string;
  nodes: NexusNode[];
  edges: NexusEdge[];
  insights: NexusInsight[];
}

function truncateLabel(text: string, max = 26): string {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
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

function normalizeToken(input: string): string {
  return input.trim().toLowerCase();
}

function textMentionsName(haystack: string, name: string): boolean {
  const cleanName = normalizeToken(name);
  if (cleanName.length < 4) return false;
  const lower = haystack.toLowerCase();
  if (lower.includes(cleanName)) return true;
  const parts = cleanName.split(/\s+/).filter((p) => p.length >= 4);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    return lower.includes(last);
  }
  return false;
}

function finalizeDegrees(nodes: NexusNode[], edges: NexusEdge[]): {
  nodes: NexusNode[];
  edges: NexusEdge[];
} {
  const uniqueEdgesMap = new Map<string, NexusEdge>();
  for (const e of edges) {
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
  const nodes: NexusNode[] = [
    {
      id: `case:${params.caseId}`,
      label: truncateLabel(params.title, 30),
      subtitle: `Case No. ${params.caseNumber || params.caseId}`,
      kind: 'case',
      x: cx,
      y: cy,
      degree: 0,
      refId: params.caseId,
    },
  ];
  const edges: NexusEdge[] = [];

  const cappedActors = params.actors.slice(0, 10);
  const cappedTimeline = params.timeline.slice(0, 10);
  const cappedCollections = params.collections.slice(0, 8);
  const cappedDocs = params.documents.slice(0, 8);
  const cappedEvidence = params.evidence.slice(0, 10);

  // Quadrant placement around central nexus node
  const actorCoords = placeArc(cappedActors.length, cx, cy, 380, 215, 195, 255);
  const timelineCoords = placeArc(cappedTimeline.length, cx, cy, 390, 215, 285, 345);
  const collectionCoords = placeArc(cappedCollections.length, cx, cy, 360, 200, 120, 172);
  const artifactTotal = cappedDocs.length + cappedEvidence.length;
  const artifactCoords = placeArc(artifactTotal, cx, cy, 395, 215, 10, 78);

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
      source: `case:${params.caseId}`,
      target: id,
      relation: act.role || 'Party / Actor',
      strength: 2,
    });
  });

  cappedTimeline.forEach((ev, idx) => {
    const id = `timeline:${ev.id}`;
    nodes.push({
      id,
      label: truncateLabel(ev.title, 24),
      subtitle: `${ev.date}${ev.time ? ` · ${ev.time}` : ''}`,
      kind: 'timeline',
      x: timelineCoords[idx].x,
      y: timelineCoords[idx].y,
      degree: 0,
      refId: ev.id,
      description: ev.description,
    });
    edges.push({
      id: `e:case:${id}`,
      source: `case:${params.caseId}`,
      target: id,
      relation: ev.date,
      strength: 2,
    });

    // Semantic actor co-occurrence in timeline events
    const combinedText = `${ev.title} ${ev.description || ''}`;
    for (const act of cappedActors) {
      if (textMentionsName(combinedText, act.name)) {
        edges.push({
          id: `e:act:${act.id}:${id}`,
          source: `actor:${act.id}`,
          target: id,
          relation: 'referenced in event',
          strength: 1,
        });
      }
    }
  });

  cappedCollections.forEach((col, idx) => {
    const id = `collection:${col.id}`;
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
      source: `case:${params.caseId}`,
      target: id,
      relation: 'curated collection',
      strength: 2,
    });
  });

  const artifactNodes: NexusNode[] = [];
  cappedDocs.forEach((docItem, idx) => {
    const id = `doc:${docItem.id}`;
    const pos = artifactCoords[idx];
    const node: NexusNode = {
      id,
      label: truncateLabel(docItem.title, 24),
      subtitle: docItem.docType || 'Document',
      kind: 'document',
      x: pos.x,
      y: pos.y,
      degree: 0,
      refId: docItem.id,
      mediaType: 'pdf',
      fileId: docItem.fileId,
      fileName: docItem.fileName,
      sha256: docItem.sha256,
      description: docItem.description,
    };
    nodes.push(node);
    artifactNodes.push(node);
    edges.push({
      id: `e:case:${id}`,
      source: `case:${params.caseId}`,
      target: id,
      relation: 'filed document',
      strength: 2,
    });
  });

  cappedEvidence.forEach((evItem, idx) => {
    const id = `ev:${evItem.id}`;
    const pos = artifactCoords[cappedDocs.length + idx];
    const node: NexusNode = {
      id,
      label: truncateLabel(evItem.title, 24),
      subtitle: `${evItem.mediaType.toUpperCase()} Exhibit`,
      kind: 'evidence',
      x: pos.x,
      y: pos.y,
      degree: 0,
      refId: evItem.id,
      mediaType: evItem.mediaType,
      fileId: evItem.fileId,
      fileName: evItem.fileName,
      sha256: evItem.sha256,
      textContent: evItem.textContent,
      description: evItem.description,
    };
    nodes.push(node);
    artifactNodes.push(node);
    edges.push({
      id: `e:case:${id}`,
      source: `case:${params.caseId}`,
      target: id,
      relation: `${evItem.mediaType} exhibit`,
      strength: 2,
    });
  });

  // Collection <-> item edges
  for (const col of cappedCollections) {
    for (const itemId of col.itemIds || []) {
      const targetDoc = cappedDocs.find((d) => d.id === itemId);
      const targetEv = cappedEvidence.find((e) => e.id === itemId);
      if (targetDoc) {
        edges.push({
          id: `e:col:${col.id}:doc:${itemId}`,
          source: `collection:${col.id}`,
          target: `doc:${itemId}`,
          relation: 'grouped in collection',
          strength: 2,
        });
      }
      if (targetEv) {
        edges.push({
          id: `e:col:${col.id}:ev:${itemId}`,
          source: `collection:${col.id}`,
          target: `ev:${itemId}`,
          relation: 'grouped in collection',
          strength: 2,
        });
      }
    }
  }

  // Tag hubs linking 2+ artifacts or collections
  const tagLinks = new Map<string, string[]>();
  const registerTag = (tag: string, nodeId: string) => {
    const key = normalizeToken(tag);
    if (!key) return;
    const arr = tagLinks.get(key) || [];
    if (!arr.includes(nodeId)) arr.push(nodeId);
    tagLinks.set(key, arr);
  };

  cappedEvidence.forEach((e) => (e.tags || []).forEach((t) => registerTag(t, `ev:${e.id}`)));
  cappedDocs.forEach((d) => (d.tags || []).forEach((t) => registerTag(t, `doc:${d.id}`)));
  cappedCollections.forEach((c) => (c.tags || []).forEach((t) => registerTag(t, `collection:${c.id}`)));

  const sharedTags = Array.from(tagLinks.entries())
    .filter(([, ids]) => ids.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 6);

  const tagCoords = placeArc(sharedTags.length, cx, cy, 185, 130, -70, 250);
  sharedTags.forEach(([tag, targetIds], idx) => {
    const tagNodeId = `tag:${tag}`;
    nodes.push({
      id: tagNodeId,
      label: `#${tag}`,
      subtitle: `Shared tag · ${targetIds.length} linked artifacts`,
      kind: 'tag',
      x: tagCoords[idx].x,
      y: tagCoords[idx].y,
      degree: 0,
    });
    for (const targetId of targetIds) {
      edges.push({
        id: `e:${tagNodeId}:${targetId}`,
        source: tagNodeId,
        target: targetId,
        relation: `shared tag #${tag}`,
        strength: 1,
      });
    }
  });

  // Corroborate timeline events against documents/evidence by keyword overlap
  for (const ev of cappedTimeline) {
    const evText = `${ev.title} ${ev.description || ''}`.toLowerCase();
    for (const art of artifactNodes) {
      const keywords = art.label
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 5);
      if (keywords.some((kw) => evText.includes(kw))) {
        edges.push({
          id: `e:tl:${ev.id}:${art.id}`,
          source: `timeline:${ev.id}`,
          target: art.id,
          relation: 'corroborated record',
          strength: 1,
        });
      }
    }
  }

  const finalized = finalizeDegrees(nodes, edges);

  // Insights
  const insights: NexusInsight[] = [];
  const topActor = finalized.nodes
    .filter((n) => n.kind === 'actor')
    .sort((a, b) => b.degree - a.degree)[0];
  if (topActor && topActor.degree > 1) {
    insights.push({
      id: 'ins:actor-hub',
      category: 'bridge',
      title: `Primary Actor Hub: ${topActor.label}`,
      detail: `Connected across ${topActor.degree} record links including timeline events and dossier context.`,
      focusNodeId: topActor.id,
    });
  }

  if (sharedTags.length > 0) {
    const [topTag, ids] = sharedTags[0];
    insights.push({
      id: 'ins:tag-pattern',
      category: 'pattern',
      title: `Recurring Tag Cluster: #${topTag}`,
      detail: `Bridges ${ids.length} distinct exhibits or collections inside this case record.`,
      focusNodeId: `tag:${topTag}`,
    });
  }

  const narrativeCorroborations = params.sections.reduce((acc, s) => {
    const body = `${s.title} ${s.content}`.toLowerCase();
    return acc + cappedActors.filter((a) => textMentionsName(body, a.name)).length;
  }, 0);

  insights.push({
    id: 'ins:coverage',
    category: 'coverage',
    title: 'Collection & Narrative Traceability',
    detail: `${cappedCollections.length} curated collection(s) organize ${artifactTotal} records; ${narrativeCorroborations} actor citations verified across narrative chapters.`,
  });

  const hashedCount = [...cappedDocs, ...cappedEvidence].filter((i) => Boolean(i.sha256)).length;
  insights.push({
    id: 'ins:integrity',
    category: 'integrity',
    title: 'Chain-of-Custody Verification',
    detail: `${hashedCount} of ${artifactTotal} artifacts carry SHA-256 cryptographic digests alongside ${cappedTimeline.length} dated chronological entries.`,
  });

  return {
    title: params.title,
    nodes: finalized.nodes,
    edges: finalized.edges,
    insights,
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

  return buildCaseNexus({
    caseId: site.caseId || site.slug,
    caseNumber: site.caseNumber,
    title: site.headline || site.title,
    subtitle: site.subtitle,
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

  const cappedCases = cases.slice(0, 10);
  const cappedCols = collections.slice(0, 8);
  const cappedItems = vaultItems.slice(0, 16);

  const caseCoords =
    cappedCases.length === 1
      ? [{ x: cx, y: cy }]
      : placeArc(cappedCases.length, cx, cy, 175, 120, -90, 230);

  cappedCases.forEach((c, idx) => {
    nodes.push({
      id: `case:${c.id}`,
      label: truncateLabel(c.title, 24),
      subtitle: `Case ${c.caseNumber} · ${c.status}`,
      kind: 'case',
      x: caseCoords[idx].x,
      y: caseCoords[idx].y,
      degree: 0,
      isPublic: c.isPublished,
      refId: c.id,
    });
  });

  const colCoords = placeArc(cappedCols.length, cx, cy, 380, 200, 145, 225);
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
        relation: 'assigned to case',
        strength: 2,
      });
    }
  });

  const itemCoords = placeArc(cappedItems.length, cx, cy, 405, 220, -45, 115);
  cappedItems.forEach((item, idx) => {
    const kind: NexusNodeKind = item.category === 'document' ? 'document' : 'evidence';
    const id = `vault:${item.id}`;
    nodes.push({
      id,
      label: truncateLabel(item.title, 22),
      subtitle: `${item.category} · ${item.mediaType.toUpperCase()}`,
      kind,
      x: itemCoords[idx].x,
      y: itemCoords[idx].y,
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

    for (const cid of item.caseIds) {
      if (cappedCases.some((c) => c.id === cid)) {
        edges.push({
          id: `e:${id}:case:${cid}`,
          source: id,
          target: `case:${cid}`,
          relation: 'linked to case',
          strength: 2,
        });
      }
    }
  });

  for (const col of cappedCols) {
    for (const itemId of col.itemIds) {
      if (cappedItems.some((v) => v.id === itemId)) {
        edges.push({
          id: `e:col:${col.id}:vault:${itemId}`,
          source: `collection:${col.id}`,
          target: `vault:${itemId}`,
          relation: 'member of collection',
          strength: 2,
        });
      }
    }
  }

  // Detect shared tags across cases, collections, and vault items
  const tagMap = new Map<string, string[]>();
  const addTag = (tag: string, nodeId: string) => {
    const k = normalizeToken(tag);
    if (!k) return;
    const arr = tagMap.get(k) || [];
    if (!arr.includes(nodeId)) arr.push(nodeId);
    tagMap.set(k, arr);
  };

  cappedCases.forEach((c) => (c.tags || []).forEach((t) => addTag(t, `case:${c.id}`)));
  cappedCols.forEach((c) => (c.tags || []).forEach((t) => addTag(t, `collection:${c.id}`)));
  cappedItems.forEach((v) => (v.tags || []).forEach((t) => addTag(t, `vault:${v.id}`)));

  const sharedTags = Array.from(tagMap.entries())
    .filter(([, arr]) => arr.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 6);

  const tagCoords = placeArc(sharedTags.length, cx, cy, 340, 210, 240, 310);
  sharedTags.forEach(([tag, targetIds], idx) => {
    const tagId = `tag:${tag}`;
    nodes.push({
      id: tagId,
      label: `#${tag}`,
      subtitle: `Cross-archive pattern · ${targetIds.length} links`,
      kind: 'tag',
      x: tagCoords[idx].x,
      y: tagCoords[idx].y,
      degree: 0,
    });
    for (const targetId of targetIds) {
      edges.push({
        id: `e:${tagId}:${targetId}`,
        source: tagId,
        target: targetId,
        relation: `shared tag #${tag}`,
        strength: 1,
      });
    }
  });

  // Shared court/jurisdiction pattern across cases
  const courtMap = new Map<string, CaseRecord[]>();
  cappedCases.forEach((c) => {
    const k = normalizeToken(c.court || '');
    if (!k) return;
    const arr = courtMap.get(k) || [];
    arr.push(c);
    courtMap.set(k, arr);
  });
  for (const [court, list] of courtMap.entries()) {
    if (list.length >= 2) {
      for (let i = 0; i < list.length - 1; i += 1) {
        edges.push({
          id: `e:court:${court}:${i}`,
          source: `case:${list[i].id}`,
          target: `case:${list[i + 1].id}`,
          relation: `shared jurisdiction: ${list[0].court}`,
          strength: 1,
        });
      }
    }
  }

  const finalized = finalizeDegrees(nodes, edges);

  const insights: NexusInsight[] = [];
  const standaloneCount = vaultItems.filter((v) => v.caseIds.length === 0).length;
  const multiCaseItems = vaultItems.filter((v) => v.caseIds.length >= 2).length;

  if (sharedTags.length > 0) {
    const [topTag, targets] = sharedTags[0];
    insights.push({
      id: 'port:tag',
      category: 'pattern',
      title: `Cross-Portfolio Pattern: #${topTag}`,
      detail: `Links ${targets.length} items across cases, vault records, and collections.`,
      focusNodeId: `tag:${topTag}`,
    });
  }

  if (multiCaseItems > 0) {
    insights.push({
      id: 'port:bridge',
      category: 'bridge',
      title: `Shared Evidence Bridges (${multiCaseItems})`,
      detail: `${multiCaseItems} vault artifact(s) are linked to 2 or more cases, bridging procedural histories.`,
    });
  }

  insights.push({
    id: 'port:standalone',
    category: 'coverage',
    title: 'Standalone vs. Linked Vault Inventory',
    detail: `${vaultItems.length - standaloneCount} artifacts are linked to active cases; ${standaloneCount} remain standalone.`,
  });

  insights.push({
    id: 'port:published',
    category: 'integrity',
    title: 'Public Archive Readiness',
    detail: `${cases.filter((c) => c.isPublished).length} of ${cases.length} cases published with ${collections.filter((c) => c.isPublic).length} public curated collections.`,
  });

  return {
    title: 'IMnexus Portfolio Connection Graph',
    nodes: finalized.nodes,
    edges: finalized.edges,
    insights,
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
    sections,
    timeline,
    actors,
    documents: docs,
    evidence: ev,
    collections: cols,
  });
}
