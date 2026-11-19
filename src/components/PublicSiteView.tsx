import React, { useEffect, useMemo, useState } from 'react';
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
import { buildPublicSiteNexus } from '../utils/nexusEngine';
import { formatBytes } from '../utils/vaultApi';
import { BrandMark, StatusLabel } from './BrandMark';
import { NexusMapView } from './NexusMapView';
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

const DEFAULT_HERO_COVER = '/assets/aistudio/kanhaiya-sharma-EiAqej-cGks-unsplash_c5de0270.jpg';

const PublicMediaLightboxStage: React.FC<{ previewItem: PreviewArtifact }> = ({
  previewItem,
}) => {
  const { url, loading, error } = useResolvedVaultUrl(previewItem.fileId);

  if (!previewItem.fileId || previewItem.mediaType === 'text') return null;

  if (loading) {
    return (
      <div className="p-8 bg-[#f3f0e9] dark:bg-[#111413] border border-[#ddd8ce] dark:border-[#262b27] text-center text-xs text-[#6a716b] dark:text-[#9ca39d]">
        Decrypting verified archival exhibit...
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="p-6 bg-[#8b3a3a]/10 border border-[#8b3a3a]/30 text-center text-xs text-[#8b3a3a] dark:text-[#d17b7b]">
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
        className="max-h-[60vh] mx-auto border border-[#ddd8ce] dark:border-[#262b27]"
      />
    );
  }

  if (previewItem.mediaType === 'video') {
    return <video src={url} controls className="w-full max-h-[60vh] bg-black" />;
  }

  if (previewItem.mediaType === 'audio') {
    return (
      <div className="p-6 bg-[#f3f0e9] dark:bg-[#111413] border border-[#ddd8ce] dark:border-[#262b27]">
        <audio src={url} controls className="w-full" />
      </div>
    );
  }

  if (previewItem.mediaType === 'pdf') {
    return (
      <iframe
        title={previewItem.title}
        src={url}
        className="w-full h-[60vh] border border-[#ddd8ce] dark:border-[#262b27]"
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

  const siteNexusGraph = useMemo(
    () => (site ? buildPublicSiteNexus(site) : null),
    [site]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3f0e9] dark:bg-[#0c0e0c] text-[#0f1210] dark:text-[#f3f0e9] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <BrandMark className="text-lg text-[#0f1210] dark:text-[#f3f0e9]" />
          <p className="text-sm text-[#6a716b] dark:text-[#9ca39d]">
            Loading public archive record...
          </p>
        </div>
      </div>
    );
  }

  if (errorMsg || !site) {
    return (
      <div className="min-h-screen bg-[#f3f0e9] dark:bg-[#0c0e0c] text-[#0f1210] dark:text-[#f3f0e9] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-8 text-center">
          <BrandMark className="text-lg text-[#0f1210] dark:text-[#f3f0e9] mb-4" />
          <h1 className="text-xl font-semibold mb-2">Archive Record Unavailable</h1>
          <p className="text-sm text-[#6a716b] dark:text-[#9ca39d] mb-6">
            {errorMsg ||
              'This public case URL is either unpublished or does not exist in the IMnexus public archive.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onNavigateArchive}
              className="px-4 py-2 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] hover:bg-[#1a2e24] dark:hover:bg-[#e9e5db] cursor-pointer"
            >
              Browse Public Archive
            </button>
            <button
              type="button"
              onClick={onNavigateConsole}
              className="px-4 py-2 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] hover:border-[#0f1210] dark:hover:border-[#8d948e] cursor-pointer"
            >
              {isAuthenticated ? 'Return to Console' : 'Sign in to Console'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const coverSrc = site.coverUrl || DEFAULT_HERO_COVER;
  const activeCollection =
    site.collections?.find((c) => c.id === activeCollectionId) || null;

  return (
    <div className="min-h-screen bg-[#f3f0e9] dark:bg-[#0c0e0c] text-[#0f1210] dark:text-[#f3f0e9]">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-[#faf8f4]/95 dark:bg-[#111413]/95 backdrop-blur border-b border-[#ddd8ce] dark:border-[#262b27]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[54px] flex items-center justify-between gap-6">
          <a
            href="/archive"
            onClick={(e) => {
              e.preventDefault();
              onNavigateArchive();
            }}
            className="text-[15px] text-[#0f1210] dark:text-[#f3f0e9] whitespace-nowrap shrink-0"
          >
            <BrandMark />
          </a>

          <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-[#6a716b] dark:text-[#9ca39d]">
            <a
              href="#overview"
              className="hover:text-[#0f1210] dark:hover:text-[#f3f0e9] whitespace-nowrap shrink-0 transition-colors"
            >
              Overview
            </a>
            {siteNexusGraph && (
              <a
                href="#nexus"
                className="hover:text-[#2d5a3d] dark:hover:text-[#7fb892] whitespace-nowrap shrink-0 transition-colors"
              >
                Nexus Map
              </a>
            )}
            {Boolean(site.timeline?.length) && (
              <a
                href="#timeline"
                className="hover:text-[#0f1210] dark:hover:text-[#f3f0e9] whitespace-nowrap shrink-0 transition-colors"
              >
                Timeline
              </a>
            )}
            {Boolean(site.actors?.length) && (
              <a
                href="#actors"
                className="hover:text-[#0f1210] dark:hover:text-[#f3f0e9] whitespace-nowrap shrink-0 transition-colors"
              >
                Actors
              </a>
            )}
            {Boolean(site.sections?.length) && (
              <a
                href="#narrative"
                className="hover:text-[#0f1210] dark:hover:text-[#f3f0e9] whitespace-nowrap shrink-0 transition-colors"
              >
                Narrative
              </a>
            )}
            {Boolean(
              site.documents?.length || site.evidence?.length || site.collections?.length
            ) && (
              <a
                href="#evidence"
                className="hover:text-[#0f1210] dark:hover:text-[#f3f0e9] whitespace-nowrap shrink-0 transition-colors"
              >
                Record &amp; Evidence
              </a>
            )}
          </nav>

          <button
            type="button"
            onClick={() => exportPublicSitePdf(site)}
            className="px-3.5 py-1.5 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] hover:bg-[#1a2e24] dark:hover:bg-[#e9e5db] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Download Dossier PDF
          </button>
        </div>
      </header>

      {/* Utility Strip */}
      <div className="border-b border-[#ddd8ce] dark:border-[#262b27] bg-[#e9e5db]/60 dark:bg-[#141814]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-[#6a716b] dark:text-[#9ca39d]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onNavigateArchive}
              className="inline-flex items-center gap-1 font-medium hover:text-[#0f1210] dark:hover:text-[#f3f0e9] cursor-pointer"
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
              className="inline-flex items-center gap-1.5 font-medium hover:text-[#0f1210] dark:hover:text-[#f3f0e9] cursor-pointer"
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
                  className="font-medium text-[#2d5a3d] dark:text-[#7fb892] hover:underline cursor-pointer"
                >
                  Open in Console
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Editorial Hero */}
      <section className="relative border-b border-[#ddd8ce] dark:border-[#262b27] bg-[#0c0e0c] text-[#f3f0e9] overflow-hidden">
        <VaultImage
          src={coverSrc}
          alt={site.headline || site.title}
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0e0c]/90 via-[#0c0e0c]/60 to-[#0c0e0c]/40" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#d8d3c8] font-medium mb-4">
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
            <p className="mt-4 text-base sm:text-lg text-[#d8d3c8] max-w-2xl leading-relaxed">
              {site.subtitle}
            </p>
          )}
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-16">
        {/* Overview & Accession Metadata Grid */}
        <section id="overview" className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-7 space-y-4">
            <div className="font-mono-tabular text-[11px] font-medium uppercase tracking-[0.14em] text-[#2d5a3d] dark:text-[#7fb892]">
              Overview &amp; Case Record
            </div>
            <h2 className="font-serif-editorial text-2xl font-semibold tracking-tight text-[#0f1210] dark:text-[#f3f0e9]">
              {site.title}
            </h2>
            <p className="text-[15px] leading-[1.75] text-[#2b302c] dark:text-[#c4bfb4] whitespace-pre-line max-w-[70ch]">
              {site.intro || 'Public dossier summary and verified archival record.'}
            </p>
          </div>

          <div className="lg:col-span-5 bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-6">
            <h3 className="font-mono-tabular text-[11px] font-medium uppercase tracking-[0.12em] text-[#6a716b] dark:text-[#8d948e] mb-4">
              Dossier Metadata
            </h3>
            <dl className="divide-y divide-[#e9e5db] dark:divide-[#222723] text-sm">
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-[#6a716b] dark:text-[#9ca39d]">Case No.</dt>
                <dd className="font-mono-tabular font-medium text-right">{site.caseNumber || '—'}</dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-[#6a716b] dark:text-[#9ca39d]">Jurisdiction / Entity</dt>
                <dd className="font-medium text-right">{site.court || '—'}</dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-[#6a716b] dark:text-[#9ca39d]">Presiding Lead / Judge</dt>
                <dd className="font-medium text-right">{site.judge || '—'}</dd>
              </div>
              {site.charge && (
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-[#6a716b] dark:text-[#9ca39d]">Subject / Cause</dt>
                  <dd className="font-medium text-right">{site.charge}</dd>
                </div>
              )}
              {site.arrestDates && (
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-[#6a716b] dark:text-[#9ca39d]">Key Dates</dt>
                  <dd className="font-mono-tabular font-medium text-right">{site.arrestDates}</dd>
                </div>
              )}
              {site.closureDate && (
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-[#6a716b] dark:text-[#9ca39d]">Closure Date</dt>
                  <dd className="font-mono-tabular font-medium text-right">{site.closureDate}</dd>
                </div>
              )}
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-[#6a716b] dark:text-[#9ca39d]">Disposition</dt>
                <dd className="font-medium text-right">{site.disposition || site.status}</dd>
              </div>
              {site.customFields?.map((cf, i) => (
                <div key={i} className="py-2.5 flex justify-between gap-4">
                  <dt className="text-[#6a716b] dark:text-[#9ca39d]">{cf.label}</dt>
                  <dd className="font-medium text-right">{cf.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Visual Nexus: Connections, Patterns & Insights */}
        {siteNexusGraph && (
          <section id="nexus" className="pt-8 border-t border-[#ddd8ce] dark:border-[#262b27]">
            <div className="font-mono-tabular text-[11px] font-medium uppercase tracking-[0.14em] text-[#2d5a3d] dark:text-[#7fb892] mb-2">
              Relational Intelligence
            </div>
            <h2 className="font-serif-editorial text-2xl font-semibold tracking-tight mb-6 text-[#0f1210] dark:text-[#f3f0e9]">
              Nexus Connections, Patterns &amp; Insights
            </h2>
            <NexusMapView
              graph={siteNexusGraph}
              subtitle="Interactive entity, chronology, collection, and evidentiary correlation diagram synthesized from this public dossier."
              onInspectNodeArtifact={(node) =>
                setPreviewItem({
                  title: node.label,
                  mediaType: (node.mediaType as MediaType) || 'file',
                  fileId: node.fileId,
                  fileName: node.fileName,
                  sha256: node.sha256,
                  textContent: node.textContent,
                  description: node.description,
                })
              }
            />
          </section>
        )}

        {/* Chronological Timeline */}
        {Boolean(site.timeline?.length) && (
          <section id="timeline" className="pt-8 border-t border-[#ddd8ce] dark:border-[#262b27]">
            <div className="font-mono-tabular text-[11px] font-medium uppercase tracking-[0.14em] text-[#2d5a3d] dark:text-[#7fb892] mb-2">
              Chronology
            </div>
            <h2 className="font-serif-editorial text-2xl font-semibold tracking-tight mb-6 text-[#0f1210] dark:text-[#f3f0e9]">
              Chronological Timeline of Events
            </h2>
            <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] divide-y divide-[#e9e5db] dark:divide-[#222723]">
              {site.timeline!.map((ev) => (
                <div
                  key={ev.id}
                  className="p-5 grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-3 sm:gap-6 items-start"
                >
                  <div className="font-mono-tabular text-xs font-medium text-[#6a716b] dark:text-[#9ca39d] pt-0.5">
                    <div>{ev.date}</div>
                    {ev.time && (
                      <div className="text-[#8d948e] dark:text-[#6a716b]">{ev.time}</div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#0f1210] dark:text-[#f3f0e9] mb-1">
                      {ev.title}
                    </h3>
                    <p className="text-sm text-[#2b302c] dark:text-[#c4bfb4] leading-relaxed whitespace-pre-line">
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
          <section id="actors" className="pt-8 border-t border-[#ddd8ce] dark:border-[#262b27]">
            <div className="font-mono-tabular text-[11px] font-medium uppercase tracking-[0.14em] text-[#2d5a3d] dark:text-[#7fb892] mb-2">
              Directory
            </div>
            <h2 className="font-serif-editorial text-2xl font-semibold tracking-tight mb-6 text-[#0f1210] dark:text-[#f3f0e9]">
              Key Actors &amp; Institutional Entities
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {site.actors!.map((actor) => (
                <div
                  key={actor.id}
                  className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-5"
                >
                  <div className="font-mono-tabular text-[11px] font-medium uppercase tracking-wider text-[#2d5a3d] dark:text-[#7fb892] mb-1">
                    {actor.role}
                  </div>
                  <h3 className="text-base font-semibold text-[#0f1210] dark:text-[#f3f0e9]">
                    {actor.name}
                  </h3>
                  {actor.organization && (
                    <div className="text-xs font-medium text-[#6a716b] dark:text-[#9ca39d] mt-0.5">
                      {actor.organization}
                    </div>
                  )}
                  {actor.notes && (
                    <p className="text-xs text-[#2b302c] dark:text-[#c4bfb4] mt-3 leading-relaxed">
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
          <section id="narrative" className="pt-8 border-t border-[#ddd8ce] dark:border-[#262b27]">
            <div className="font-mono-tabular text-[11px] font-medium uppercase tracking-[0.14em] text-[#2d5a3d] dark:text-[#7fb892] mb-2">
              Dossier Narrative
            </div>
            <h2 className="font-serif-editorial text-2xl font-semibold tracking-tight mb-8 text-[#0f1210] dark:text-[#f3f0e9]">
              Structured Findings &amp; Report Sections
            </h2>
            <div className="space-y-10 max-w-3xl">
              {site.sections!.map((sec) => (
                <article
                  key={sec.id}
                  className="pb-8 border-b border-[#e9e5db] dark:border-[#222723] last:border-b-0"
                >
                  <h3 className="font-serif-editorial text-xl font-semibold text-[#0f1210] dark:text-[#f3f0e9] mb-3">
                    {String(sec.order).padStart(2, '0')}. {sec.title}
                  </h3>
                  <div className="text-[15px] leading-[1.78] text-[#2b302c] dark:text-[#c4bfb4] whitespace-pre-line">
                    {sec.content}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Documents, Collections & Evidence */}
        <section
          id="evidence"
          className="pt-8 border-t border-[#ddd8ce] dark:border-[#262b27] space-y-12"
        >
          {Boolean(site.collections?.length) && (
            <div>
              <div className="font-mono-tabular text-[11px] font-medium uppercase tracking-[0.14em] text-[#2d5a3d] dark:text-[#7fb892] mb-2">
                Curated Evidence Sets
              </div>
              <h2 className="font-serif-editorial text-2xl font-semibold tracking-tight mb-6 text-[#0f1210] dark:text-[#f3f0e9]">
                Evidence Collections
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {site.collections!.map((col) => (
                  <div
                    key={col.id}
                    className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] overflow-hidden flex flex-col"
                  >
                    <div className="aspect-[16/9] bg-[#e9e5db] dark:bg-[#111413] border-b border-[#ddd8ce] dark:border-[#262b27] relative overflow-hidden">
                      {col.coverImageUrl ? (
                        <VaultImage
                          src={col.coverImageUrl}
                          alt={col.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#6a716b] dark:text-[#8d948e]">
                          <Layers className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <div className="p-6 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="font-mono-tabular text-[11px] font-medium text-[#6a716b] dark:text-[#8d948e] mb-1.5">
                          {col.items.length} artifacts
                          {col.tags.length ? ` · ${col.tags.join(', ')}` : ''}
                        </div>
                        <h3 className="text-lg font-semibold text-[#0f1210] dark:text-[#f3f0e9] mb-2">
                          {col.title}
                        </h3>
                        <p className="text-sm text-[#2b302c] dark:text-[#c4bfb4] leading-relaxed whitespace-pre-line">
                          {col.explanation}
                        </p>
                      </div>
                      <div className="mt-5 pt-4 border-t border-[#e9e5db] dark:border-[#222723] flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveCollectionId(activeCollectionId === col.id ? null : col.id)
                          }
                          className="text-xs font-medium text-[#2d5a3d] dark:text-[#7fb892] hover:underline cursor-pointer"
                        >
                          {activeCollectionId === col.id
                            ? 'Hide Collection Items'
                            : `Inspect ${col.items.length} Items`}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {activeCollection && (
                <div className="mt-6 bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-base font-semibold text-[#0f1210] dark:text-[#f3f0e9]">
                      Collection Items — {activeCollection.title}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setActiveCollectionId(null)}
                      className="text-xs font-medium text-[#6a716b] hover:text-[#0f1210] dark:hover:text-[#f3f0e9] cursor-pointer"
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
                        className="text-left bg-[#f3f0e9] dark:bg-[#111413] border border-[#ddd8ce] dark:border-[#262b27] p-4 hover:border-[#0f1210] dark:hover:border-[#8d948e] transition-colors cursor-pointer"
                      >
                        <div className="text-[11px] font-mono-tabular font-medium uppercase text-[#2d5a3d] dark:text-[#7fb892] mb-1">
                          {item.mediaType}
                        </div>
                        <div className="text-sm font-semibold text-[#0f1210] dark:text-[#f3f0e9] truncate">
                          {item.title}
                        </div>
                        {item.description && (
                          <p className="text-xs text-[#6a716b] dark:text-[#9ca39d] mt-1 line-clamp-2">
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
              <div className="font-mono-tabular text-[11px] font-medium uppercase tracking-[0.14em] text-[#2d5a3d] dark:text-[#7fb892] mb-2">
                Document Repository
              </div>
              <h2 className="font-serif-editorial text-2xl font-semibold tracking-tight mb-6 text-[#0f1210] dark:text-[#f3f0e9]">
                Public Documents &amp; Filings
              </h2>
              <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9]/70 dark:bg-[#111413] text-[11px] font-medium uppercase tracking-wider text-[#6a716b] dark:text-[#8d948e]">
                      <th className="py-3 px-4">Document</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Size</th>
                      <th className="py-3 px-4">SHA-256 Digest</th>
                      <th className="py-3 px-4 text-right">Access</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e9e5db] dark:divide-[#222723]">
                    {site.documents!.map((d) => (
                      <tr key={d.id} className="hover:bg-[#f3f0e9]/60 dark:hover:bg-[#1c201c]">
                        <td className="py-3.5 px-4 font-medium">{d.title}</td>
                        <td className="py-3.5 px-4 text-[#6a716b] dark:text-[#9ca39d]">
                          {d.docType || 'Document'}
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular text-xs text-[#6a716b] dark:text-[#8d948e]">
                          {d.fileSize ? formatBytes(d.fileSize) : '—'}
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular text-xs text-[#6a716b] dark:text-[#8d948e]">
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
                              className="inline-flex items-center gap-1 text-xs font-medium text-[#2d5a3d] dark:text-[#7fb892] hover:underline cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Inspect</span>
                            </button>
                          ) : (
                            <span className="text-xs text-[#6a716b] dark:text-[#8d948e]">
                              Record only
                            </span>
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
              <div className="font-mono-tabular text-[11px] font-medium uppercase tracking-[0.14em] text-[#2d5a3d] dark:text-[#7fb892] mb-2">
                Evidentiary Exhibit Gallery
              </div>
              <h2 className="font-serif-editorial text-2xl font-semibold tracking-tight mb-6 text-[#0f1210] dark:text-[#f3f0e9]">
                Public Evidence Items
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {site.evidence!.map((item) => {
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPreviewItem(item)}
                      className="text-left bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] overflow-hidden hover:border-[#0f1210] dark:hover:border-[#8d948e] transition-colors cursor-pointer"
                    >
                      <div className="aspect-[16/10] bg-[#e9e5db] dark:bg-[#111413] border-b border-[#ddd8ce] dark:border-[#262b27] relative flex items-center justify-center overflow-hidden">
                        {item.mediaType === 'image' && item.fileId ? (
                          <VaultImage
                            src={item.fileId}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : item.mediaType === 'video' ? (
                          <div className="flex flex-col items-center gap-1.5 text-[#6a716b] dark:text-[#8d948e]">
                            <Film className="w-7 h-7" />
                            <span className="font-mono-tabular text-[11px] font-medium uppercase">
                              Video Exhibit
                            </span>
                          </div>
                        ) : item.mediaType === 'audio' ? (
                          <div className="flex flex-col items-center gap-1.5 text-[#6a716b] dark:text-[#8d948e]">
                            <Music className="w-7 h-7" />
                            <span className="font-mono-tabular text-[11px] font-medium uppercase">
                              Audio Recording
                            </span>
                          </div>
                        ) : item.mediaType === 'text' ? (
                          <div className="p-4 text-xs text-[#2b302c] dark:text-[#c4bfb4] line-clamp-4 self-start">
                            {item.textContent || item.description}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-[#6a716b] dark:text-[#8d948e]">
                            <FileText className="w-7 h-7" />
                            <span className="font-mono-tabular text-[11px] font-medium uppercase">
                              {item.mediaType}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="text-[11px] font-mono-tabular text-[#6a716b] dark:text-[#8d948e] mb-1">
                          {item.mediaType.toUpperCase()}
                          {item.tags.length ? ` · ${item.tags.slice(0, 2).join(', ')}` : ''}
                        </div>
                        <div className="text-sm font-semibold text-[#0f1210] dark:text-[#f3f0e9] truncate">
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

      <footer className="border-t border-[#ddd8ce] dark:border-[#262b27] py-8 mt-16 bg-[#faf8f4] dark:bg-[#111413]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6a716b] dark:text-[#9ca39d]">
          <div className="flex items-center gap-2">
            <BrandMark className="text-[#0f1210] dark:text-[#f3f0e9]" />
            <span aria-hidden="true">·</span>
            <span>Public Dossier Archive</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#2d5a3d] dark:text-[#7fb892]" />
            <span>SHA-256 Verified Archival Publication</span>
          </div>
        </div>
      </footer>

      {/* Public Media Lightbox Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#ddd8ce] dark:border-[#262b27] flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[11px] font-mono-tabular uppercase text-[#2d5a3d] dark:text-[#7fb892]">
                  {previewItem.mediaType} Exhibit
                </div>
                <h3 className="text-base font-semibold truncate text-[#0f1210] dark:text-[#f3f0e9]">
                  {previewItem.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="p-1.5 border border-transparent hover:border-[#ddd8ce] dark:hover:border-[#262b27] text-[#6a716b] hover:text-[#0f1210] dark:hover:text-[#f3f0e9] cursor-pointer"
                aria-label="Close preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-auto flex-1 space-y-4">
              <PublicMediaLightboxStage previewItem={previewItem} />
              {previewItem.textContent && (
                <div className="p-5 bg-[#f3f0e9] dark:bg-[#111413] border border-[#ddd8ce] dark:border-[#262b27] text-sm leading-relaxed whitespace-pre-line font-serif-editorial text-[#0f1210] dark:text-[#f3f0e9]">
                  {previewItem.textContent}
                </div>
              )}
              {previewItem.description && (
                <p className="text-sm text-[#2b302c] dark:text-[#c4bfb4] leading-relaxed">
                  {previewItem.description}
                </p>
              )}
              <div className="pt-3 border-t border-[#e9e5db] dark:border-[#222723] flex flex-wrap items-center justify-between gap-3 text-xs text-[#6a716b] dark:text-[#9ca39d]">
                <div className="font-mono-tabular">
                  {previewItem.sha256 ? `SHA-256: ${previewItem.sha256}` : 'Verified Record'}
                </div>
                {previewItem.fileId && (
                  <VaultDownloadLink
                    fileId={previewItem.fileId}
                    fileName={previewItem.fileName || previewItem.title}
                    className="inline-flex items-center gap-1.5 font-medium text-[#2d5a3d] dark:text-[#7fb892] hover:underline cursor-pointer"
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
