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
      (s.headline || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] text-zinc-950 dark:text-zinc-100">
      <header className="bg-white dark:bg-[#0f1014] border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          <div className="text-base text-zinc-950 dark:text-white whitespace-nowrap shrink-0">
            <BrandMark />
          </div>

          <div className="hidden sm:flex items-center gap-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="inline-flex items-center gap-1.5 hover:text-zinc-950 dark:hover:text-white cursor-pointer whitespace-nowrap"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{darkMode ? 'Light' : 'Dark'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onNavigateConsole}
            className="px-3.5 py-2 text-xs font-semibold rounded-md bg-[#3061d0] text-white hover:bg-[#2752b4] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isAuthenticated ? 'Return to Console' : 'Sign in to Console'}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="max-w-2xl mb-10">
          <div className="text-xs font-semibold uppercase tracking-widest text-[#3061d0] dark:text-blue-400 mb-2">
            Public Dossier Index
          </div>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl font-semibold tracking-tight mb-3">
            IMnexus Public Archive
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Published case dossiers, procedural timelines, verified public filings, and curated evidentiary collections released for public inspection.
          </p>
        </div>

        <div className="relative max-w-md mb-8">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter published cases by title, case number, or court..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-md outline-none focus:border-[#3061d0]"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-64 rounded-lg bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-12 text-center">
            <Globe className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
            <h2 className="text-base font-bold mb-1">No Published Sites Found</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              Case owners can publish any case or project dossier from the IMnexus Console to generate a dedicated public archive URL.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((site) => (
              <button
                key={site.slug}
                type="button"
                onClick={() => onOpenSite(site.slug)}
                className="text-left bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden hover:border-[#3061d0] transition-colors flex flex-col cursor-pointer"
              >
                <div className="aspect-[16/9] bg-zinc-900 relative overflow-hidden">
                  <VaultImage
                    src={
                      site.coverUrl ||
                      '/assets/aistudio/maxim-berg-fKPZGJI4dXU-unsplash_b5b78643.jpg'
                    }
                    alt={site.headline || site.title}
                    className="w-full h-full object-cover opacity-85"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono-tabular text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        {site.caseNumber || site.slug}
                      </span>
                      <StatusLabel status={site.status} />
                    </div>
                    <h3 className="text-base font-bold text-zinc-950 dark:text-white mb-1.5 line-clamp-2">
                      {site.headline || site.title}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      {site.subtitle || site.court || 'Published dossier'}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-[#3061d0] dark:text-blue-400">
                    <span>/site/{site.slug}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
