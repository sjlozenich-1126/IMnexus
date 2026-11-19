import React, { useEffect, useState } from 'react';
import { ArrowRight, Globe, Moon, Search, Sun } from 'lucide-react';
import type { PublicSite } from '../types';
import { fetchAllPublishedSites } from '../services/firestoreService';
import { BrandMark, StatusLabel } from './BrandMark';
import { VaultImage } from './VaultMedia';

interface PublicArchiveDirectoryProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenSite: (slug: string) => void;
  onNavigateConsole: () => void;
  isAuthenticated: boolean;
}

const DEFAULT_PUBLIC_COVER = '/assets/aistudio/kanhaiya-sharma-EiAqej-cGks-unsplash_c5de0270.jpg';

function getSiteSummary(site: PublicSite): string {
  const intro = site.intro?.trim();
  if (intro) return intro;
  const firstSection = site.sections?.find((s) => s.content?.trim())?.content?.trim();
  if (firstSection) return firstSection;
  const jurisdiction = site.court || site.caseType || 'Public Dossier';
  const disposition = site.disposition ? ` — ${site.disposition}` : '';
  return `${jurisdiction} archival dossier${disposition}. Includes chronological filings, actor directory, verified records, and cross-referenced exhibits.`;
}

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

  useEffect(() => {
    let mounted = true;
    fetchAllPublishedSites()
      .then((res) => {
        if (mounted) setSites(res);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = sites.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      s.title.toLowerCase().includes(q) ||
      (s.caseNumber || '').toLowerCase().includes(q) ||
      (s.court || '').toLowerCase().includes(q) ||
      (s.headline || '').toLowerCase().includes(q) ||
      (s.intro || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#f3f0e9] dark:bg-[#0c0e0c] text-[#0f1210] dark:text-[#f3f0e9]">
      <header className="bg-[#faf8f4] dark:bg-[#111413] border-b border-[#ddd8ce] dark:border-[#262b27]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[54px] flex items-center justify-between gap-6">
          <div className="text-[15px] text-[#0f1210] dark:text-[#f3f0e9] whitespace-nowrap shrink-0">
            <BrandMark />
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[#ddd8ce] dark:border-[#262b27] text-xs font-medium text-[#6a716b] dark:text-[#9ca39d] hover:text-[#0f1210] dark:hover:text-[#f3f0e9] hover:border-[#0f1210] dark:hover:border-[#8d948e] transition-colors cursor-pointer whitespace-nowrap"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{darkMode ? 'Light' : 'Dark'}</span>
            </button>

            <button
              type="button"
              onClick={onNavigateConsole}
              className="px-3.5 py-1.5 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] hover:bg-[#1a2e24] dark:hover:bg-[#e9e5db] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isAuthenticated ? 'Return to Console' : 'Sign in to Console'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="max-w-2xl mb-10">
          <div className="font-mono-tabular text-[11px] font-medium uppercase tracking-[0.14em] text-[#2d5a3d] dark:text-[#7fb892] mb-2">
            Public Dossier Index
          </div>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl font-semibold tracking-tight mb-3 text-[#0f1210] dark:text-[#f3f0e9]">
            IMnexus Public Archive
          </h1>
          <p className="text-sm text-[#6a716b] dark:text-[#9ca39d] leading-relaxed">
            Published case dossiers, procedural timelines, verified public filings, curated evidentiary collections, and cross-referenced Nexus maps released for public inspection.
          </p>
        </div>

        <div className="relative max-w-md mb-8">
          <Search className="w-4 h-4 text-[#6a716b] dark:text-[#8d948e] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter published cases by title, number, court, or summary..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] text-[#0f1210] dark:text-[#f3f0e9] placeholder-[#6a716b] dark:placeholder-[#8d948e] outline-none focus:border-[#0f1210] dark:focus:border-[#7fb892]"
          />
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
        ) : filtered.length === 0 ? (
          <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-12 text-center">
            <Globe className="w-8 h-8 text-[#6a716b] dark:text-[#8d948e] mx-auto mb-3" />
            <h2 className="text-base font-semibold mb-1 text-[#0f1210] dark:text-[#f3f0e9]">
              No Published Sites Found
            </h2>
            <p className="text-sm text-[#6a716b] dark:text-[#9ca39d] max-w-md mx-auto">
              Case owners can publish any case or project dossier from the IMnexus Console to generate a dedicated public archive URL.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((site) => {
              const eventCount = site.timeline?.length || 0;
              const recordCount = (site.documents?.length || 0) + (site.evidence?.length || 0);
              const collectionCount = site.collections?.length || 0;
              const summaryText = getSiteSummary(site);

              return (
                <button
                  key={site.slug}
                  type="button"
                  onClick={() => onOpenSite(site.slug)}
                  className="group text-left bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] hover:border-[#0f1210] dark:hover:border-[#8d948e] transition-colors flex flex-col cursor-pointer"
                >
                  <div className="aspect-[16/9] bg-[#111413] relative overflow-hidden border-b border-[#ddd8ce] dark:border-[#262b27]">
                    <VaultImage
                      src={site.coverUrl || DEFAULT_PUBLIC_COVER}
                      alt={site.headline || site.title}
                      className="w-full h-full object-cover opacity-90 group-hover:scale-[1.02] transition-transform duration-300"
                    />
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className="font-mono-tabular text-[11px] font-medium text-[#6a716b] dark:text-[#8d948e]">
                          {site.caseNumber || site.slug}
                        </span>
                        <StatusLabel status={site.status} />
                      </div>
                      <h3 className="font-serif-editorial text-lg font-semibold text-[#0f1210] dark:text-[#f3f0e9] mb-1 line-clamp-2 leading-snug">
                        {site.headline || site.title}
                      </h3>
                      <p className="text-[11px] font-medium text-[#2d5a3d] dark:text-[#7fb892] mb-2.5 line-clamp-1">
                        {site.subtitle || site.court || site.caseType || 'Published dossier'}
                      </p>
                      <p className="text-xs text-[#6a716b] dark:text-[#9ca39d] leading-relaxed line-clamp-3">
                        {summaryText}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#e9e5db] dark:border-[#222723] space-y-2">
                      <div className="font-mono-tabular text-[10px] text-[#6a716b] dark:text-[#8d948e] uppercase tracking-wider">
                        {eventCount} events · {recordCount} records · {collectionCount} collections
                      </div>
                      <div className="flex items-center justify-between text-xs font-medium text-[#1a2e24] dark:text-[#7fb892]">
                        <span className="font-mono-tabular">/site/{site.slug}</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
