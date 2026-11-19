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

function sanitizeFileName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'imnexus-report';
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

  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 50;

  const ensureSpace = (needed: number) => {
    if (y + needed > 730) {
      doc.addPage();
      y = 50;
    }
  };

  // Header Bar
  doc.setFillColor(48, 97, 208);
  doc.rect(0, 0, pageWidth, 10, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(48, 97, 208);
  doc.text('IMnexus', 40, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(113, 113, 122);
  doc.text(
    `${options.reportTitle}  ·  Generated ${new Date().toLocaleDateString()}`,
    pageWidth - 40,
    y,
    { align: 'right' }
  );
  y += 24;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(9, 9, 11);
  const titleLines = doc.splitTextToSize(caseRecord.title, pageWidth - 80) as string[];
  doc.text(titleLines, 40, y);
  y += titleLines.length * 24 + 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(82, 82, 91);
  doc.text(
    `Case No. ${caseRecord.caseNumber}  ·  Status: ${caseRecord.status}  ·  ${
      options.publicOnly ? 'Public Release Edition' : 'Full Console Edition'
    }`,
    40,
    y
  );
  y += 20;

  doc.setDrawColor(228, 228, 231);
  doc.line(40, y, pageWidth - 40, y);
  y += 18;

  // Metadata Table
  if (options.includeMetadata) {
    ensureSpace(120);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(9, 9, 11);
    doc.text('Case Metadata', 40, y);
    y += 8;

    const metaRows: string[][] = [
      ['Case Number', caseRecord.caseNumber],
      ['Classification', caseRecord.caseType],
      ['Jurisdiction / Court', caseRecord.court || '—'],
      ['Presiding Judge / Lead', caseRecord.judge || '—'],
      ['Alleged Cause / Subject', caseRecord.charge || '—'],
      ['Key Dates', caseRecord.arrestDates || '—'],
      ['Closure Date', caseRecord.closureDate || '—'],
      ['Final Disposition', caseRecord.disposition || '—'],
      ['Public Site URL', caseRecord.isPublished ? `/site/${caseRecord.publicSlug}` : 'Not Published'],
    ];

    if (options.includeCustomFields && caseRecord.customFields?.length) {
      for (const cf of caseRecord.customFields) {
        metaRows.push([cf.label, cf.value]);
      }
    }

    autoTable(doc, {
      startY: y,
      head: [['Field', 'Value']],
      body: metaRows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 5, textColor: [24, 24, 27] },
      headStyles: { fillColor: [48, 97, 208], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 160, fontStyle: 'bold' } },
      margin: { left: 40, right: 40 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;
  }

  // Executive Summary
  if (options.includeSummary && caseRecord.summary) {
    ensureSpace(80);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(9, 9, 11);
    doc.text('Executive Summary', 40, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(39, 39, 42);
    const lines = doc.splitTextToSize(caseRecord.summary, pageWidth - 80) as string[];
    for (const line of lines) {
      ensureSpace(16);
      doc.text(line, 40, y);
      y += 14;
    }
    y += 14;
  }

  // Timeline
  const filteredTimeline = timeline
    .filter((t) => !options.publicOnly || t.isPublic)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (options.includeTimeline && filteredTimeline.length > 0) {
    ensureSpace(100);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(9, 9, 11);
    doc.text('Chronological Timeline', 40, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Time', 'Event', 'Details']],
      body: filteredTimeline.map((ev) => [
        ev.date,
        ev.time || '—',
        ev.title,
        ev.description,
      ]),
      theme: 'striped',
      styles: { fontSize: 8.5, cellPadding: 5, textColor: [24, 24, 27] },
      headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255] },
      columnStyles: { 0: { cellWidth: 75 }, 1: { cellWidth: 55 }, 2: { cellWidth: 130, fontStyle: 'bold' } },
      margin: { left: 40, right: 40 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;
  }

  // Actors
  const filteredActors = actors.filter((a) => !options.publicOnly || a.isPublic);
  if (options.includeActors && filteredActors.length > 0) {
    ensureSpace(100);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(9, 9, 11);
    doc.text('Key Actors & Institutional Entities', 40, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [['Name', 'Role', 'Organization', 'Notes']],
      body: filteredActors.map((a) => [
        a.name,
        a.role,
        a.organization || '—',
        a.notes || '—',
      ]),
      theme: 'striped',
      styles: { fontSize: 8.5, cellPadding: 5, textColor: [24, 24, 27] },
      headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255] },
      margin: { left: 40, right: 40 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;
  }

  // Narrative Sections
  const filteredSections = sections
    .filter((s) => (!options.publicOnly || s.isPublic) && (!options.selectedSectionIds || options.selectedSectionIds.includes(s.id)))
    .sort((a, b) => a.order - b.order);

  if (options.includeNarrative && filteredSections.length > 0) {
    ensureSpace(60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(9, 9, 11);
    doc.text('Dossier Narrative Sections', 40, y);
    y += 20;

    for (const sec of filteredSections) {
      ensureSpace(60);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(48, 97, 208);
      doc.text(`${String(sec.order).padStart(2, '0')}. ${sec.title}`, 40, y);
      y += 15;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(39, 39, 42);
      const bodyText = sec.content?.trim() || 'No narrative recorded for this section.';
      const secLines = doc.splitTextToSize(bodyText, pageWidth - 80) as string[];
      for (const line of secLines) {
        ensureSpace(14);
        doc.text(line, 40, y);
        y += 13;
      }
      y += 14;
    }
  }

  // Documents
  const linkedDocs = vaultItems.filter(
    (v) => v.category === 'document' && v.caseIds.includes(caseRecord.id) && (!options.publicOnly || v.isPublic)
  );
  if (options.includeDocuments && linkedDocs.length > 0) {
    ensureSpace(100);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(9, 9, 11);
    doc.text('Document Vault Index', 40, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [['Title', 'Type', 'Visibility', 'SHA-256 Integrity Digest']],
      body: linkedDocs.map((d) => [
        d.title,
        d.docType || d.mediaType.toUpperCase(),
        d.isPublic ? 'Public' : 'Private',
        d.sha256 ? `${d.sha256.slice(0, 20)}...` : 'Text Record',
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [48, 97, 208], textColor: [255, 255, 255] },
      margin: { left: 40, right: 40 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;
  }

  // Evidence
  const linkedEvidence = vaultItems.filter(
    (v) => v.category === 'evidence' && v.caseIds.includes(caseRecord.id) && (!options.publicOnly || v.isPublic)
  );
  if (options.includeEvidence && linkedEvidence.length > 0) {
    ensureSpace(100);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(9, 9, 11);
    doc.text('Evidence Library Index', 40, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [['Title', 'Format', 'Tags', 'Visibility', 'SHA-256 Digest']],
      body: linkedEvidence.map((e) => [
        e.title,
        e.mediaType.toUpperCase(),
        e.tags.join(', ') || '—',
        e.isPublic ? 'Public' : 'Private',
        e.sha256 ? `${e.sha256.slice(0, 18)}...` : 'Text Note',
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [48, 97, 208], textColor: [255, 255, 255] },
      margin: { left: 40, right: 40 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;
  }

  // Collections
  const linkedCollections = collections.filter(
    (c) => c.caseId === caseRecord.id && (!options.publicOnly || c.isPublic)
  );
  if (options.includeCollections && linkedCollections.length > 0) {
    ensureSpace(90);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(9, 9, 11);
    doc.text('Curated Evidence Collections', 40, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [['Collection Title', 'Items', 'Contextual Explanation']],
      body: linkedCollections.map((c) => [
        c.title,
        String(c.itemIds.length),
        c.explanation,
      ]),
      theme: 'striped',
      styles: { fontSize: 8.5, cellPadding: 5 },
      headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255] },
      margin: { left: 40, right: 40 },
    });
  }

  doc.save(`${sanitizeFileName(caseRecord.caseNumber + '-' + options.reportTitle)}.pdf`);
}

export function exportPublicSitePdf(site: PublicSite): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 50;

  const ensureSpace = (needed: number) => {
    if (y + needed > 730) {
      doc.addPage();
      y = 50;
    }
  };

  doc.setFillColor(48, 97, 208);
  doc.rect(0, 0, pageWidth, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(48, 97, 208);
  doc.text('IMnexus Public Archive', 40, y);
  y += 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(9, 9, 11);
  const titleLines = doc.splitTextToSize(site.headline || site.title, pageWidth - 80) as string[];
  doc.text(titleLines, 40, y);
  y += titleLines.length * 24 + 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(82, 82, 91);
  doc.text(`Case No. ${site.caseNumber || 'N/A'}  ·  ${site.court || site.caseType}  ·  ${site.status}`, 40, y);
  y += 24;

  if (site.intro) {
    doc.setFontSize(10);
    doc.setTextColor(39, 39, 42);
    const introLines = doc.splitTextToSize(site.intro, pageWidth - 80) as string[];
    for (const line of introLines) {
      ensureSpace(14);
      doc.text(line, 40, y);
      y += 14;
    }
    y += 16;
  }

  if (site.sections?.length) {
    for (const sec of site.sections) {
      ensureSpace(50);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(48, 97, 208);
      doc.text(`${String(sec.order).padStart(2, '0')}. ${sec.title}`, 40, y);
      y += 15;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(39, 39, 42);
      const secLines = doc.splitTextToSize(sec.content || '', pageWidth - 80) as string[];
      for (const line of secLines) {
        ensureSpace(14);
        doc.text(line, 40, y);
        y += 13;
      }
      y += 14;
    }
  }

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
