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
          <h1 className="text-lg font-semibold tracking-[-0.02em] text-[#0f1210] dark:text-[#f3f0e9]">
            Reports &amp; Analytics
          </h1>
          <p className="text-xs text-[#6a716b] dark:text-[#8d948e] mt-1">
            Track dossier completion, archival readiness, and generate formatted Complete or Custom PDF / CSV exports.
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportCasesPortfolioCsv(cases, vaultItems, collections)}
          disabled={cases.length === 0}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] bg-[#faf8f4] dark:bg-[#161916] hover:border-[#0f1210] disabled:opacity-50 cursor-pointer whitespace-nowrap"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Export Full Portfolio CSV</span>
        </button>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-4">
          <div className="text-[10px] uppercase tracking-[0.1em] text-[#6a716b] mb-1">
            Published Public Sites
          </div>
          <div className="text-2xl font-semibold font-mono-tabular">
            {cases.filter((c) => c.isPublished).length}{' '}
            <span className="text-xs font-normal text-[#6a716b]">/ {cases.length}</span>
          </div>
        </div>
        <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-4">
          <div className="text-[10px] uppercase tracking-[0.1em] text-[#6a716b] mb-1">
            Public Vault Assets
          </div>
          <div className="text-2xl font-semibold font-mono-tabular">
            {vaultItems.filter((v) => v.isPublic).length}{' '}
            <span className="text-xs font-normal text-[#6a716b]">/ {vaultItems.length}</span>
          </div>
        </div>
        <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-4">
          <div className="text-[10px] uppercase tracking-[0.1em] text-[#6a716b] mb-1">
            Curated Collections
          </div>
          <div className="text-2xl font-semibold font-mono-tabular">{collections.length}</div>
        </div>
        <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-4">
          <div className="text-[10px] uppercase tracking-[0.1em] text-[#6a716b] mb-1">
            Encrypted Storage
          </div>
          <div className="text-2xl font-semibold font-mono-tabular">{formatBytes(totalVaultBytes)}</div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-[#2d5a3d] dark:text-[#7fb892]" />
            <h2 className="text-[13px] font-semibold">Case &amp; Project Status Distribution</h2>
          </div>
          <div className="space-y-3">
            {statusBreakdown.map(([status, count]) => (
              <div key={status} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-[#0f1210] dark:text-[#f3f0e9]">{status}</span>
                  <span className="font-mono-tabular text-[#6a716b]">{count}</span>
                </div>
                <div className="h-1.5 bg-[#e9e5db] dark:bg-[#262b27] overflow-hidden">
                  <div
                    className="h-full bg-[#1a2e24] dark:bg-[#7fb892]"
                    style={{ width: `${(count / maxStatusCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-[#2d5a3d] dark:text-[#7fb892]" />
            <h2 className="text-[13px] font-semibold">Evidence &amp; Document Format Mix</h2>
          </div>
          <div className="space-y-3">
            {mediaBreakdown.map(([format, count]) => (
              <div key={format} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-mono-tabular uppercase font-medium text-[#0f1210] dark:text-[#f3f0e9]">
                    {format}
                  </span>
                  <span className="font-mono-tabular text-[#6a716b]">{count}</span>
                </div>
                <div className="h-1.5 bg-[#e9e5db] dark:bg-[#262b27] overflow-hidden">
                  <div
                    className="h-full bg-[#0f1210] dark:bg-[#d8d3c8]"
                    style={{ width: `${(count / maxMediaCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Case Progress Tracking Table */}
      <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] overflow-x-auto">
        <div className="px-4 py-3 border-b border-[#ddd8ce] dark:border-[#262b27]">
          <h2 className="text-[13px] font-semibold">Project &amp; Case Readiness Tracker</h2>
        </div>
        {cases.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6a716b]">
            Create a case to track readiness metrics.
          </div>
        ) : (
          <table className="w-full text-left text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-[#ddd8ce] dark:border-[#262b27] bg-black/[0.015] dark:bg-white/[0.02] text-[10px] font-medium uppercase tracking-[0.1em] text-[#6a716b]">
                <th className="py-2.5 px-3.5">Case No.</th>
                <th className="py-2.5 px-3.5">Caption</th>
                <th className="py-2.5 px-3.5">Status</th>
                <th className="py-2.5 px-3.5 text-right">Docs</th>
                <th className="py-2.5 px-3.5 text-right">Evidence</th>
                <th className="py-2.5 px-3.5 text-right">Collections</th>
                <th className="py-2.5 px-3.5">Public Site</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9e5db] dark:divide-[#222723]">
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
                    <td className="py-2.5 px-3.5 font-mono-tabular text-[11px] text-[#6a716b]">{c.caseNumber}</td>
                    <td className="py-2.5 px-3.5 font-medium">{c.title}</td>
                    <td className="py-2.5 px-3.5">
                      <StatusLabel status={c.status} />
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono-tabular">{docCount}</td>
                    <td className="py-2.5 px-3.5 text-right font-mono-tabular">{evCount}</td>
                    <td className="py-2.5 px-3.5 text-right font-mono-tabular">{colCount}</td>
                    <td className="py-2.5 px-3.5">
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
      <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-5 space-y-5">
        <div>
          <h2 className="text-[13px] font-semibold">Custom &amp; Complete Report Builder</h2>
          <p className="text-xs text-[#6a716b] dark:text-[#8d948e] mt-0.5">
            Customize which sections, metadata fields, timeline records, and evidence indexes appear in your formatted PDF or CSV export.
          </p>
        </div>

        {cases.length === 0 ? (
          <p className="text-xs text-[#6a716b]">Create a case first to generate custom reports.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                  Target Case / Project
                </label>
                <select
                  value={selectedCaseId}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  className="w-full px-2.5 py-2 text-[13px] bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.caseNumber} — {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                  Custom Report Title
                </label>
                <input
                  type="text"
                  value={reportOptions.reportTitle}
                  onChange={(e) =>
                    setReportOptions({ ...reportOptions, reportTitle: e.target.value })
                  }
                  className="w-full px-2.5 py-2 text-[13px] bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
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
                  className="flex items-center gap-2 p-2.5 border border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9] dark:bg-[#0c0e0c] cursor-pointer"
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
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] hover:opacity-85 disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{loadingSub ? 'Preparing…' : 'Export Custom PDF'}</span>
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
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] bg-transparent hover:border-[#0f1210] disabled:opacity-50 cursor-pointer"
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
