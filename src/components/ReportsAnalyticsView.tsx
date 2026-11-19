import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { BarChart3, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { db } from '../firebase';
import type {
  CaseActor,
  CaseRecord,
  CaseSection,
  EvidenceCollection,
  TimelineEvent,
  VaultItem,
} from '../types';
import {
  exportCaseCustomCsv,
  exportCasePdf,
  exportCasesPortfolioCsv,
  type CustomReportOptions,
} from '../utils/exportReports';
import { formatBytes } from '../utils/vaultApi';
import { StatusLabel } from './BrandMark';

interface ReportsAnalyticsViewProps {
  cases: CaseRecord[];
  vaultItems: VaultItem[];
  collections: EvidenceCollection[];
}

export const ReportsAnalyticsView: React.FC<ReportsAnalyticsViewProps> = ({
  cases,
  vaultItems,
  collections,
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string>(cases[0]?.id || '');
  const [reportOptions, setReportOptions] = useState<CustomReportOptions>({
    reportTitle: 'Custom Case & Evidence Report',
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
  });

  const [subData, setSubData] = useState<{
    sections: CaseSection[];
    timeline: TimelineEvent[];
    actors: CaseActor[];
  }>({ sections: [], timeline: [], actors: [] });
  const [loadingSub, setLoadingSub] = useState(false);

  useEffect(() => {
    if (!selectedCaseId && cases[0]?.id) {
      setSelectedCaseId(cases[0].id);
    }
  }, [cases, selectedCaseId]);

  useEffect(() => {
    if (!selectedCaseId) return;
    let mounted = true;
    setLoadingSub(true);
    Promise.all([
      getDocs(collection(db, 'cases', selectedCaseId, 'sections')),
      getDocs(collection(db, 'cases', selectedCaseId, 'timeline')),
      getDocs(collection(db, 'cases', selectedCaseId, 'actors')),
    ])
      .then(([secSnap, tlSnap, actSnap]) => {
        if (!mounted) return;
        setSubData({
          sections: secSnap.docs.map((d) => d.data() as CaseSection),
          timeline: tlSnap.docs.map((d) => d.data() as TimelineEvent),
          actors: actSnap.docs.map((d) => d.data() as CaseActor),
        });
      })
      .finally(() => {
        if (mounted) setLoadingSub(false);
      });
    return () => {
      mounted = false;
    };
  }, [selectedCaseId]);

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {
      Active: 0,
      'In Review': 0,
      Draft: 0,
      Dismissed: 0,
      Closed: 0,
    };
    for (const c of cases) {
      counts[c.status] = (counts[c.status] || 0) + 1;
    }
    return Object.entries(counts);
  }, [cases]);

  const mediaBreakdown = useMemo(() => {
    const counts: Record<string, number> = {
      pdf: 0,
      image: 0,
      video: 0,
      audio: 0,
      text: 0,
      file: 0,
    };
    for (const v of vaultItems) {
      counts[v.mediaType] = (counts[v.mediaType] || 0) + 1;
    }
    return Object.entries(counts);
  }, [vaultItems]);

  const totalVaultBytes = useMemo(
    () => vaultItems.reduce((sum, v) => sum + (v.fileSize || 0), 0),
    [vaultItems]
  );

  const selectedCase = cases.find((c) => c.id === selectedCaseId);
  const maxStatusCount = Math.max(...statusBreakdown.map(([, n]) => n), 1);
  const maxMediaCount = Math.max(...mediaBreakdown.map(([, n]) => n), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
            Reports &amp; Analytics
          </h1>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1">
            Track dossier completion, archival readiness, and generate Complete or Custom PDF / CSV exports.
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportCasesPortfolioCsv(cases, vaultItems, collections)}
          disabled={cases.length === 0}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer whitespace-nowrap"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Export Full Portfolio CSV</span>
        </button>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
            Published Public Sites
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {cases.filter((c) => c.isPublished).length}{' '}
            <span className="text-xs font-normal text-zinc-400">/ {cases.length}</span>
          </div>
        </div>
        <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
            Public Vault Assets
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {vaultItems.filter((v) => v.isPublic).length}{' '}
            <span className="text-xs font-normal text-zinc-400">/ {vaultItems.length}</span>
          </div>
        </div>
        <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
            Curated Collections
          </div>
          <div className="text-2xl font-bold tabular-nums">{collections.length}</div>
        </div>
        <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
            Encrypted Storage
          </div>
          <div className="text-2xl font-bold tabular-nums">{formatBytes(totalVaultBytes)}</div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-[#3061d0]" />
            <h2 className="text-sm font-bold">Case &amp; Project Status Distribution</h2>
          </div>
          <div className="space-y-3">
            {statusBreakdown.map(([status, count]) => (
              <div key={status} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{status}</span>
                  <span className="font-mono-tabular font-semibold">{count}</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#3061d0]"
                    style={{ width: `${(count / maxStatusCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-[#3061d0]" />
            <h2 className="text-sm font-bold">Evidence &amp; Document Format Mix</h2>
          </div>
          <div className="space-y-3">
            {mediaBreakdown.map(([format, count]) => (
              <div key={format} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-mono-tabular uppercase font-medium text-zinc-700 dark:text-zinc-300">
                    {format}
                  </span>
                  <span className="font-mono-tabular font-semibold">{count}</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-zinc-800 dark:bg-zinc-300"
                    style={{ width: `${(count / maxMediaCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Case Progress Tracking Table */}
      <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-bold">Project &amp; Case Readiness Tracker</h2>
        </div>
        {cases.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">
            Create a case to track readiness metrics.
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="py-3 px-4">Case No.</th>
                <th className="py-3 px-4">Caption</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Docs</th>
                <th className="py-3 px-4 text-right">Evidence</th>
                <th className="py-3 px-4 text-right">Collections</th>
                <th className="py-3 px-4">Public Site</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {cases.map((c) => {
                const docCount = vaultItems.filter(
                  (v) => v.category === 'document' && v.caseIds.includes(c.id)
                ).length;
                const evCount = vaultItems.filter(
                  (v) => v.category === 'evidence' && v.caseIds.includes(c.id)
                ).length;
                const colCount = collections.filter((col) => col.caseId === c.id).length;
                return (
                  <tr key={c.id}>
                    <td className="py-3 px-4 font-mono-tabular text-zinc-500">{c.caseNumber}</td>
                    <td className="py-3 px-4 font-semibold">{c.title}</td>
                    <td className="py-3 px-4">
                      <StatusLabel status={c.status} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular">{docCount}</td>
                    <td className="py-3 px-4 text-right font-mono-tabular">{evCount}</td>
                    <td className="py-3 px-4 text-right font-mono-tabular">{colCount}</td>
                    <td className="py-3 px-4">
                      <StatusLabel status={c.isPublished ? 'Published' : 'Private'} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Custom Report Builder */}
      <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-5">
        <div>
          <h2 className="text-sm font-bold">Custom &amp; Complete Report Builder</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Customize which sections, metadata fields, timeline records, and evidence indexes appear in your PDF or CSV export.
          </p>
        </div>

        {cases.length === 0 ? (
          <p className="text-xs text-zinc-500">Create a case first to generate custom reports.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Target Case / Project
                </label>
                <select
                  value={selectedCaseId}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md"
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.caseNumber} — {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Custom Report Title
                </label>
                <input
                  type="text"
                  value={reportOptions.reportTitle}
                  onChange={(e) =>
                    setReportOptions({ ...reportOptions, reportTitle: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 text-xs">
              {(
                [
                  ['includeMetadata', 'Case Metadata'],
                  ['includeCustomFields', 'Custom Fields'],
                  ['includeSummary', 'Executive Summary'],
                  ['includeTimeline', `Timeline (${subData.timeline.length})`],
                  ['includeActors', `Actors (${subData.actors.length})`],
                  ['includeNarrative', `Narrative (${subData.sections.length})`],
                  ['includeDocuments', 'Document Index'],
                  ['includeEvidence', 'Evidence Index'],
                  ['includeCollections', 'Collections'],
                  ['publicOnly', 'Public Items Only'],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 p-2.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={reportOptions[key]}
                    onChange={(e) =>
                      setReportOptions({ ...reportOptions, [key]: e.target.checked })
                    }
                  />
                  <span className="font-medium truncate">{label}</span>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                disabled={!selectedCase || loadingSub}
                onClick={() => {
                  if (!selectedCase) return;
                  exportCasePdf({
                    caseRecord: selectedCase,
                    sections: subData.sections,
                    timeline: subData.timeline,
                    actors: subData.actors,
                    vaultItems,
                    collections,
                    options: reportOptions,
                  });
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-[#3061d0] text-white hover:bg-[#2752b4] disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{loadingSub ? 'Preparing...' : 'Export Custom PDF'}</span>
              </button>

              <button
                type="button"
                disabled={!selectedCase || loadingSub}
                onClick={() => {
                  if (!selectedCase) return;
                  exportCaseCustomCsv({
                    caseRecord: selectedCase,
                    sections: subData.sections,
                    timeline: subData.timeline,
                    actors: subData.actors,
                    vaultItems,
                    collections,
                    options: reportOptions,
                  });
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Custom CSV</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
