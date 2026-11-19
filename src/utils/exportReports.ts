import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  CaseActor,
  CaseRecord,
  CaseSection,
  EvidenceCollection,
  PublicSite,
  TimelineEvent,
  VaultItem,
} from '../types';
import { buildCaseNexus, buildPublicSiteNexus } from './nexusEngine';

export interface CustomReportOptions {
  reportTitle: string;
  includeMetadata: boolean;
  includeCustomFields: boolean;
  includeSummary: boolean;
  includeTimeline: boolean;
  includeActors: boolean;
  includeNarrative: boolean;
  includeDocuments: boolean;
  includeEvidence: boolean;
  includeCollections: boolean;
  publicOnly: boolean;
  selectedSectionIds?: string[];
}

export const DEFAULT_COMPLETE_REPORT_OPTIONS: CustomReportOptions = {
  reportTitle: 'Complete Case Dossier Report',
  includeMetadata: true,
  includeCustomFields: true,
  includeSummary: true,
  includeTimeline: true,
  includeActors: true,
  includeNarrative: true,
  includeDocuments: true,
  includeEvidence: true,
  includeCollections: true,
  publicOnly: false,
};

// IMnexus Architectural Color Palette (matching HTML design system)
const RGB = {
  INK: [15, 18, 16] as [number, number, number], // #0f1210
  FOREST: [26, 46, 36] as [number, number, number], // #1a2e24
  GREEN_TEXT: [45, 90, 61] as [number, number, number], // #2d5a3d
  MUTED: [106, 113, 107] as [number, number, number], // #6a716b
  CREAM: [243, 240, 233] as [number, number, number], // #f3f0e9
  CREAM_SOFT: [250, 248, 244] as [number, number, number], // #faf8f4
  LINE: [221, 216, 206] as [number, number, number], // #ddd8ce
  WHITE: [255, 255, 255] as [number, number, number],
};

const MARGIN_X = 44;
const TOP_Y = 52;
const BOTTOM_LIMIT = 738; // Letter height 792pt minus bottom margin/footer room

function sanitizeFileName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'imnexus-report';
}

function createPdfContext() {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN_X * 2;
  let y = TOP_Y;

  const drawPageTopRule = () => {
    doc.setFillColor(...RGB.FOREST);
    doc.rect(0, 0, pageWidth, 5, 'F');
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > BOTTOM_LIMIT) {
      doc.addPage();
      drawPageTopRule();
      y = TOP_Y;
    }
  };

  const drawSectionHeading = (kicker: string | null, heading: string) => {
    ensureSpace(58);
    if (kicker) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...RGB.GREEN_TEXT);
      doc.text(kicker.toUpperCase(), MARGIN_X, y);
      y += 12;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(...RGB.INK);
    doc.text(heading, MARGIN_X, y);
    y += 6;
    doc.setDrawColor(...RGB.LINE);
    doc.setLineWidth(0.75);
    doc.line(MARGIN_X, y, pageWidth - MARGIN_X, y);
    y += 14;
  };

  const drawParagraphs = (rawText: string, fontSize = 9.5, lineHeight = 13.5) => {
    const paragraphs = (rawText || '')
      .replace(/\r\n/g, '\n')
      .split(/\n{2,}|\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (paragraphs.length === 0) return;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(36, 40, 37);

    for (let pIdx = 0; pIdx < paragraphs.length; pIdx += 1) {
      const wrapped = doc.splitTextToSize(paragraphs[pIdx], contentWidth) as string[];
      for (const line of wrapped) {
        ensureSpace(lineHeight + 2);
        doc.text(line, MARGIN_X, y);
        y += lineHeight;
      }
      if (pIdx < paragraphs.length - 1) {
        y += 5;
      }
    }
  };

  const addRunningFooters = (leftLabel: string) => {
    const pageCount = doc.getNumberOfPages();
    const pageHeight = doc.internal.pageSize.getHeight();
    for (let p = 1; p <= pageCount; p += 1) {
      doc.setPage(p);
      doc.setDrawColor(...RGB.LINE);
      doc.setLineWidth(0.5);
      doc.line(MARGIN_X, pageHeight - 36, pageWidth - MARGIN_X, pageHeight - 36);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...RGB.MUTED);
      doc.text(leftLabel, MARGIN_X, pageHeight - 22);
      doc.text(`Page ${p} of ${pageCount}`, pageWidth - MARGIN_X, pageHeight - 22, {
        align: 'right',
      });
    }
  };

  const getY = () => y;
  const setY = (nextY: number) => {
    y = nextY;
  };

  drawPageTopRule();

  return {
    doc,
    pageWidth,
    contentWidth,
    getY,
    setY,
    ensureSpace,
    drawSectionHeading,
    drawParagraphs,
    addRunningFooters,
    drawPageTopRule,
  };
}

function sharedTableDefaults(contentWidth: number) {
  return {
    tableWidth: contentWidth,
    margin: { left: MARGIN_X, right: MARGIN_X, top: TOP_Y, bottom: 48 },
    rowPageBreak: 'avoid' as const,
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: { top: 5.5, right: 7, bottom: 5.5, left: 7 },
      textColor: RGB.INK,
      lineColor: RGB.LINE,
      lineWidth: 0.5,
      overflow: 'linebreak' as const,
      valign: 'top' as const,
    },
    headStyles: {
      fillColor: RGB.FOREST,
      textColor: RGB.CREAM_SOFT,
      fontStyle: 'bold' as const,
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: RGB.CREAM_SOFT,
    },
  };
}

export function exportCasePdf(params: {
  caseRecord: CaseRecord;
  sections: CaseSection[];
  timeline: TimelineEvent[];
  actors: CaseActor[];
  vaultItems: VaultItem[];
  collections: EvidenceCollection[];
  options?: CustomReportOptions;
}): void {
  const {
    caseRecord,
    sections,
    timeline,
    actors,
    vaultItems,
    collections,
    options = DEFAULT_COMPLETE_REPORT_OPTIONS,
  } = params;

  const ctx = createPdfContext();
  const { doc, pageWidth, contentWidth, ensureSpace, drawSectionHeading, drawParagraphs } = ctx;

  // Top Header Strip
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...RGB.INK);
  doc.text('IMnexus', MARGIN_X, ctx.getY());

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...RGB.MUTED);
  doc.text(
    `${options.reportTitle}  ·  Generated ${new Date().toLocaleDateString()}`,
    pageWidth - MARGIN_X,
    ctx.getY(),
    { align: 'right' }
  );
  ctx.setY(ctx.getY() + 20);

  // Shaded Dossier Title Callout Box
  const titleLines = doc.splitTextToSize(caseRecord.title, contentWidth - 28) as string[];
  const subtitleText = `Case No. ${caseRecord.caseNumber}  ·  ${
    caseRecord.court || caseRecord.caseType.toUpperCase()
  }  ·  Status: ${caseRecord.status}  ·  ${
    options.publicOnly ? 'Public Release Edition' : 'Console Dossier'
  }`;
  const subLines = doc.splitTextToSize(subtitleText, contentWidth - 28) as string[];
  const boxHeight = titleLines.length * 21 + subLines.length * 13 + 26;

  doc.setFillColor(...RGB.CREAM);
  doc.setDrawColor(...RGB.LINE);
  doc.setLineWidth(0.75);
  doc.rect(MARGIN_X, ctx.getY(), contentWidth, boxHeight, 'FD');

  let boxY = ctx.getY() + 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...RGB.INK);
  doc.text(titleLines, MARGIN_X + 14, boxY);
  boxY += titleLines.length * 21 + 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...RGB.MUTED);
  doc.text(subLines, MARGIN_X + 14, boxY);

  ctx.setY(ctx.getY() + boxHeight + 22);

  // 1. Metadata Table
  if (options.includeMetadata) {
    drawSectionHeading('Record Identification', 'Case Metadata');

    const metaRows: string[][] = [
      ['Case Number', caseRecord.caseNumber],
      ['Classification', caseRecord.caseType],
      ['Jurisdiction / Court', caseRecord.court || '—'],
      ['Presiding Judge / Lead', caseRecord.judge || '—'],
      ['Alleged Cause / Subject', caseRecord.charge || '—'],
      ['Key / Arrest Dates', caseRecord.arrestDates || '—'],
      ['Official Closure Date', caseRecord.closureDate || '—'],
      ['Final Disposition', caseRecord.disposition || '—'],
      ['Public Archive URL', caseRecord.isPublished ? `/site/${caseRecord.publicSlug}` : 'Private / Unpublished'],
    ];

    if (options.includeCustomFields && caseRecord.customFields?.length) {
      for (const cf of caseRecord.customFields) {
        metaRows.push([cf.label, cf.value]);
      }
    }

    autoTable(doc, {
      ...sharedTableDefaults(contentWidth),
      startY: ctx.getY(),
      head: [['Attribute', 'Recorded Value']],
      body: metaRows,
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 165, fontStyle: 'bold', textColor: RGB.FOREST },
        1: { cellWidth: contentWidth - 165 },
      },
    });
    ctx.setY((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20);
  }

  // 2. Executive Summary
  if (options.includeSummary && caseRecord.summary?.trim()) {
    drawSectionHeading('Executive Brief', 'Executive Summary');
    drawParagraphs(caseRecord.summary, 9.5, 14);
    ctx.setY(ctx.getY() + 14);
  }

  // 3. Timeline
  const filteredTimeline = timeline
    .filter((t) => !options.publicOnly || t.isPublic)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (options.includeTimeline && filteredTimeline.length > 0) {
    drawSectionHeading('Chronology', 'Chronological Timeline of Events');
    autoTable(doc, {
      ...sharedTableDefaults(contentWidth),
      startY: ctx.getY(),
      head: [['Date', 'Time', 'Event', 'Documented Details']],
      body: filteredTimeline.map((ev) => [
        ev.date,
        ev.time || '—',
        ev.title,
        ev.description || '—',
      ]),
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 74 },
        1: { cellWidth: 50 },
        2: { cellWidth: 145, fontStyle: 'bold' },
        3: { cellWidth: contentWidth - 269 },
      },
    });
    ctx.setY((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20);
  }

  // 4. Actors
  const filteredActors = actors.filter((a) => !options.publicOnly || a.isPublic);
  if (options.includeActors && filteredActors.length > 0) {
    drawSectionHeading('Institutional Directory', 'Key Actors & Entities');
    autoTable(doc, {
      ...sharedTableDefaults(contentWidth),
      startY: ctx.getY(),
      head: [['Name / Entity', 'Role', 'Organization', 'Involvement Notes']],
      body: filteredActors.map((a) => [
        a.name,
        a.role,
        a.organization || '—',
        a.notes || '—',
      ]),
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 120, fontStyle: 'bold' },
        1: { cellWidth: 95 },
        2: { cellWidth: 115 },
        3: { cellWidth: contentWidth - 330 },
      },
    });
    ctx.setY((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20);
  }

  // 5. Narrative Sections
  const filteredSections = sections
    .filter(
      (s) =>
        (!options.publicOnly || s.isPublic) &&
        (!options.selectedSectionIds || options.selectedSectionIds.includes(s.id))
    )
    .sort((a, b) => a.order - b.order);

  if (options.includeNarrative && filteredSections.length > 0) {
    drawSectionHeading('Structured Findings', 'Dossier Narrative Sections');

    for (const sec of filteredSections) {
      ensureSpace(56);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...RGB.FOREST);
      const secHeadingLines = doc.splitTextToSize(
        `${String(sec.order).padStart(2, '0')}. ${sec.title}`,
        contentWidth
      ) as string[];
      for (const hLine of secHeadingLines) {
        ensureSpace(16);
        doc.text(hLine, MARGIN_X, ctx.getY());
        ctx.setY(ctx.getY() + 14);
      }
      ctx.setY(ctx.getY() + 2);
      drawParagraphs(sec.content?.trim() || 'No narrative recorded for this section.', 9.5, 13.5);
      ctx.setY(ctx.getY() + 10);
    }
  }

  // 6. Document Vault
  const linkedDocs = vaultItems.filter(
    (v) =>
      v.category === 'document' &&
      v.caseIds.includes(caseRecord.id) &&
      (!options.publicOnly || v.isPublic)
  );
  if (options.includeDocuments && linkedDocs.length > 0) {
    drawSectionHeading('Archival Filings', 'Document Vault Index');
    autoTable(doc, {
      ...sharedTableDefaults(contentWidth),
      startY: ctx.getY(),
      head: [['Title', 'Type', 'Visibility', 'SHA-256 Digest']],
      body: linkedDocs.map((d) => [
        d.title,
        d.docType || d.mediaType.toUpperCase(),
        d.isPublic ? 'Public' : 'Private',
        d.sha256 ? `${d.sha256.slice(0, 24)}…` : 'Text Record',
      ]),
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 205, fontStyle: 'bold' },
        1: { cellWidth: 95 },
        2: { cellWidth: 68 },
        3: { cellWidth: contentWidth - 368 },
      },
    });
    ctx.setY((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20);
  }

  // 7. Evidence Library
  const linkedEvidence = vaultItems.filter(
    (v) =>
      v.category === 'evidence' &&
      v.caseIds.includes(caseRecord.id) &&
      (!options.publicOnly || v.isPublic)
  );
  if (options.includeEvidence && linkedEvidence.length > 0) {
    drawSectionHeading('Evidentiary Exhibits', 'Evidence Library Index');
    autoTable(doc, {
      ...sharedTableDefaults(contentWidth),
      startY: ctx.getY(),
      head: [['Title', 'Format', 'Tags', 'Visibility', 'SHA-256 Digest']],
      body: linkedEvidence.map((e) => [
        e.title,
        e.mediaType.toUpperCase(),
        e.tags.join(', ') || '—',
        e.isPublic ? 'Public' : 'Private',
        e.sha256 ? `${e.sha256.slice(0, 20)}…` : 'Text Note',
      ]),
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 165, fontStyle: 'bold' },
        1: { cellWidth: 58 },
        2: { cellWidth: 110 },
        3: { cellWidth: 62 },
        4: { cellWidth: contentWidth - 395 },
      },
    });
    ctx.setY((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20);
  }

  // 8. Collections
  const linkedCollections = collections.filter(
    (c) => c.caseId === caseRecord.id && (!options.publicOnly || c.isPublic)
  );
  if (options.includeCollections && linkedCollections.length > 0) {
    drawSectionHeading('Curated Groupings', 'Evidence Collections');
    autoTable(doc, {
      ...sharedTableDefaults(contentWidth),
      startY: ctx.getY(),
      head: [['Collection Title', 'Items', 'Contextual Explanation']],
      body: linkedCollections.map((c) => [
        c.title,
        String(c.itemIds.length),
        c.explanation || '—',
      ]),
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 155, fontStyle: 'bold' },
        1: { cellWidth: 48, halign: 'center' },
        2: { cellWidth: contentWidth - 203 },
      },
    });
    ctx.setY((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20);
  }

  // 9. Nexus Insights Summary
  const nexusGraph = buildCaseNexus({
    caseId: caseRecord.id,
    caseNumber: caseRecord.caseNumber,
    title: caseRecord.title,
    sections: filteredSections,
    timeline: filteredTimeline,
    actors: filteredActors,
    documents: linkedDocs,
    evidence: linkedEvidence,
    collections: linkedCollections,
  });

  if (nexusGraph.insights.length > 0) {
    drawSectionHeading('Connection Patterns', 'IMnexus Structural Insights');
    autoTable(doc, {
      ...sharedTableDefaults(contentWidth),
      startY: ctx.getY(),
      head: [['Pattern Type', 'Insight', 'Observed Connections']],
      body: nexusGraph.insights.map((ins) => [
        ins.category.toUpperCase(),
        ins.title,
        ins.detail,
      ]),
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 80, fontStyle: 'bold' },
        1: { cellWidth: 160, fontStyle: 'bold' },
        2: { cellWidth: contentWidth - 240 },
      },
    });
  }

  ctx.addRunningFooters(`IMnexus  ·  Case No. ${caseRecord.caseNumber}`);
  doc.save(`${sanitizeFileName(caseRecord.caseNumber + '-' + options.reportTitle)}.pdf`);
}

export function exportPublicSitePdf(site: PublicSite): void {
  const ctx = createPdfContext();
  const { doc, pageWidth, contentWidth, ensureSpace, drawSectionHeading, drawParagraphs } = ctx;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...RGB.INK);
  doc.text('IMnexus Public Archive', MARGIN_X, ctx.getY());

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...RGB.MUTED);
  doc.text(
    `Published Dossier  ·  Generated ${new Date().toLocaleDateString()}`,
    pageWidth - MARGIN_X,
    ctx.getY(),
    { align: 'right' }
  );
  ctx.setY(ctx.getY() + 20);

  // Shaded Hero Summary Box
  const titleLines = doc.splitTextToSize(site.headline || site.title, contentWidth - 28) as string[];
  const subText = `Case No. ${site.caseNumber || 'N/A'}  ·  ${site.court || site.caseType}  ·  Status: ${site.status}`;
  const subLines = doc.splitTextToSize(subText, contentWidth - 28) as string[];
  const boxHeight = titleLines.length * 21 + subLines.length * 13 + 26;

  doc.setFillColor(...RGB.CREAM);
  doc.setDrawColor(...RGB.LINE);
  doc.setLineWidth(0.75);
  doc.rect(MARGIN_X, ctx.getY(), contentWidth, boxHeight, 'FD');

  let boxY = ctx.getY() + 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...RGB.INK);
  doc.text(titleLines, MARGIN_X + 14, boxY);
  boxY += titleLines.length * 21 + 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...RGB.MUTED);
  doc.text(subLines, MARGIN_X + 14, boxY);
  ctx.setY(ctx.getY() + boxHeight + 22);

  // Metadata
  drawSectionHeading('Dossier Metadata', 'Public Record Attributes');
  const metaRows: string[][] = [
    ['Case Number', site.caseNumber || '—'],
    ['Jurisdiction / Entity', site.court || '—'],
    ['Presiding Lead / Judge', site.judge || '—'],
    ['Disposition / Status', site.disposition || site.status],
    ...(site.charge ? [['Subject / Cause', site.charge]] : []),
    ...(site.arrestDates ? [['Key Dates', site.arrestDates]] : []),
    ...(site.closureDate ? [['Closure Date', site.closureDate]] : []),
    ...(site.customFields || []).map((cf) => [cf.label, cf.value]),
  ];
  autoTable(doc, {
    ...sharedTableDefaults(contentWidth),
    startY: ctx.getY(),
    head: [['Attribute', 'Value']],
    body: metaRows,
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 165, fontStyle: 'bold', textColor: RGB.FOREST },
      1: { cellWidth: contentWidth - 165 },
    },
  });
  ctx.setY((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20);

  if (site.intro?.trim()) {
    drawSectionHeading('Overview', 'Public Dossier Summary');
    drawParagraphs(site.intro, 9.5, 14);
    ctx.setY(ctx.getY() + 14);
  }

  if (site.timeline?.length) {
    drawSectionHeading('Chronology', 'Public Timeline');
    autoTable(doc, {
      ...sharedTableDefaults(contentWidth),
      startY: ctx.getY(),
      head: [['Date', 'Time', 'Event', 'Details']],
      body: site.timeline.map((ev) => [ev.date, ev.time || '—', ev.title, ev.description || '—']),
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 74 },
        1: { cellWidth: 50 },
        2: { cellWidth: 145, fontStyle: 'bold' },
        3: { cellWidth: contentWidth - 269 },
      },
    });
    ctx.setY((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20);
  }

  if (site.actors?.length) {
    drawSectionHeading('Directory', 'Key Actors & Entities');
    autoTable(doc, {
      ...sharedTableDefaults(contentWidth),
      startY: ctx.getY(),
      head: [['Name', 'Role', 'Organization', 'Notes']],
      body: site.actors.map((a) => [a.name, a.role, a.organization || '—', a.notes || '—']),
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 120, fontStyle: 'bold' },
        1: { cellWidth: 95 },
        2: { cellWidth: 115 },
        3: { cellWidth: contentWidth - 330 },
      },
    });
    ctx.setY((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20);
  }

  if (site.sections?.length) {
    drawSectionHeading('Dossier Narrative', 'Published Findings & Chapters');
    for (const sec of site.sections) {
      ensureSpace(56);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...RGB.FOREST);
      const secHeadingLines = doc.splitTextToSize(
        `${String(sec.order).padStart(2, '0')}. ${sec.title}`,
        contentWidth
      ) as string[];
      for (const hLine of secHeadingLines) {
        ensureSpace(16);
        doc.text(hLine, MARGIN_X, ctx.getY());
        ctx.setY(ctx.getY() + 14);
      }
      ctx.setY(ctx.getY() + 2);
      drawParagraphs(sec.content || '', 9.5, 13.5);
      ctx.setY(ctx.getY() + 10);
    }
  }

  if (site.collections?.length) {
    drawSectionHeading('Curated Collections', 'Evidence Sets');
    autoTable(doc, {
      ...sharedTableDefaults(contentWidth),
      startY: ctx.getY(),
      head: [['Collection', 'Artifacts', 'Explanation']],
      body: site.collections.map((c) => [c.title, String(c.items.length), c.explanation || '—']),
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 155, fontStyle: 'bold' },
        1: { cellWidth: 55, halign: 'center' },
        2: { cellWidth: contentWidth - 210 },
      },
    });
    ctx.setY((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20);
  }

  if (site.documents?.length) {
    drawSectionHeading('Public Documents', 'Verified Filings');
    autoTable(doc, {
      ...sharedTableDefaults(contentWidth),
      startY: ctx.getY(),
      head: [['Document Title', 'Type', 'SHA-256 Digest']],
      body: site.documents.map((d) => [
        d.title,
        d.docType || 'Document',
        d.sha256 ? `${d.sha256.slice(0, 24)}…` : 'Verified Record',
      ]),
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 230, fontStyle: 'bold' },
        1: { cellWidth: 105 },
        2: { cellWidth: contentWidth - 335 },
      },
    });
    ctx.setY((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20);
  }

  if (site.evidence?.length) {
    drawSectionHeading('Evidentiary Exhibits', 'Public Evidence Gallery');
    autoTable(doc, {
      ...sharedTableDefaults(contentWidth),
      startY: ctx.getY(),
      head: [['Exhibit Title', 'Format', 'Tags', 'SHA-256 Digest']],
      body: site.evidence.map((e) => [
        e.title,
        e.mediaType.toUpperCase(),
        e.tags?.join(', ') || '—',
        e.sha256 ? `${e.sha256.slice(0, 22)}…` : 'Text Exhibit',
      ]),
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 195, fontStyle: 'bold' },
        1: { cellWidth: 65 },
        2: { cellWidth: 115 },
        3: { cellWidth: contentWidth - 375 },
      },
    });
    ctx.setY((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20);
  }

  const nexusGraph = buildPublicSiteNexus(site);
  if (nexusGraph.insights.length > 0) {
    drawSectionHeading('Nexus Patterns', 'Mapped Connections & Insights');
    autoTable(doc, {
      ...sharedTableDefaults(contentWidth),
      startY: ctx.getY(),
      head: [['Pattern Category', 'Insight', 'Summary']],
      body: nexusGraph.insights.map((ins) => [
        ins.category.toUpperCase(),
        ins.title,
        ins.detail,
      ]),
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 95, fontStyle: 'bold' },
        1: { cellWidth: 160, fontStyle: 'bold' },
        2: { cellWidth: contentWidth - 255 },
      },
    });
  }

  ctx.addRunningFooters(`IMnexus Public Archive  ·  /site/${site.slug}`);
  doc.save(`${sanitizeFileName(site.slug)}-public-dossier.pdf`);
}

function escapeCsv(val: unknown): string {
  const str = String(val ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsv(fileName: string, headers: string[], rows: Array<Array<unknown>>): void {
  const csvLines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ];
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFileName(fileName)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCasesPortfolioCsv(
  cases: CaseRecord[],
  vaultItems: VaultItem[],
  collections: EvidenceCollection[]
): void {
  const headers = [
    'Case No',
    'Title',
    'Type',
    'Court / Organization',
    'Judge / Lead',
    'Status',
    'Disposition',
    'Public Published',
    'Public URL Slug',
    'Linked Documents',
    'Linked Evidence',
    'Collections',
  ];

  const rows = cases.map((c) => [
    c.caseNumber,
    c.title,
    c.caseType,
    c.court || '',
    c.judge || '',
    c.status,
    c.disposition || '',
    c.isPublished ? 'Yes' : 'No',
    c.publicSlug,
    vaultItems.filter((v) => v.category === 'document' && v.caseIds.includes(c.id)).length,
    vaultItems.filter((v) => v.category === 'evidence' && v.caseIds.includes(c.id)).length,
    collections.filter((col) => col.caseId === c.id).length,
  ]);

  downloadCsv('imnexus-cases-portfolio', headers, rows);
}

export function exportCaseCustomCsv(params: {
  caseRecord: CaseRecord;
  sections: CaseSection[];
  timeline: TimelineEvent[];
  actors: CaseActor[];
  vaultItems: VaultItem[];
  collections: EvidenceCollection[];
  options: CustomReportOptions;
}): void {
  const { caseRecord, sections, timeline, actors, vaultItems, collections, options } = params;
  const headers = ['Category', 'Identifier / Date', 'Title / Name', 'Role / Type', 'Visibility', 'Detail / SHA-256'];
  const rows: Array<Array<unknown>> = [];

  if (options.includeMetadata) {
    rows.push(['Metadata', caseRecord.caseNumber, caseRecord.title, caseRecord.status, caseRecord.isPublished ? 'Public' : 'Private', caseRecord.disposition || '']);
    if (options.includeCustomFields && caseRecord.customFields?.length) {
      for (const cf of caseRecord.customFields) {
        rows.push(['Custom Field', caseRecord.caseNumber, cf.label, 'Custom', 'Console', cf.value]);
      }
    }
  }

  if (options.includeTimeline) {
    for (const ev of timeline.filter((t) => !options.publicOnly || t.isPublic)) {
      rows.push(['Timeline', `${ev.date} ${ev.time || ''}`.trim(), ev.title, 'Event', ev.isPublic ? 'Public' : 'Private', ev.description]);
    }
  }

  if (options.includeActors) {
    for (const act of actors.filter((a) => !options.publicOnly || a.isPublic)) {
      rows.push(['Actor', act.organization || '', act.name, act.role, act.isPublic ? 'Public' : 'Private', act.notes || '']);
    }
  }

  if (options.includeNarrative) {
    for (const sec of sections.filter((s) => !options.publicOnly || s.isPublic)) {
      rows.push(['Narrative Section', String(sec.order).padStart(2, '0'), sec.title, 'Section', sec.isPublic ? 'Public' : 'Private', sec.content]);
    }
  }

  if (options.includeDocuments || options.includeEvidence) {
    for (const v of vaultItems.filter((item) => item.caseIds.includes(caseRecord.id) && (!options.publicOnly || item.isPublic))) {
      if ((v.category === 'document' && options.includeDocuments) || (v.category === 'evidence' && options.includeEvidence)) {
        rows.push([v.category === 'document' ? 'Document' : 'Evidence', v.mediaType.toUpperCase(), v.title, v.docType || v.tags.join('; '), v.isPublic ? 'Public' : 'Private', v.sha256 || v.textContent || '']);
      }
    }
  }

  if (options.includeCollections) {
    for (const col of collections.filter((c) => c.caseId === caseRecord.id && (!options.publicOnly || c.isPublic))) {
      rows.push(['Collection', `${col.itemIds.length} items`, col.title, 'Collection', col.isPublic ? 'Public' : 'Private', col.explanation]);
    }
  }

  downloadCsv(`${caseRecord.caseNumber}-${options.reportTitle}`, headers, rows);
}
