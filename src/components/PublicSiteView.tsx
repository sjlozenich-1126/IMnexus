import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Film,
  Layers,
  Moon,
  Music,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';
import type { MediaType, PublicSite } from '../types';
import { fetchPublicSiteBySlug } from '../services/firestoreService';
import { exportPublicSitePdf } from '../utils/exportReports';
import { formatBytes } from '../utils/vaultApi';
import { BrandMark, StatusLabel } from './BrandMark';
import { VaultDownloadLink, VaultImage, useResolvedVaultUrl } from './VaultMedia';

interface PublicSiteViewProps {
  slug: string;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigateArchive: () => void;
  onNavigateConsole: () => void;
  isAuthenticated: boolean;
}

interface PreviewArtifact {
  title: string;
  mediaType: MediaType;
  fileId?: string;
  fileName?: string;
  sha256?: string;
  textContent?: string;
  description?: string;
}

const PublicMediaLightboxStage: React.FC<{ previewItem: PreviewArtifact }> = ({
  previewItem,
}) => {
  const { url, loading, error } = useResolvedVaultUrl(previewItem.fileId);

  if (!previewItem.fileId || previewItem.mediaType === 'text') return null;

  if (loading) {
    return (
      <div className="p-8 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-500">
        Decrypting verified archival exhibit...
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-900 text-center text-xs text-red-600 dark:text-red-300">
        Unable to load decrypted file artifact.
      </div>
    );
  }

  if (previewItem.mediaType === 'image') {
    return (
      <img
        src={url}
        alt={previewItem.title}
        referrerPolicy="no-referrer"
        className="max-h-[60vh] mx-auto rounded border border-zinc-200 dark:border-zinc-800"
      />
    );
  }

  if (previewItem.mediaType === 'video') {
    return <video src={url} controls className="w-full max-h-[60vh] rounded bg-black" />;
  }

  if (previewItem.mediaType === 'audio') {
    return (
      <div className="p-6 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800">
        <audio src={url} controls className="w-full" />
      </div>
    );
  }

  if (previewItem.mediaType === 'pdf') {
    return (
      <iframe
        title={previewItem.title}
        src={url}
        className="w-full h-[60vh] rounded border border-zinc-200 dark:border-zinc-800"
      />
    );
  }

  return null;
};

export const PublicSiteView: React.FC<PublicSiteViewProps> = ({
  slug,
  darkMode,
  onToggleDarkMode,
  onNavigateArchive,
  onNavigateConsole,
  isAuthenticated,
}) => {
  const [site, setSite] = useState<PublicSite | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<PreviewArtifact | null>(null);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErrorMsg(null);
    fetchPublicSiteBySlug(slug)
      .then((res) => {
        if (!mounted) return;
        setSite(res);
      })
      .catch((err) => {
        if (!mounted) return;
        setErrorMsg(err instanceof Error ? err.message : 'Unable to load public dossier.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <BrandMark className="text-lg text-[#3061d0]" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading public archive record...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !site) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 text-center">
          <BrandMark className="text-lg text-[#3061d0] mb-4" />
          <h1 className="text-xl font-bold mb-2">Archive Record Unavailable</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
            {errorMsg ||
              'This public case URL is either unpublished or does not exist in the IMnexus public archive.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onNavigateArchive}
              className="px-4 py-2 text-xs font-semibold rounded-md bg-[#3061d0] text-white hover:opacity-90 cursor-pointer"
            >
              Browse Public Archive
            </button>
            <button
              type="button"
              onClick={onNavigateConsole}
              className="px-4 py-2 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              {isAuthenticated ? 'Return to Console' : 'Sign in to Console'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const coverSrc =
    site.coverUrl || '/assets/aistudio/maxim-berg-fKPZGJI4dXU-unsplash_b5b78643.jpg';
  const activeCollection =
    site.collections?.find((c) => c.id === activeCollectionId) || null;

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] text-zinc-950 dark:text-zinc-100">
      {/* Top Bar: Clean 3-zone contract */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0f1014]/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          <a
            href="/archive"
            onClick={(e) => {
              e.preventDefault();
              onNavigateArchive();
            }}
            className="text-base text-zinc-950 dark:text-white whitespace-nowrap shrink-0"
          >
            <BrandMark />
          </a>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            <a href="#overview" className="hover:text-[#3061d0] dark:hover:text-blue-400 whitespace-nowrap shrink-0">
              Overview
            </a>
            {Boolean(site.timeline?.length) && (
              <a href="#timeline" className="hover:text-[#3061d0] dark:hover:text-blue-400 whitespace-nowrap shrink-0">
                Timeline
              </a>
            )}
            {Boolean(site.actors?.length) && (
              <a href="#actors" className="hover:text-[#3061d0] dark:hover:text-blue-400 whitespace-nowrap shrink-0">
                Actors
              </a>
            )}
            {Boolean(site.sections?.length) && (
              <a href="#narrative" className="hover:text-[#3061d0] dark:hover:text-blue-400 whitespace-nowrap shrink-0">
                Narrative
              </a>
            )}
            {Boolean(site.documents?.length || site.evidence?.length || site.collections?.length) && (
              <a href="#evidence" className="hover:text-[#3061d0] dark:hover:text-blue-400 whitespace-nowrap shrink-0">
                Record &amp; Evidence
              </a>
            )}
          </nav>

          <button
            type="button"
            onClick={() => exportPublicSitePdf(site)}
            className="px-3.5 py-2 text-xs font-semibold rounded-md bg-[#3061d0] text-white hover:bg-[#2752b4] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Download Dossier PDF
          </button>
        </div>
      </header>

      {/* Utility Strip below Top Bar */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onNavigateArchive}
              className="inline-flex items-center gap-1 font-medium hover:text-zinc-950 dark:hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Public Archive</span>
            </button>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">Case {site.caseNumber || site.slug}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="inline-flex items-center gap-1.5 font-medium hover:text-zinc-950 dark:hover:text-white cursor-pointer"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{darkMode ? 'Light theme' : 'Dark theme'}</span>
            </button>
            {isAuthenticated && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={onNavigateConsole}
                  className="font-semibold text-[#3061d0] dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Open in Console
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Editorial Hero */}
      <section className="relative border-b border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-white overflow-hidden">
        <VaultImage
          src={coverSrc}
          alt={site.headline || site.title}
          className="absolute inset-0 w-full h-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/35" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-200 font-medium mb-4">
            <span className="font-mono-tabular uppercase tracking-wider">
              Case No. {site.caseNumber || '—'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{site.court || site.caseType}</span>
            <span aria-hidden="true">·</span>
            <StatusLabel status={site.status} />
          </div>

          <h1 className="font-serif-editorial text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.12] max-w-4xl [text-wrap:balance]">
            {site.headline || site.title}
          </h1>

          {site.subtitle && (
            <p className="mt-4 text-base sm:text-lg text-zinc-200 max-w-2xl leading-relaxed">
              {site.subtitle}
            </p>
          )}
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-16">
        {/* Overview & Accession Metadata Grid */}
        <section id="overview" className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-7 space-y-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-[#3061d0] dark:text-blue-400">
              Overview &amp; Case Record
            </div>
            <h2 className="font-serif-editorial text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
              {site.title}
            </h2>
            <p className="text-[15px] leading-[1.75] text-zinc-700 dark:text-zinc-300 whitespace-pre-line max-w-[70ch]">
              {site.intro || 'Public dossier summary and verified archival record.'}
            </p>
          </div>

          <div className="lg:col-span-5 bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-4">
              Dossier Metadata
            </h3>
            <dl className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">Case No.</dt>
                <dd className="font-mono-tabular font-semibold text-right">{site.caseNumber || '—'}</dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">Jurisdiction / Entity</dt>
                <dd className="font-medium text-right">{site.court || '—'}</dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">Presiding Lead / Judge</dt>
                <dd className="font-medium text-right">{site.judge || '—'}</dd>
              </div>
              {site.charge && (
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-zinc-500 dark:text-zinc-400">Subject / Cause</dt>
                  <dd className="font-medium text-right">{site.charge}</dd>
                </div>
              )}
              {site.arrestDates && (
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-zinc-500 dark:text-zinc-400">Key Dates</dt>
                  <dd className="font-mono-tabular font-medium text-right">{site.arrestDates}</dd>
                </div>
              )}
              {site.closureDate && (
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-zinc-500 dark:text-zinc-400">Closure Date</dt>
                  <dd className="font-mono-tabular font-medium text-right">{site.closureDate}</dd>
                </div>
              )}
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">Disposition</dt>
                <dd className="font-semibold text-right">{site.disposition || site.status}</dd>
              </div>
              {site.customFields?.map((cf, i) => (
                <div key={i} className="py-2.5 flex justify-between gap-4">
                  <dt className="text-zinc-500 dark:text-zinc-400">{cf.label}</dt>
                  <dd className="font-medium text-right">{cf.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Chronological Timeline */}
        {Boolean(site.timeline?.length) && (
          <section id="timeline" className="pt-8 border-t border-zinc-200 dark:border-zinc-800">
            <div className="text-xs font-semibold uppercase tracking-widest text-[#3061d0] dark:text-blue-400 mb-2">
              Chronology
            </div>
            <h2 className="font-serif-editorial text-2xl font-semibold tracking-tight mb-6">
              Chronological Timeline of Events
            </h2>
            <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800">
              {site.timeline!.map((ev) => (
                <div
                  key={ev.id}
                  className="p-5 grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-3 sm:gap-6 items-start"
                >
                  <div className="font-mono-tabular text-xs font-semibold text-zinc-500 dark:text-zinc-400 pt-0.5">
                    <div>{ev.date}</div>
                    {ev.time && <div className="text-zinc-400 dark:text-zinc-500">{ev.time}</div>}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-950 dark:text-white mb-1">
                      {ev.title}
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                      {ev.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Key Actors */}
        {Boolean(site.actors?.length) && (
          <section id="actors" className="pt-8 border-t border-zinc-200 dark:border-zinc-800">
            <div className="text-xs font-semibold uppercase tracking-widest text-[#3061d0] dark:text-blue-400 mb-2">
              Directory
            </div>
            <h2 className="font-serif-editorial text-2xl font-semibold tracking-tight mb-6">
              Key Actors &amp; Institutional Entities
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {site.actors!.map((actor) => (
                <div
                  key={actor.id}
                  className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5"
                >
                  <div className="text-xs font-semibold text-[#3061d0] dark:text-blue-400 mb-1">
                    {actor.role}
                  </div>
                  <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                    {actor.name}
                  </h3>
                  {actor.organization && (
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {actor.organization}
                    </div>
                  )}
                  {actor.notes && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-3 leading-relaxed">
                      {actor.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Narrative Sections */}
        {Boolean(site.sections?.length) && (
          <section id="narrative" className="pt-8 border-t border-zinc-200 dark:border-zinc-800">
            <div className="text-xs font-semibold uppercase tracking-widest text-[#3061d0] dark:text-blue-400 mb-2">
              Dossier Narrative
            </div>
            <h2 className="font-serif-editorial text-2xl font-semibold tracking-tight mb-8">
              Structured Findings &amp; Report Sections
            </h2>
            <div className="space-y-10 max-w-3xl">
              {site.sections!.map((sec) => (
                <article
                  key={sec.id}
                  className="pb-8 border-b border-zinc-200 dark:border-zinc-800 last:border-b-0"
                >
                  <h3 className="font-serif-editorial text-xl font-semibold text-zinc-950 dark:text-white mb-3">
                    {String(sec.order).padStart(2, '0')}. {sec.title}
                  </h3>
                  <div className="text-[15px] leading-[1.78] text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
                    {sec.content}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Documents, Collections & Evidence */}
        <section id="evidence" className="pt-8 border-t border-zinc-200 dark:border-zinc-800 space-y-12">
          {Boolean(site.collections?.length) && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-[#3061d0] dark:text-blue-400 mb-2">
                Curated Evidence Sets
              </div>
              <h2 className="font-serif-editorial text-2xl font-semibold tracking-tight mb-6">
                Evidence Collections
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {site.collections!.map((col) => (
                  <div
                    key={col.id}
                    className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden flex flex-col"
                  >
                    <div className="aspect-[16/9] bg-zinc-100 dark:bg-zinc-900 relative overflow-hidden">
                      {col.coverImageUrl ? (
                        <VaultImage
                          src={col.coverImageUrl}
                          alt={col.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-400">
                          <Layers className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <div className="p-6 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                          {col.items.length} artifacts{col.tags.length ? ` · ${col.tags.join(', ')}` : ''}
                        </div>
                        <h3 className="text-lg font-bold text-zinc-950 dark:text-white mb-2">
                          {col.title}
                        </h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                          {col.explanation}
                        </p>
                      </div>
                      <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveCollectionId(activeCollectionId === col.id ? null : col.id)
                          }
                          className="text-xs font-semibold text-[#3061d0] dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          {activeCollectionId === col.id ? 'Hide Collection Items' : `Inspect ${col.items.length} Items`}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {activeCollection && (
                <div className="mt-6 bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-base font-bold">
                      Collection Items — {activeCollection.title}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setActiveCollectionId(null)}
                      className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeCollection.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPreviewItem(item)}
                        className="text-left bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-4 hover:border-[#3061d0] transition-colors cursor-pointer"
                      >
                        <div className="text-[11px] font-mono-tabular font-semibold uppercase text-[#3061d0] dark:text-blue-400 mb-1">
                          {item.mediaType}
                        </div>
                        <div className="text-sm font-bold text-zinc-950 dark:text-white truncate">
                          {item.title}
                        </div>
                        {item.description && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {Boolean(site.documents?.length) && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-[#3061d0] dark:text-blue-400 mb-2">
                Document Repository
              </div>
              <h2 className="font-serif-editorial text-2xl font-semibold tracking-tight mb-6">
                Public Documents &amp; Filings
              </h2>
              <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      <th className="py-3 px-4">Document</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Size</th>
                      <th className="py-3 px-4">SHA-256 Digest</th>
                      <th className="py-3 px-4 text-right">Access</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {site.documents!.map((d) => (
                      <tr key={d.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                        <td className="py-3.5 px-4 font-semibold">{d.title}</td>
                        <td className="py-3.5 px-4 text-zinc-500 dark:text-zinc-400">
                          {d.docType || 'Document'}
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular text-xs text-zinc-500">
                          {d.fileSize ? formatBytes(d.fileSize) : '—'}
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular text-xs text-zinc-500">
                          {d.sha256 ? `${d.sha256.slice(0, 14)}…` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {d.fileId ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewItem({
                                  title: d.title,
                                  mediaType: d.mimeType?.includes('pdf') ? 'pdf' : 'file',
                                  fileId: d.fileId,
                                  fileName: d.fileName,
                                  sha256: d.sha256,
                                  description: d.description,
                                })
                              }
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#3061d0] dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Inspect</span>
                            </button>
                          ) : (
                            <span className="text-xs text-zinc-400">Record only</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {Boolean(site.evidence?.length) && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-[#3061d0] dark:text-blue-400 mb-2">
                Evidentiary Exhibit Gallery
              </div>
              <h2 className="font-serif-editorial text-2xl font-semibold tracking-tight mb-6">
                Public Evidence Items
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {site.evidence!.map((item) => {
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPreviewItem(item)}
                      className="text-left bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden hover:border-[#3061d0] transition-colors cursor-pointer"
                    >
                      <div className="aspect-[16/10] bg-zinc-100 dark:bg-zinc-900 relative flex items-center justify-center overflow-hidden">
                        {item.mediaType === 'image' && item.fileId ? (
                          <VaultImage
                            src={item.fileId}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : item.mediaType === 'video' ? (
                          <div className="flex flex-col items-center gap-1.5 text-zinc-500">
                            <Film className="w-7 h-7" />
                            <span className="text-[11px] font-semibold uppercase">Video Exhibit</span>
                          </div>
                        ) : item.mediaType === 'audio' ? (
                          <div className="flex flex-col items-center gap-1.5 text-zinc-500">
                            <Music className="w-7 h-7" />
                            <span className="text-[11px] font-semibold uppercase">Audio Recording</span>
                          </div>
                        ) : item.mediaType === 'text' ? (
                          <div className="p-4 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-4 self-start">
                            {item.textContent || item.description}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-zinc-500">
                            <FileText className="w-7 h-7" />
                            <span className="text-[11px] font-semibold uppercase">
                              {item.mediaType}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="text-[11px] font-mono-tabular text-zinc-500 dark:text-zinc-400 mb-1">
                          {item.mediaType.toUpperCase()}
                          {item.tags.length ? ` · ${item.tags.slice(0, 2).join(', ')}` : ''}
                        </div>
                        <div className="text-sm font-bold text-zinc-950 dark:text-white truncate">
                          {item.title}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-8 mt-16 bg-white dark:bg-[#0f1014]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <BrandMark className="text-zinc-950 dark:text-white" />
            <span aria-hidden="true">·</span>
            <span>Public Dossier Archive</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#3061d0]" />
            <span>SHA-256 Verified Archival Publication</span>
          </div>
        </div>
      </footer>

      {/* Public Media Lightbox Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[11px] font-mono-tabular uppercase text-[#3061d0] dark:text-blue-400">
                  {previewItem.mediaType} Exhibit
                </div>
                <h3 className="text-base font-bold truncate">{previewItem.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                aria-label="Close preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-auto flex-1 space-y-4">
              <PublicMediaLightboxStage previewItem={previewItem} />
              {previewItem.textContent && (
                <div className="p-5 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 text-sm leading-relaxed whitespace-pre-line font-serif-editorial">
                  {previewItem.textContent}
                </div>
              )}
              {previewItem.description && (
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {previewItem.description}
                </p>
              )}
              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
                <div className="font-mono-tabular">
                  {previewItem.sha256 ? `SHA-256: ${previewItem.sha256}` : 'Verified Record'}
                </div>
                {previewItem.fileId && (
                  <VaultDownloadLink
                    fileId={previewItem.fileId}
                    fileName={previewItem.fileName || previewItem.title}
                    className="inline-flex items-center gap-1.5 font-semibold text-[#3061d0] dark:text-blue-400 hover:underline cursor-pointer"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
