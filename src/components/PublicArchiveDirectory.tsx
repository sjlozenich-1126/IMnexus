import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ExternalLink,
  FileText,
  Film,
  FolderKanban,
  Globe,
  Layers,
  MessageSquarePlus,
  Moon,
  Music,
  Play,
  Scale,
  Search,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';
import type { MediaType, PublicSite } from '../types';
import { fetchAllPublishedSites } from '../services/firestoreService';
import { parseVideoEmbed } from '../utils/mediaEmbed';
import {
  buildPublicPortfolioNexus,
  buildStratigraphicMap,
  type StratigraphicCaseInput,
} from '../utils/nexusEngine';
import { formatBytes } from '../utils/vaultApi';
import { BrandMark, StatusLabel } from './BrandMark';
import { EmbeddedVideoFrame } from './EmbeddedVideoFrame';
import { NexusMapView, type SelectableNexusCase } from './NexusMapView';
import { PublicTipBox } from './PublicTipBox';
import { stripRichHtmlToPlainText } from './RichTextEditor';
import { VaultDownloadLink, VaultImage, useResolvedVaultUrl } from './VaultMedia';

interface PublicArchiveDirectoryProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenSite: (slug: string) => void;
  onNavigateConsole: () => void;
  isAuthenticated: boolean;
}

interface AggregatedArtifact {
  id: string;
  title: string;
  mediaType: MediaType;
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  docType?: string;
  sha256?: string;
  textContent?: string;
  embedUrl?: string;
  description?: string;
  tags: string[];
  siteSlug: string;
  siteTitle: string;
  caseNumber?: string;
}

const DEFAULT_PUBLIC_COVER = '/assets/aistudio/kanhaiya-sharma-EiAqej-cGks-unsplash_c5de0270.jpg';

function getSiteSummary(site: PublicSite): string {
  const intro = site.intro?.trim();
  if (intro) return stripRichHtmlToPlainText(intro);
  const firstSection = site.sections?.find((s) => s.content?.trim())?.content?.trim();
  if (firstSection) return stripRichHtmlToPlainText(firstSection);
  const jurisdiction = site.court || site.caseType || 'Public Dossier';
  const disposition = site.disposition ? ` — ${site.disposition}` : '';
  return `${jurisdiction} archival dossier${disposition}. Includes chronological filings, actor directory, verified records, and cross-referenced exhibits.`;
}

const ArchiveLightboxStage: React.FC<{ item: AggregatedArtifact }> = ({ item }) => {
  const { url, loading, error } = useResolvedVaultUrl(item.fileId);

  if (item.embedUrl) {
    return <EmbeddedVideoFrame embedUrl={item.embedUrl} title={item.title} />;
  }

  if (!item.fileId || item.mediaType === 'text') return null;

  if (loading) {
    return (
      <div className="p-8 bg-[#f3f0e9] dark:bg-[#111413] border border-[#ddd8ce] dark:border-[#262b27] text-center text-xs text-[#6a716b] dark:text-[#9ca39d]">
        Decrypting verified archival exhibit…
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="p-6 bg-[#ef4423]/10 border border-[#ef4423]/30 text-center text-xs text-[#ef4423] dark:text-[#ff6b3d]">
        Unable to load decrypted file artifact.
      </div>
    );
  }

  if (item.mediaType === 'image') {
    return (
      <img
        src={url}
        alt={item.title}
        referrerPolicy="no-referrer"
        className="max-h-[58vh] mx-auto border border-[#ddd8ce] dark:border-[#262b27]"
      />
    );
  }

  if (item.mediaType === 'video') {
    return <video src={url} controls className="w-full max-h-[58vh] bg-black" />;
  }

  if (item.mediaType === 'audio') {
    return (
      <div className="p-6 bg-[#f3f0e9] dark:bg-[#111413] border border-[#ddd8ce] dark:border-[#262b27]">
        <audio src={url} controls className="w-full" />
      </div>
    );
  }

  if (item.mediaType === 'pdf') {
    return (
      <iframe
        title={item.title}
        src={url}
        className="w-full h-[58vh] border border-[#ddd8ce] dark:border-[#262b27]"
      />
    );
  }

  return null;
};

export const PublicArchiveDirectory: React.FC<PublicArchiveDirectoryProps> = ({
  darkMode,
  onToggleDarkMode,
  onOpenSite,
  onNavigateConsole,
  isAuthenticated,
}) => {
  const [sites, setSites] = useState<PublicSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewArtifact, setPreviewArtifact] = useState<AggregatedArtifact | null>(null);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    fetchAllPublishedSites()
      .then((res) => {
        if (mounted) {
          setSites(res);
          setSelectedSlugs(res.map((s) => s.slug));
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const q = searchQuery.trim().toLowerCase();

  const matchesSite = (s: PublicSite) => {
    if (!q) return true;
    return (
      s.title.toLowerCase().includes(q) ||
      (s.caseNumber || '').toLowerCase().includes(q) ||
      (s.court || '').toLowerCase().includes(q) ||
      (s.headline || '').toLowerCase().includes(q) ||
      (s.intro || '').toLowerCase().includes(q) ||
      (s.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  };

  const publishedCases = useMemo(
    () => sites.filter((s) => s.caseType !== 'project').filter(matchesSite),
    [sites, q]
  );

  const publishedProjects = useMemo(
    () => sites.filter((s) => s.caseType === 'project').filter(matchesSite),
    [sites, q]
  );

  const allEvidence = useMemo<AggregatedArtifact[]>(() => {
    const out: AggregatedArtifact[] = [];
    const seen = new Set<string>();
    for (const s of sites) {
      for (const ev of s.evidence || []) {
        const key = `${s.slug}:${ev.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const item: AggregatedArtifact = {
          id: ev.id,
          title: ev.title,
          mediaType: ev.mediaType,
          fileId: ev.fileId,
          fileName: ev.fileName,
          sha256: ev.sha256,
          textContent: ev.textContent,
          embedUrl: ev.embedUrl,
          description: ev.description,
          tags: ev.tags || [],
          siteSlug: s.slug,
          siteTitle: s.headline || s.title,
          caseNumber: s.caseNumber,
        };
        if (
          !q ||
          item.title.toLowerCase().includes(q) ||
          (item.description || '').toLowerCase().includes(q) ||
          item.siteTitle.toLowerCase().includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q))
        ) {
          out.push(item);
        }
      }
      // Also surface collection items that carry embedUrls or files if not already listed
      for (const col of s.collections || []) {
        for (const ci of col.items || []) {
          const key = `${s.slug}:${ci.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const item: AggregatedArtifact = {
            id: ci.id,
            title: ci.title,
            mediaType: ci.mediaType,
            fileId: ci.fileId,
            fileName: ci.fileName,
            sha256: ci.sha256,
            textContent: ci.textContent,
            embedUrl: ci.embedUrl,
            description: ci.description,
            tags: col.tags || [],
            siteSlug: s.slug,
            siteTitle: s.headline || s.title,
            caseNumber: s.caseNumber,
          };
          if (
            !q ||
            item.title.toLowerCase().includes(q) ||
            (item.description || '').toLowerCase().includes(q) ||
            item.siteTitle.toLowerCase().includes(q)
          ) {
            out.push(item);
          }
        }
      }
    }
    return out;
  }, [sites, q]);

  const allDocuments = useMemo<AggregatedArtifact[]>(() => {
    const out: AggregatedArtifact[] = [];
    for (const s of sites) {
      for (const docItem of s.documents || []) {
        const mediaType: MediaType = docItem.mimeType?.includes('pdf') ? 'pdf' : 'file';
        const artifact: AggregatedArtifact = {
          id: docItem.id,
          title: docItem.title,
          mediaType,
          fileId: docItem.fileId,
          fileName: docItem.fileName,
          fileSize: docItem.fileSize,
          docType: docItem.docType || 'Filing',
          sha256: docItem.sha256,
          description: docItem.description,
          tags: [],
          siteSlug: s.slug,
          siteTitle: s.headline || s.title,
          caseNumber: s.caseNumber,
        };
        if (
          !q ||
          artifact.title.toLowerCase().includes(q) ||
          (artifact.docType || '').toLowerCase().includes(q) ||
          artifact.siteTitle.toLowerCase().includes(q)
        ) {
          out.push(artifact);
        }
      }
    }
    return out;
  }, [sites, q]);

  const leadCase = publishedCases[0] || null;
  const secondaryCases = publishedCases.slice(1);

  const selectableCases = useMemo<SelectableNexusCase[]>(
    () =>
      sites.map((s) => ({
        id: s.slug,
        caseNumber: s.caseNumber || s.slug,
        title: s.headline || s.title,
        status: s.status,
        caseType: s.caseType,
      })),
    [sites]
  );

  const publicNexusGraph = useMemo(
    () => buildPublicPortfolioNexus({ sites, selectedSlugs }),
    [sites, selectedSlugs]
  );

  const publicStratigraphicData = useMemo(() => {
    const inputs: StratigraphicCaseInput[] = sites
      .filter((s) => selectedSlugs.includes(s.slug))
      .map((s) => ({
        id: s.caseId || s.slug,
        slug: s.slug,
        caseNumber: s.caseNumber || s.slug,
        title: s.headline || s.title,
        status: s.status,
        court: s.court,
        arrestDates: s.arrestDates,
        closureDate: s.closureDate,
        tags: s.tags,
        earliestTimelineDate: s.timeline?.[0]?.date,
        sections: s.sections || [],
      }));
    return buildStratigraphicMap(inputs);
  }, [sites, selectedSlugs]);

  const toggleNexusSlug = (slug: string) => {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]
    );
  };

  return (
    <div className="min-h-screen bg-[#f3f0e9] dark:bg-[#0c0e0c] text-[#0f1210] dark:text-[#f3f0e9]">
      {/* Vivid Top Accent Line */}
      <div className="h-1 w-full bg-[#ef4423]" />

      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-[#faf8f4]/95 dark:bg-[#111413]/95 backdrop-blur border-b border-[#ddd8ce] dark:border-[#262b27]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[56px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-[15px] text-[#0f1210] dark:text-[#f3f0e9] whitespace-nowrap shrink-0">
              <BrandMark />
            </div>
            <span className="hidden sm:inline-block text-[10px] font-mono-tabular uppercase tracking-[0.14em] px-2 py-0.5 bg-[#ef4423] text-white font-semibold">
              Public Archive
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 min-h-[38px] border border-[#ddd8ce] dark:border-[#262b27] text-xs font-medium text-[#6a716b] dark:text-[#9ca39d] hover:text-[#0f1210] dark:hover:text-[#f3f0e9] hover:border-[#ef4423] transition-colors cursor-pointer whitespace-nowrap"
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span className="hidden xs:inline sm:inline">{darkMode ? 'Light' : 'Dark'}</span>
            </button>

            <button
              type="button"
              onClick={onNavigateConsole}
              className="px-3 sm:px-3.5 min-h-[38px] text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] hover:bg-[#ef4423] hover:text-white dark:hover:bg-[#ff6b3d] dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isAuthenticated ? 'Console' : 'Sign In'}
            </button>
          </div>
        </div>

        {/* Scrollable Section Index Strip (Mobile-Friendly) */}
        <div className="border-t border-[#e9e5db] dark:border-[#1f2420] bg-[#f3f0e9]/85 dark:bg-[#0e100f]">
          <nav
            aria-label="Public archive sections"
            className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-5 overflow-x-auto text-xs font-medium"
          >
            {[
              ['#overview', '01 · Overview'],
              ['#cases', `02 · Cases (${publishedCases.length})`],
              ['#nexus', '03 · Nexus Map'],
              ['#evidence', `04 · Evidence (${allEvidence.length})`],
              ['#projects', `05 · Projects (${publishedProjects.length})`],
              ['#documents', `06 · Documents (${allDocuments.length})`],
              ['#tips', '07 · Send Tip'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="py-2.5 min-h-[40px] inline-flex items-center whitespace-nowrap shrink-0 text-[#4a514b] dark:text-[#9ca39d] hover:text-[#ef4423] dark:hover:text-[#ff6b3d] border-b-2 border-transparent hover:border-[#ef4423] transition-colors font-mono-tabular text-[11px] uppercase tracking-[0.06em]"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-16 sm:space-y-20">
        {/* SECTION 1: OVERVIEW */}
        <section id="overview" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end border-b border-[#ddd8ce] dark:border-[#262b27] pb-8">
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-2 font-mono-tabular text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ef4423] dark:text-[#ff6b3d]">
                <span className="w-2 h-2 bg-[#ef4423] inline-block" />
                <span>Section 01 · Public Archive Overview</span>
              </div>
              <h1 className="font-serif-editorial text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.08] text-[#0f1210] dark:text-[#f3f0e9]">
                Investigative Dossiers, Verified Filings &amp; Evidentiary Records.
              </h1>
              <p className="text-sm sm:text-base text-[#4a514b] dark:text-[#a6aba7] leading-relaxed max-w-2xl">
                IMnexus publishes transparent case chronicles, institutional mapping, cryptographic SHA-256 document verification, and primary video/audio exhibits released for open public inspection.
              </p>
            </div>

            <div className="lg:col-span-4 space-y-3">
              <label className="block text-[10px] font-mono-tabular uppercase tracking-[0.12em] text-[#6a716b] dark:text-[#8d948e]">
                Filter Archive Index
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#ef4423] dark:text-[#ff6b3d] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search cases, exhibits, tags, filings…"
                  className="w-full pl-9 pr-3 py-2.5 min-h-[44px] text-sm bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] text-[#0f1210] dark:text-[#f3f0e9] placeholder-[#6a716b] dark:placeholder-[#8d948e] outline-none focus:border-[#ef4423]"
                />
              </div>
            </div>
          </div>

          {/* 4-Metric Architectural Archive Ledger */}
          <div className="grid grid-cols-2 lg:grid-cols-4 border border-[#ddd8ce] dark:border-[#262b27] bg-[#faf8f4] dark:bg-[#141715] divide-y sm:divide-y-0 sm:divide-x divide-[#ddd8ce] dark:divide-[#262b27]">
            {[
              {
                label: 'Published Cases',
                value: publishedCases.length,
                href: '#cases',
                icon: Scale,
              },
              {
                label: 'Evidence Exhibits',
                value: allEvidence.length,
                href: '#evidence',
                icon: Layers,
              },
              {
                label: 'Active Projects',
                value: publishedProjects.length,
                href: '#projects',
                icon: FolderKanban,
              },
              {
                label: 'Verified Documents',
                value: allDocuments.length,
                href: '#documents',
                icon: FileText,
              },
            ].map((metric) => {
              const Icon = metric.icon;
              return (
                <a
                  key={metric.label}
                  href={metric.href}
                  className="p-4 sm:p-5 hover:bg-[#f3f0e9] dark:hover:bg-[#1b1f1c] transition-colors flex flex-col justify-between gap-2 group"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono-tabular uppercase tracking-[0.12em] text-[#6a716b] dark:text-[#8d948e]">
                    <span>{metric.label}</span>
                    <Icon className="w-3.5 h-3.5 text-[#ef4423] dark:text-[#ff6b3d]" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="font-serif-editorial text-2xl sm:text-3xl font-semibold text-[#0f1210] dark:text-[#f3f0e9]">
                      {loading ? '—' : metric.value}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#6a716b] group-hover:text-[#ef4423] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        {/* SECTION 2: CASES */}
        <section id="cases" className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#ddd8ce] dark:border-[#262b27] pb-4">
            <div>
              <div className="font-mono-tabular text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ef4423] dark:text-[#ff6b3d] mb-1">
                Section 02 · Litigation &amp; Investigations
              </div>
              <h2 className="font-serif-editorial text-2xl sm:text-3xl font-semibold tracking-tight text-[#0f1210] dark:text-[#f3f0e9]">
                Published Cases
              </h2>
            </div>
            <span className="font-mono-tabular text-xs text-[#6a716b] dark:text-[#8d948e]">
              {publishedCases.length} dossier{publishedCases.length === 1 ? '' : 's'}
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-72 bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] animate-pulse"
                />
              ))}
            </div>
          ) : publishedCases.length === 0 ? (
            <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-8 sm:p-12 text-center">
              <Globe className="w-7 h-7 text-[#ef4423] dark:text-[#ff6b3d] mx-auto mb-3" />
              <h3 className="text-base font-semibold mb-1">No Published Cases Match</h3>
              <p className="text-xs text-[#6a716b] dark:text-[#9ca39d] max-w-md mx-auto">
                Published legal or investigative case dossiers will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Spotlight Lead Case Card */}
              {leadCase && (
                <button
                  type="button"
                  onClick={() => onOpenSite(leadCase.slug)}
                  className="w-full text-left group bg-[#faf8f4] dark:bg-[#141715] border border-[#ddd8ce] dark:border-[#262b27] hover:border-[#ef4423] dark:hover:border-[#ff6b3d] transition-colors grid grid-cols-1 lg:grid-cols-12 overflow-hidden cursor-pointer"
                >
                  <div className="lg:col-span-6 aspect-[16/10] lg:aspect-auto lg:min-h-[280px] bg-[#0c0e0c] relative overflow-hidden">
                    <VaultImage
                      src={leadCase.coverUrl || DEFAULT_PUBLIC_COVER}
                      alt={leadCase.headline || leadCase.title}
                      className="w-full h-full object-cover opacity-85 group-hover:scale-[1.02] transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 text-[10px] font-mono-tabular font-semibold uppercase tracking-[0.1em] bg-[#0f1210]/90 text-white border border-white/20">
                        Featured Dossier
                      </span>
                      <StatusLabel status={leadCase.status} variant="bright" />
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono-tabular text-white/90">
                      <span>CASE NO. {leadCase.caseNumber || leadCase.slug}</span>
                      <span>{leadCase.court || 'Public Dossier'}</span>
                    </div>
                  </div>

                  <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between gap-5">
                    <div className="space-y-3">
                      <div className="font-mono-tabular text-[11px] font-semibold uppercase tracking-[0.12em] text-[#ef4423] dark:text-[#ff6b3d]">
                        {leadCase.subtitle || leadCase.court || leadCase.caseType}
                      </div>
                      <h3 className="font-serif-editorial text-2xl sm:text-3xl font-semibold text-[#0f1210] dark:text-[#f3f0e9] leading-snug">
                        {leadCase.headline || leadCase.title}
                      </h3>
                      <p className="text-sm text-[#4a514b] dark:text-[#b4b9b5] leading-relaxed line-clamp-4">
                        {getSiteSummary(leadCase)}
                      </p>
                      {(leadCase.tags || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {leadCase.tags!.slice(0, 5).map((t) => (
                            <span
                              key={t}
                              className="text-[10px] font-mono-tabular px-2 py-0.5 border border-[#ddd8ce] dark:border-[#2a302b] text-[#4a514b] dark:text-[#9ca39d]"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-[#e9e5db] dark:border-[#222723] flex flex-wrap items-center justify-between gap-3">
                      <span className="font-mono-tabular text-[11px] text-[#6a716b] dark:text-[#8d948e]">
                        {leadCase.timeline?.length || 0} events ·{' '}
                        {(leadCase.documents?.length || 0) + (leadCase.evidence?.length || 0)}{' '}
                        records · {leadCase.collections?.length || 0} collections
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#ef4423] dark:text-[#ff6b3d]">
                        <span>Open Case Dossier</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </div>
                </button>
              )}

              {/* Additional Cases Grid */}
              {secondaryCases.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {secondaryCases.map((site) => {
                    const eventCount = site.timeline?.length || 0;
                    const recordCount =
                      (site.documents?.length || 0) + (site.evidence?.length || 0);
                    return (
                      <button
                        key={site.slug}
                        type="button"
                        onClick={() => onOpenSite(site.slug)}
                        className="group text-left bg-[#faf8f4] dark:bg-[#141715] border border-[#ddd8ce] dark:border-[#262b27] hover:border-[#ef4423] dark:hover:border-[#ff6b3d] transition-colors flex flex-col cursor-pointer"
                      >
                        <div className="aspect-[16/9] bg-[#111413] relative overflow-hidden border-b border-[#ddd8ce] dark:border-[#262b27]">
                          <VaultImage
                            src={site.coverUrl || DEFAULT_PUBLIC_COVER}
                            alt={site.headline || site.title}
                            className="w-full h-full object-cover opacity-90 group-hover:scale-[1.03] transition-transform duration-300"
                          />
                          <div className="absolute top-2.5 right-2.5">
                            <StatusLabel status={site.status} variant="bright" />
                          </div>
                        </div>
                        <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                          <div>
                            <div className="font-mono-tabular text-[11px] font-medium text-[#6a716b] dark:text-[#8d948e] mb-1.5">
                              Case No. {site.caseNumber || site.slug}
                            </div>
                            <h3 className="font-serif-editorial text-lg font-semibold text-[#0f1210] dark:text-[#f3f0e9] mb-1 line-clamp-2 leading-snug">
                              {site.headline || site.title}
                            </h3>
                            <p className="text-[11px] font-semibold text-[#ef4423] dark:text-[#ff6b3d] mb-2 line-clamp-1">
                              {site.subtitle || site.court || site.caseType}
                            </p>
                            <p className="text-xs text-[#4a514b] dark:text-[#a6aba7] leading-relaxed line-clamp-3">
                              {getSiteSummary(site)}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-[#e9e5db] dark:border-[#222723] flex items-center justify-between text-xs font-semibold text-[#ef4423] dark:text-[#ff6b3d]">
                            <span className="font-mono-tabular text-[10px] text-[#6a716b] dark:text-[#8d948e]">
                              {eventCount} events · {recordCount} records
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>

        {/* SECTION 3: CROSS-CASE NEXUS, KUMU SYSTEMIC & STRATIGRAPHIC MAPPING */}
        <section id="nexus" className="space-y-6 pt-4 border-t border-[#ddd8ce] dark:border-[#262b27]">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#ddd8ce] dark:border-[#262b27] pb-4">
            <div>
              <div className="font-mono-tabular text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ef4423] dark:text-[#ff6b3d] mb-1">
                Section 03 · Cross-Case Systemic Mapping &amp; Stratigraphy
              </div>
              <h2 className="font-serif-editorial text-2xl sm:text-3xl font-semibold tracking-tight text-[#0f1210] dark:text-[#f3f0e9]">
                Nexus Connections, Kumu Diagram &amp; Procedural Strata
              </h2>
              <p className="text-xs sm:text-sm text-[#4a514b] dark:text-[#a6aba7] mt-1 max-w-3xl">
                Select any combination of published cases below to map shared institutional actors, systemic #tags, Kumu causal clusters, and a chronological stratigraphic stack of Procedural &amp; Institutional Analysis (earliest case at bottom to most recent at top).
              </p>
            </div>
            <span className="font-mono-tabular text-xs text-[#6a716b] dark:text-[#8d948e]">
              {selectedSlugs.length} of {sites.length} mapped
            </span>
          </div>

          {loading ? (
            <div className="h-72 bg-[#faf8f4] dark:bg-[#141715] border border-[#ddd8ce] dark:border-[#262b27] animate-pulse" />
          ) : sites.length === 0 ? (
            <div className="bg-[#faf8f4] dark:bg-[#141715] border border-[#ddd8ce] dark:border-[#262b27] p-8 text-center text-xs text-[#6a716b] dark:text-[#8d948e]">
              Publish one or more case dossiers to activate the Cross-Case Nexus, Kumu Systemic Diagram, and Stratigraphic Map.
            </div>
          ) : (
            <NexusMapView
              graph={publicNexusGraph}
              accentVariant="ember"
              defaultViewMode="kumu"
              subtitle="Switch between Systemic Map (Kumu), Relationship Web, Procedural Stratigraphic Map, X×Y Axis Matrix, and Chronology Axis."
              selectableCases={selectableCases}
              selectedCaseIds={selectedSlugs}
              onToggleCaseId={toggleNexusSlug}
              onSelectAllCases={() => setSelectedSlugs(sites.map((s) => s.slug))}
              onClearCases={() => setSelectedSlugs([])}
              stratigraphicData={publicStratigraphicData}
              onSelectCaseId={(slug) => onOpenSite(slug)}
              onOpenStratumCase={(stratum) => {
                if (stratum.slug) onOpenSite(stratum.slug);
              }}
              onInspectNodeArtifact={(node) => {
                const match = allEvidence.find(
                  (ev) => ev.id === node.refId || ev.title === (node.fullLabel || node.label)
                );
                if (match) {
                  setPreviewArtifact(match);
                } else {
                  setPreviewArtifact({
                    id: node.id,
                    title: node.fullLabel || node.label,
                    mediaType: (node.mediaType as MediaType) || 'file',
                    fileId: node.fileId,
                    fileName: node.fileName,
                    sha256: node.sha256,
                    textContent: node.textContent,
                    embedUrl: node.embedUrl,
                    description: node.description,
                    tags: [],
                    siteSlug: sites[0]?.slug || '',
                    siteTitle: 'Public Archive',
                  });
                }
              }}
            />
          )}
        </section>

        {/* SECTION 4: EVIDENCE */}
        <section id="evidence" className="space-y-6 pt-4 border-t border-[#ddd8ce] dark:border-[#262b27]">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#ddd8ce] dark:border-[#262b27] pb-4">
            <div>
              <div className="font-mono-tabular text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ef4423] dark:text-[#ff6b3d] mb-1">
                Section 04 · Primary Exhibits &amp; Media
              </div>
              <h2 className="font-serif-editorial text-2xl sm:text-3xl font-semibold tracking-tight text-[#0f1210] dark:text-[#f3f0e9]">
                Public Evidence &amp; Video Exhibits
              </h2>
            </div>
            <span className="font-mono-tabular text-xs text-[#6a716b] dark:text-[#8d948e]">
              {allEvidence.length} exhibit{allEvidence.length === 1 ? '' : 's'}
            </span>
          </div>

          {allEvidence.length === 0 ? (
            <div className="bg-[#faf8f4] dark:bg-[#141715] border border-[#ddd8ce] dark:border-[#262b27] p-8 text-center text-xs text-[#6a716b] dark:text-[#8d948e]">
              No public evidence items or video embeds have been published yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {allEvidence.map((item) => {
                const parsedEmbed = item.embedUrl ? parseVideoEmbed(item.embedUrl) : null;
                return (
                  <div
                    key={`${item.siteSlug}-${item.id}`}
                    className="bg-[#faf8f4] dark:bg-[#141715] border border-[#ddd8ce] dark:border-[#262b27] hover:border-[#ef4423] dark:hover:border-[#ff6b3d] transition-colors flex flex-col overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewArtifact(item)}
                      className="aspect-[16/10] bg-[#111413] border-b border-[#ddd8ce] dark:border-[#262b27] relative flex items-center justify-center overflow-hidden text-left cursor-pointer group"
                    >
                      {item.mediaType === 'image' && item.fileId ? (
                        <VaultImage
                          src={item.fileId}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                        />
                      ) : parsedEmbed?.thumbnailUrl ? (
                        <>
                          <img
                            src={parsedEmbed.thumbnailUrl}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover opacity-85"
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider bg-[#ef4423] text-white">
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Play Video</span>
                            </span>
                          </div>
                        </>
                      ) : item.mediaType === 'video' ? (
                        <div className="flex flex-col items-center gap-2 text-white/85">
                          <span className="w-11 h-11 flex items-center justify-center bg-[#ef4423] text-white">
                            <Film className="w-5 h-5" />
                          </span>
                          <span className="font-mono-tabular text-[11px] uppercase tracking-wider">
                            {parsedEmbed ? `${parsedEmbed.provider} Embed` : 'Video Exhibit'}
                          </span>
                        </div>
                      ) : item.mediaType === 'audio' ? (
                        <div className="flex flex-col items-center gap-1.5 text-[#c4bfb4]">
                          <Music className="w-7 h-7 text-[#ff6b3d]" />
                          <span className="font-mono-tabular text-[11px] uppercase">Audio Record</span>
                        </div>
                      ) : item.mediaType === 'text' ? (
                        <div className="p-4 text-xs text-[#d8d3c8] line-clamp-5 self-start w-full">
                          {item.textContent || item.description}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-[#c4bfb4]">
                          <FileText className="w-7 h-7 text-[#ff6b3d]" />
                          <span className="font-mono-tabular text-[11px] uppercase">
                            {item.mediaType}
                          </span>
                        </div>
                      )}
                      <span className="absolute top-2 left-2 px-1.5 py-0.5 text-[10px] font-mono-tabular uppercase bg-black/75 text-white">
                        {item.embedUrl ? 'Video Embed' : item.mediaType}
                      </span>
                    </button>

                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div>
                        <div className="font-mono-tabular text-[10px] uppercase tracking-wider text-[#ef4423] dark:text-[#ff6b3d] mb-1 truncate">
                          {item.caseNumber ? `Case ${item.caseNumber}` : item.siteTitle}
                        </div>
                        <h3 className="text-sm font-semibold text-[#0f1210] dark:text-[#f3f0e9] line-clamp-2">
                          {item.title}
                        </h3>
                        {item.description && (
                          <p className="text-xs text-[#6a716b] dark:text-[#9ca39d] mt-1 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-2.5 border-t border-[#e9e5db] dark:border-[#222723] flex items-center justify-between gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setPreviewArtifact(item)}
                          className="font-semibold text-[#ef4423] dark:text-[#ff6b3d] hover:underline cursor-pointer"
                        >
                          {item.embedUrl || item.mediaType === 'video' ? 'Watch Exhibit' : 'Inspect Exhibit'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenSite(item.siteSlug)}
                          className="font-mono-tabular text-[11px] text-[#6a716b] dark:text-[#8d948e] hover:text-[#0f1210] dark:hover:text-[#f3f0e9] truncate cursor-pointer"
                        >
                          View Dossier →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SECTION 5: PROJECTS */}
        <section id="projects" className="space-y-6 pt-4 border-t border-[#ddd8ce] dark:border-[#262b27]">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#ddd8ce] dark:border-[#262b27] pb-4">
            <div>
              <div className="font-mono-tabular text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ef4423] dark:text-[#ff6b3d] mb-1">
                Section 05 · Research &amp; Public Initiatives
              </div>
              <h2 className="font-serif-editorial text-2xl sm:text-3xl font-semibold tracking-tight text-[#0f1210] dark:text-[#f3f0e9]">
                Published Projects
              </h2>
            </div>
            <span className="font-mono-tabular text-xs text-[#6a716b] dark:text-[#8d948e]">
              {publishedProjects.length} project{publishedProjects.length === 1 ? '' : 's'}
            </span>
          </div>

          {publishedProjects.length === 0 ? (
            <div className="bg-[#faf8f4] dark:bg-[#141715] border border-[#ddd8ce] dark:border-[#262b27] p-8 text-center text-xs text-[#6a716b] dark:text-[#8d948e]">
              No standalone research projects are currently published. Dossiers classified as &ldquo;project&rdquo; will appear here.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {publishedProjects.map((proj) => (
                <button
                  key={proj.slug}
                  type="button"
                  onClick={() => onOpenSite(proj.slug)}
                  className="group text-left bg-[#faf8f4] dark:bg-[#141715] border border-[#ddd8ce] dark:border-[#262b27] hover:border-[#ef4423] dark:hover:border-[#ff6b3d] transition-colors flex flex-col sm:flex-row overflow-hidden cursor-pointer"
                >
                  <div className="sm:w-48 aspect-[16/10] sm:aspect-auto bg-[#111413] relative overflow-hidden shrink-0">
                    <VaultImage
                      src={proj.coverUrl || DEFAULT_PUBLIC_COVER}
                      alt={proj.headline || proj.title}
                      className="w-full h-full object-cover opacity-85 group-hover:scale-[1.03] transition-transform duration-300"
                    />
                    <div className="absolute top-2.5 left-2.5">
                      <StatusLabel status={proj.status} variant="bright" />
                    </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <div className="font-mono-tabular text-[11px] font-semibold uppercase tracking-wider text-[#ef4423] dark:text-[#ff6b3d] mb-1">
                        {proj.caseNumber || 'PROJECT'} · {proj.court || 'Initiative'}
                      </div>
                      <h3 className="font-serif-editorial text-xl font-semibold text-[#0f1210] dark:text-[#f3f0e9] mb-1.5 leading-snug">
                        {proj.headline || proj.title}
                      </h3>
                      <p className="text-xs text-[#4a514b] dark:text-[#a6aba7] leading-relaxed line-clamp-3">
                        {getSiteSummary(proj)}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-[#e9e5db] dark:border-[#222723] flex items-center justify-between text-xs font-semibold text-[#ef4423] dark:text-[#ff6b3d]">
                      <span className="font-mono-tabular">/site/{proj.slug}</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 6: DOCUMENTS */}
        <section id="documents" className="space-y-6 pt-4 border-t border-[#ddd8ce] dark:border-[#262b27]">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#ddd8ce] dark:border-[#262b27] pb-4">
            <div>
              <div className="font-mono-tabular text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ef4423] dark:text-[#ff6b3d] mb-1">
                Section 06 · Authenticated Filings
              </div>
              <h2 className="font-serif-editorial text-2xl sm:text-3xl font-semibold tracking-tight text-[#0f1210] dark:text-[#f3f0e9]">
                Verified Public Documents
              </h2>
            </div>
            <span className="font-mono-tabular text-xs text-[#6a716b] dark:text-[#8d948e]">
              {allDocuments.length} document{allDocuments.length === 1 ? '' : 's'}
            </span>
          </div>

          {allDocuments.length === 0 ? (
            <div className="bg-[#faf8f4] dark:bg-[#141715] border border-[#ddd8ce] dark:border-[#262b27] p-8 text-center text-xs text-[#6a716b] dark:text-[#8d948e]">
              No public filings or documents are currently indexed.
            </div>
          ) : (
            <>
              {/* Mobile Stacked Document Cards */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {allDocuments.map((docItem) => (
                  <div
                    key={`${docItem.siteSlug}-${docItem.id}`}
                    className="bg-[#faf8f4] dark:bg-[#141715] border border-[#ddd8ce] dark:border-[#262b27] p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono-tabular text-[10px] uppercase tracking-wider text-[#ef4423] dark:text-[#ff6b3d]">
                        {docItem.docType} · {docItem.caseNumber || docItem.siteTitle}
                      </span>
                      <span className="font-mono-tabular text-[10px] text-[#6a716b] dark:text-[#8d948e]">
                        {docItem.fileSize ? formatBytes(docItem.fileSize) : 'Record'}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-[#0f1210] dark:text-[#f3f0e9]">
                      {docItem.title}
                    </div>
                    {docItem.sha256 && (
                      <div className="font-mono-tabular text-[10px] text-[#6a716b] dark:text-[#8d948e] truncate">
                        SHA-256: {docItem.sha256}
                      </div>
                    )}
                    <div className="pt-2 border-t border-[#e9e5db] dark:border-[#222723] flex items-center justify-between">
                      {docItem.fileId ? (
                        <button
                          type="button"
                          onClick={() => setPreviewArtifact(docItem)}
                          className="inline-flex items-center gap-1.5 min-h-[36px] text-xs font-semibold text-[#ef4423] dark:text-[#ff6b3d] cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Inspect Document</span>
                        </button>
                      ) : (
                        <span className="text-xs text-[#6a716b]">Record entry</span>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenSite(docItem.siteSlug)}
                        className="text-xs font-mono-tabular text-[#6a716b] dark:text-[#8d948e] underline cursor-pointer"
                      >
                        Dossier
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Ledger Table */}
              <div className="hidden md:block bg-[#faf8f4] dark:bg-[#141715] border border-[#ddd8ce] dark:border-[#262b27] overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9]/70 dark:bg-[#111413] text-[11px] font-mono-tabular font-medium uppercase tracking-wider text-[#6a716b] dark:text-[#8d948e]">
                      <th className="py-3 px-4">Document Title</th>
                      <th className="py-3 px-4">Source Case / Project</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">SHA-256 Digest</th>
                      <th className="py-3 px-4 text-right">Access</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e9e5db] dark:divide-[#222723]">
                    {allDocuments.map((docItem) => (
                      <tr
                        key={`${docItem.siteSlug}-${docItem.id}`}
                        className="hover:bg-[#f3f0e9]/60 dark:hover:bg-[#1c201c]"
                      >
                        <td className="py-3.5 px-4 font-medium text-[#0f1210] dark:text-[#f3f0e9]">
                          {docItem.title}
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          <button
                            type="button"
                            onClick={() => onOpenSite(docItem.siteSlug)}
                            className="font-mono-tabular text-[#4a514b] dark:text-[#9ca39d] hover:text-[#ef4423] dark:hover:text-[#ff6b3d] hover:underline cursor-pointer"
                          >
                            {docItem.caseNumber || docItem.siteTitle}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[#6a716b] dark:text-[#9ca39d]">
                          {docItem.docType}
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular text-xs text-[#6a716b] dark:text-[#8d948e]">
                          {docItem.sha256 ? `${docItem.sha256.slice(0, 14)}…` : 'Verified'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {docItem.fileId ? (
                            <button
                              type="button"
                              onClick={() => setPreviewArtifact(docItem)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#ef4423] dark:text-[#ff6b3d] hover:underline cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Inspect</span>
                            </button>
                          ) : (
                            <span className="text-xs text-[#6a716b]">Record only</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* SECTION 6: MESSAGE OR TIP SUBMISSION */}
        <div className="pt-4">
          <div className="flex items-center gap-2 font-mono-tabular text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ef4423] dark:text-[#ff6b3d] mb-3">
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>Section 06 · Direct Contact &amp; Whistleblower Tip Line</span>
          </div>
          <PublicTipBox contextLabel="IMnexus Public Archive Directory" />
        </div>
      </main>

      <footer className="border-t border-[#ddd8ce] dark:border-[#262b27] py-8 mt-16 bg-[#faf8f4] dark:bg-[#111413]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6a716b] dark:text-[#9ca39d]">
          <div className="flex items-center gap-2">
            <BrandMark className="text-[#0f1210] dark:text-[#f3f0e9]" />
            <span aria-hidden="true">·</span>
            <span>Public Dossier Archive</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#ef4423] dark:text-[#ff6b3d]" />
            <span>SHA-256 Verified Archival Publication</span>
          </div>
        </div>
      </footer>

      {/* Public Exhibit / Document Lightbox Modal */}
      {previewArtifact && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-[#ddd8ce] dark:border-[#262b27] flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[11px] font-mono-tabular font-semibold uppercase text-[#ef4423] dark:text-[#ff6b3d] truncate">
                  {previewArtifact.embedUrl ? 'Video Embed' : `${previewArtifact.mediaType} Exhibit`} ·{' '}
                  {previewArtifact.caseNumber || previewArtifact.siteTitle}
                </div>
                <h3 className="text-base font-semibold truncate text-[#0f1210] dark:text-[#f3f0e9]">
                  {previewArtifact.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewArtifact(null)}
                className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center border border-transparent hover:border-[#ddd8ce] dark:hover:border-[#262b27] text-[#6a716b] hover:text-[#0f1210] dark:hover:text-[#f3f0e9] cursor-pointer"
                aria-label="Close preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-auto flex-1 space-y-4">
              <ArchiveLightboxStage item={previewArtifact} />
              {previewArtifact.textContent && (
                <div className="p-4 bg-[#f3f0e9] dark:bg-[#111413] border border-[#ddd8ce] dark:border-[#262b27] text-sm leading-relaxed whitespace-pre-line font-serif-editorial text-[#0f1210] dark:text-[#f3f0e9]">
                  {previewArtifact.textContent}
                </div>
              )}
              {previewArtifact.description && (
                <p className="text-sm text-[#2b302c] dark:text-[#c4bfb4] leading-relaxed">
                  {previewArtifact.description}
                </p>
              )}
              <div className="pt-3 border-t border-[#e9e5db] dark:border-[#222723] flex flex-wrap items-center justify-between gap-3 text-xs text-[#6a716b] dark:text-[#9ca39d]">
                <button
                  type="button"
                  onClick={() => {
                    const targetSlug = previewArtifact.siteSlug;
                    setPreviewArtifact(null);
                    onOpenSite(targetSlug);
                  }}
                  className="font-semibold text-[#ef4423] dark:text-[#ff6b3d] hover:underline cursor-pointer"
                >
                  Open Source Dossier ({previewArtifact.siteTitle}) →
                </button>
                {previewArtifact.fileId && (
                  <VaultDownloadLink
                    fileId={previewArtifact.fileId}
                    fileName={previewArtifact.fileName || previewArtifact.title}
                    className="inline-flex items-center gap-1.5 font-semibold text-[#ef4423] dark:text-[#ff6b3d] hover:underline cursor-pointer"
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
