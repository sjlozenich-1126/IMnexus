import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { signOut, type User } from 'firebase/auth';
import {
  BarChart3,
  ExternalLink,
  FileText,
  FolderKanban,
  Globe,
  HardDrive,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Network,
  Plus,
  Search,
  Shield,
  Sun,
  X,
} from 'lucide-react';
import { auth } from '../firebase';
import {
  claimInvitedCaseMembership,
  createCaseRecord,
  fetchSectionsForCases,
  subscribeActivityLogs,
  subscribeCases,
  subscribeCollections,
  subscribeVaultItems,
  subscribeWorkspaceUsers,
} from '../services/firestoreService';
import type {
  ActivityLog,
  CaseRecord,
  CaseSection,
  CaseStatus,
  CaseType,
  EvidenceCollection,
  UserProfile,
  VaultItem,
} from '../types';
import { exportCasesPortfolioCsv } from '../utils/exportReports';
import {
  buildPortfolioNexus,
  buildStratigraphicMap,
  type StratigraphicCaseInput,
} from '../utils/nexusEngine';
import { AccessRolesView } from './AccessRolesView';
import { BrandMark, StatusLabel } from './BrandMark';
import { CaseWorkspace } from './CaseWorkspace';
import { NexusMapView, type SelectableNexusCase } from './NexusMapView';
import { ReportsAnalyticsView } from './ReportsAnalyticsView';
import { VaultAndEvidenceView } from './VaultAndEvidenceView';

export type ConsoleView =
  | 'dashboard'
  | 'cases'
  | 'projects'
  | 'case_detail'
  | 'documents'
  | 'evidence'
  | 'nexus'
  | 'reports'
  | 'roles';

interface ConsoleAppProps {
  firebaseUser: User;
  userProfile: UserProfile;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenPublicSite: (slug: string) => void;
  onOpenPublicArchive: () => void;
}

export const ConsoleApp: React.FC<ConsoleAppProps> = ({
  firebaseUser,
  userProfile,
  darkMode,
  onToggleDarkMode,
  onOpenPublicSite,
  onOpenPublicArchive,
}) => {
  const [view, setView] = useState<ConsoleView>('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [liveCaseDrafts, setLiveCaseDrafts] = useState<Record<string, Partial<CaseRecord>>>({});
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [collections, setCollections] = useState<EvidenceCollection[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [workspaceUsers, setWorkspaceUsers] = useState<UserProfile[]>([]);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [selectedNexusCaseIds, setSelectedNexusCaseIds] = useState<string[] | null>(null);
  const [caseSectionsMap, setCaseSectionsMap] = useState<Record<string, CaseSection[]>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // Create Case Modal
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [newCaseNumber, setNewCaseNumber] = useState('');
  const [newCaseTitle, setNewCaseTitle] = useState('');
  const [newCaseType, setNewCaseType] = useState<CaseType>('legal');
  const [newCaseCourt, setNewCaseCourt] = useState('');
  const [newCaseJudge, setNewCaseJudge] = useState('');
  const [newCaseCharge, setNewCaseCharge] = useState('');
  const [newCaseStatus, setNewCaseStatus] = useState<CaseStatus>('Active');
  const [newCaseSummary, setNewCaseSummary] = useState('');
  const [withTemplate, setWithTemplate] = useState(true);
  const [creatingCase, setCreatingCase] = useState(false);

  const canCreate = userProfile.role === 'admin' || userProfile.role === 'editor';

  useEffect(() => {
    void firebaseUser.getIdToken().then(setIdToken);
  }, [firebaseUser]);

  useEffect(() => {
    const unsubCases = subscribeCases(firebaseUser, userProfile.role, (list) => {
      setCases(list);
      list.forEach((c) => {
        if (
          firebaseUser.email &&
          c.invitedEmails.includes(firebaseUser.email.toLowerCase()) &&
          !c.memberUids.includes(firebaseUser.uid)
        ) {
          void claimInvitedCaseMembership(c, firebaseUser.uid);
        }
      });
    });
    const unsubVault = subscribeVaultItems(firebaseUser, userProfile.role, setVaultItems);
    const unsubCols = subscribeCollections(firebaseUser, userProfile.role, setCollections);
    const unsubLogs = subscribeActivityLogs(firebaseUser, userProfile.role, setActivityLogs);
    const unsubUsers = subscribeWorkspaceUsers(
      userProfile.role === 'admin',
      setWorkspaceUsers
    );

    return () => {
      unsubCases();
      unsubVault();
      unsubCols();
      unsubLogs();
      unsubUsers();
    };
  }, [firebaseUser, userProfile.role]);

  const handleLiveCaseDraftChange = useCallback(
    (caseId: string, draft: Partial<CaseRecord>) => {
      setLiveCaseDrafts((prev) => ({ ...prev, [caseId]: draft }));
    },
    []
  );

  const handleClearLiveCaseDraft = useCallback((caseId: string) => {
    setLiveCaseDrafts((prev) => {
      if (!(caseId in prev)) return prev;
      const next = { ...prev };
      delete next[caseId];
      return next;
    });
  }, []);

  const effectiveCases = useMemo(
    () =>
      cases.map((c) => (liveCaseDrafts[c.id] ? { ...c, ...liveCaseDrafts[c.id] } : c)),
    [cases, liveCaseDrafts]
  );

  const docCount = useMemo(
    () => vaultItems.filter((v) => v.category === 'document').length,
    [vaultItems]
  );
  const evidenceCount = useMemo(
    () => vaultItems.filter((v) => v.category === 'evidence').length,
    [vaultItems]
  );
  const projectCount = useMemo(
    () => effectiveCases.filter((c) => c.caseType === 'project').length,
    [effectiveCases]
  );
  const publicItemsCount = useMemo(
    () =>
      vaultItems.filter((v) => v.isPublic).length +
      effectiveCases.filter((c) => c.isPublished).length,
    [vaultItems, effectiveCases]
  );

  useEffect(() => {
    if (view !== 'nexus' || effectiveCases.length === 0) return;
    let mounted = true;
    const missingIds = effectiveCases
      .map((c) => c.id)
      .filter((id) => !(id in caseSectionsMap));
    if (missingIds.length === 0) return;
    fetchSectionsForCases(missingIds).then((loaded) => {
      if (mounted) {
        setCaseSectionsMap((prev) => ({ ...prev, ...loaded }));
      }
    });
    return () => {
      mounted = false;
    };
  }, [view, effectiveCases, caseSectionsMap]);

  const effectiveNexusCaseIds = useMemo(
    () =>
      selectedNexusCaseIds === null
        ? effectiveCases.map((c) => c.id)
        : selectedNexusCaseIds.filter((id) => effectiveCases.some((c) => c.id === id)),
    [selectedNexusCaseIds, effectiveCases]
  );

  const selectableNexusCases = useMemo<SelectableNexusCase[]>(
    () =>
      effectiveCases.map((c) => ({
        id: c.id,
        caseNumber: c.caseNumber,
        title: c.title,
        status: c.status,
        caseType: c.caseType,
      })),
    [effectiveCases]
  );

  const portfolioNexusGraph = useMemo(
    () =>
      buildPortfolioNexus({
        cases: effectiveCases,
        vaultItems,
        collections,
        selectedCaseIds: effectiveNexusCaseIds,
      }),
    [effectiveCases, vaultItems, collections, effectiveNexusCaseIds]
  );

  const consoleStratigraphicData = useMemo(() => {
    const inputs: StratigraphicCaseInput[] = effectiveCases
      .filter((c) => effectiveNexusCaseIds.includes(c.id))
      .map((c) => {
        const createdMs =
          c.createdAt && typeof c.createdAt === 'object' && 'toMillis' in c.createdAt
            ? (c.createdAt as { toMillis: () => number }).toMillis()
            : undefined;
        return {
          id: c.id,
          slug: c.publicSlug,
          caseNumber: c.caseNumber,
          title: c.title,
          status: c.status,
          court: c.court,
          arrestDates: c.arrestDates,
          closureDate: c.closureDate,
          createdAtMs: createdMs,
          tags: c.tags,
          sections: caseSectionsMap[c.id] || [],
        };
      });
    return buildStratigraphicMap(inputs);
  }, [effectiveCases, effectiveNexusCaseIds, caseSectionsMap]);

  const selectedCase = useMemo(
    () => effectiveCases.find((c) => c.id === selectedCaseId) || null,
    [effectiveCases, selectedCaseId]
  );

  const globalSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { cases: [], vault: [], collections: [] };
    return {
      cases: effectiveCases
        .filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            c.caseNumber.toLowerCase().includes(q) ||
            (c.court || '').toLowerCase().includes(q) ||
            (c.judge || '').toLowerCase().includes(q) ||
            (c.summary || '').toLowerCase().includes(q) ||
            (c.tags || []).some((t) => t.toLowerCase().includes(q))
        )
        .slice(0, 5),
      vault: vaultItems
        .filter(
          (v) =>
            v.title.toLowerCase().includes(q) ||
            (v.description || '').toLowerCase().includes(q) ||
            v.tags.some((t) => t.toLowerCase().includes(q)) ||
            (v.textContent || '').toLowerCase().includes(q)
        )
        .slice(0, 5),
      collections: collections
        .filter(
          (col) =>
            col.title.toLowerCase().includes(q) ||
            col.explanation.toLowerCase().includes(q) ||
            col.tags.some((t) => t.toLowerCase().includes(q))
        )
        .slice(0, 4),
    };
  }, [searchQuery, effectiveCases, vaultItems, collections]);

  const openCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setView('case_detail');
    setSearchQuery('');
    setSearchFocused(false);
    setMobileNavOpen(false);
  };

  const openNewCaseModal = (defaultType: CaseType = 'legal') => {
    setNewCaseType(defaultType);
    setNewCaseNumber(String(Math.floor(100000 + Math.random() * 899999)));
    setNewCaseTitle('');
    setNewCaseCourt('');
    setNewCaseJudge('');
    setNewCaseCharge('');
    setNewCaseStatus('Active');
    setNewCaseSummary('');
    setWithTemplate(true);
    setShowNewCaseModal(true);
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCaseTitle.trim()) return;
    setCreatingCase(true);
    try {
      const id = await createCaseRecord({
        ownerId: firebaseUser.uid,
        actorName: userProfile.displayName,
        caseNumber: newCaseNumber.trim() || String(Date.now()).slice(-6),
        title: newCaseTitle.trim(),
        caseType: newCaseType,
        status: newCaseStatus,
        court: newCaseCourt.trim() || undefined,
        judge: newCaseJudge.trim() || undefined,
        charge: newCaseCharge.trim() || undefined,
        summary: newCaseSummary.trim() || undefined,
        withTemplateSections: withTemplate,
      });
      setShowNewCaseModal(false);
      openCase(id);
    } finally {
      setCreatingCase(false);
    }
  };

  const initials = userProfile.displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const navItems: Array<{
    id: ConsoleView;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }> = [
    { id: 'dashboard', label: 'Console', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    { id: 'cases', label: 'Cases', icon: <FileText className="w-3.5 h-3.5" />, count: cases.length },
    { id: 'documents', label: 'Document Vault', icon: <HardDrive className="w-3.5 h-3.5" />, count: docCount },
    { id: 'evidence', label: 'Evidence Library', icon: <FolderKanban className="w-3.5 h-3.5" />, count: evidenceCount },
    { id: 'projects', label: 'Projects', icon: <Globe className="w-3.5 h-3.5" />, count: projectCount },
    { id: 'nexus', label: 'Nexus Map', icon: <Network className="w-3.5 h-3.5" />, count: portfolioNexusGraph.edges.length },
    { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'roles', label: 'Access & Roles', icon: <Shield className="w-3.5 h-3.5" /> },
  ];

  const displayedCases =
    view === 'projects'
      ? effectiveCases.filter((c) => c.caseType === 'project')
      : effectiveCases;

  return (
    <div className="min-h-screen flex bg-[#f3f0e9] dark:bg-[#0c0e0c] text-[#0f1210] dark:text-[#f3f0e9]">
      {/* Mobile Sidebar Backdrop */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/55 lg:hidden"
        />
      )}

      {/* Left Sidebar (#111413 obsidian matching design spec) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[214px] bg-[#111413] text-white/60 flex flex-col shrink-0 border-r border-white/[0.06] transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-[54px] px-[18px] flex items-center justify-between border-b border-white/[0.06]">
          <BrandMark className="text-[12px] text-white" />
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="lg:hidden p-1 text-white/60 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 py-2.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              view === item.id || (view === 'case_detail' && item.id === 'cases');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setView(item.id);
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-[18px] py-[9px] text-[13px] border-l-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-white bg-white/[0.05] border-[#c4bfb4] font-medium'
                    : 'text-white/50 border-transparent hover:text-white/90 hover:bg-white/[0.03]'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
                {item.count !== undefined && (
                  <span className="ml-auto text-[11px] font-mono-tabular text-white/30">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}

          <div className="mt-4 pt-4 border-t border-white/[0.06] px-[18px]">
            <button
              type="button"
              onClick={onOpenPublicArchive}
              className="w-full flex items-center justify-between py-2 text-xs font-medium text-white/70 hover:text-white cursor-pointer"
            >
              <span>Public Archive Site</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="px-[18px] py-3.5 border-t border-white/[0.06] flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#2a322c] flex items-center justify-center text-[11px] font-medium text-white shrink-0">
            {initials || 'IM'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-white truncate leading-tight">
              {userProfile.displayName}
            </div>
            <div className="text-[11px] text-white/35 capitalize">{userProfile.role}</div>
          </div>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            title="Sign out"
            className="p-1.5 hover:bg-white/10 text-white/60 hover:text-white cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-[54px] bg-[#faf8f4] dark:bg-[#111413] border-b border-[#ddd8ce] dark:border-[#262b27] px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 flex-1 max-w-md relative">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden p-2 border border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9] dark:bg-[#161916] cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#6a716b] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cases, documents, evidence…"
                className="w-full pl-8 pr-3 py-[6px] text-[13px] bg-[#f3f0e9] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] text-[#0f1210] dark:text-[#f3f0e9] placeholder-[#6a716b] outline-none focus:border-[#b5b0a4] dark:focus:border-[#6a716b]"
              />

              {/* Global Index Search Dropdown */}
              {searchFocused && searchQuery.trim().length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] shadow-lg max-h-80 overflow-y-auto p-2 space-y-2">
                  {globalSearchResults.cases.length === 0 &&
                  globalSearchResults.vault.length === 0 &&
                  globalSearchResults.collections.length === 0 ? (
                    <div className="p-3 text-xs text-[#6a716b]">
                      No indexed cases, documents, or evidence matched &ldquo;{searchQuery}&rdquo;.
                    </div>
                  ) : (
                    <>
                      {globalSearchResults.cases.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[#6a716b]">
                            Cases &amp; Projects
                          </div>
                          {globalSearchResults.cases.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onMouseDown={() => openCase(c.id)}
                              className="w-full text-left px-2.5 py-1.5 hover:bg-[#f3f0e9] dark:hover:bg-[#1f2420] text-xs flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <span className="font-medium truncate">{c.title}</span>
                              <span className="font-mono-tabular text-[#6a716b] shrink-0">
                                {c.caseNumber}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {globalSearchResults.vault.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[#6a716b]">
                            Documents &amp; Evidence
                          </div>
                          {globalSearchResults.vault.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onMouseDown={() => {
                                setView(v.category === 'document' ? 'documents' : 'evidence');
                                setSearchFocused(false);
                              }}
                              className="w-full text-left px-2.5 py-1.5 hover:bg-[#f3f0e9] dark:hover:bg-[#1f2420] text-xs flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <span className="font-medium truncate">{v.title}</span>
                              <span className="font-mono-tabular uppercase text-[10px] text-[#6a716b] shrink-0">
                                {v.mediaType}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {globalSearchResults.collections.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[#6a716b]">
                            Collections
                          </div>
                          {globalSearchResults.collections.map((col) => (
                            <button
                              key={col.id}
                              type="button"
                              onMouseDown={() => {
                                setView('evidence');
                                setSearchFocused(false);
                              }}
                              className="w-full text-left px-2.5 py-1.5 hover:bg-[#f3f0e9] dark:hover:bg-[#1f2420] text-xs flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <span className="font-medium truncate">{col.title}</span>
                              <span className="text-[10px] text-[#6a716b] shrink-0">
                                {col.itemIds.length} items
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label="Toggle color theme"
              className="inline-flex items-center gap-1.5 px-2.5 py-[6px] text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] bg-transparent text-[#0f1210] dark:text-[#f3f0e9] hover:border-[#0f1210] dark:hover:border-[#8d948e] cursor-pointer"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{darkMode ? 'Light' : 'Dark'}</span>
            </button>

            <button
              type="button"
              onClick={() => exportCasesPortfolioCsv(effectiveCases, vaultItems, collections)}
              disabled={effectiveCases.length === 0}
              className="hidden sm:inline-flex px-3 py-[6px] text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] bg-transparent text-[#0f1210] dark:text-[#f3f0e9] hover:border-[#0f1210] disabled:opacity-45 cursor-pointer whitespace-nowrap"
            >
              Export
            </button>

            {canCreate && (
              <button
                type="button"
                onClick={() => openNewCaseModal('legal')}
                className="inline-flex items-center gap-1 px-3.5 py-[6px] text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] hover:opacity-85 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New</span>
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Workspace Viewport */}
        <main className="flex-1 overflow-y-auto p-5 sm:p-6">
          {view === 'dashboard' && (
            <div className="space-y-6 max-w-6xl">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] px-[18px] py-4">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-[#6a716b] dark:text-[#8d948e] mb-1">
                    Cases
                  </div>
                  <div className="text-2xl font-semibold tracking-[-0.02em] font-mono-tabular">
                    {effectiveCases.length}
                  </div>
                </div>
                <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] px-[18px] py-4">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-[#6a716b] dark:text-[#8d948e] mb-1">
                    Documents
                  </div>
                  <div className="text-2xl font-semibold tracking-[-0.02em] font-mono-tabular">
                    {docCount}
                  </div>
                </div>
                <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] px-[18px] py-4">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-[#6a716b] dark:text-[#8d948e] mb-1">
                    Evidence Items
                  </div>
                  <div className="text-2xl font-semibold tracking-[-0.02em] font-mono-tabular">
                    {evidenceCount}
                  </div>
                </div>
                <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] px-[18px] py-4">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-[#6a716b] dark:text-[#8d948e] mb-1">
                    Public Items
                  </div>
                  <div className="text-2xl font-semibold tracking-[-0.02em] font-mono-tabular">
                    {publicItemsCount}
                  </div>
                </div>
              </div>

              {/* Quick Create */}
              {canCreate && (
                <div>
                  <div className="flex items-baseline justify-between mb-2.5">
                    <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Quick Create</h2>
                  </div>
                  <div className="flex flex-wrap gap-[7px]">
                    <button
                      type="button"
                      onClick={() => openNewCaseModal('legal')}
                      className="px-[11px] py-[6px] text-xs border border-[#ddd8ce] dark:border-[#262b27] bg-[#faf8f4] dark:bg-[#161916] hover:border-[#c4bfb4] dark:hover:border-[#6a716b] cursor-pointer"
                    >
                      <span className="text-[#6a716b] mr-1">+</span> Case
                    </button>
                    <button
                      type="button"
                      onClick={() => openNewCaseModal('project')}
                      className="px-[11px] py-[6px] text-xs border border-[#ddd8ce] dark:border-[#262b27] bg-[#faf8f4] dark:bg-[#161916] hover:border-[#c4bfb4] dark:hover:border-[#6a716b] cursor-pointer"
                    >
                      <span className="text-[#6a716b] mr-1">+</span> Project Site
                    </button>
                    <button
                      type="button"
                      onClick={() => setView('documents')}
                      className="px-[11px] py-[6px] text-xs border border-[#ddd8ce] dark:border-[#262b27] bg-[#faf8f4] dark:bg-[#161916] hover:border-[#c4bfb4] dark:hover:border-[#6a716b] cursor-pointer"
                    >
                      <span className="text-[#6a716b] mr-1">+</span> Document
                    </button>
                    <button
                      type="button"
                      onClick={() => setView('evidence')}
                      className="px-[11px] py-[6px] text-xs border border-[#ddd8ce] dark:border-[#262b27] bg-[#faf8f4] dark:bg-[#161916] hover:border-[#c4bfb4] dark:hover:border-[#6a716b] cursor-pointer"
                    >
                      <span className="text-[#6a716b] mr-1">+</span> Evidence / Collection
                    </button>
                    <button
                      type="button"
                      onClick={() => setView('nexus')}
                      className="px-[11px] py-[6px] text-xs border border-[#ddd8ce] dark:border-[#262b27] bg-[#faf8f4] dark:bg-[#161916] hover:border-[#c4bfb4] dark:hover:border-[#6a716b] cursor-pointer"
                    >
                      Explore Nexus Map →
                    </button>
                    <button
                      type="button"
                      onClick={() => setView('reports')}
                      className="px-[11px] py-[6px] text-xs border border-[#ddd8ce] dark:border-[#262b27] bg-[#faf8f4] dark:bg-[#161916] hover:border-[#c4bfb4] dark:hover:border-[#6a716b] cursor-pointer"
                    >
                      Custom Report
                    </button>
                  </div>
                </div>
              )}

              {/* Portfolio Nexus Insights Strip */}
              {cases.length > 0 && (
                <div>
                  <div className="flex items-baseline justify-between mb-2.5">
                    <h2 className="text-[14px] font-semibold tracking-[-0.01em] flex items-center gap-1.5">
                      <Network className="w-3.5 h-3.5 text-[#2d5a3d] dark:text-[#7fb892]" />
                      <span>Nexus Connections &amp; Pattern Insights</span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => setView('nexus')}
                      className="text-xs text-[#6a716b] hover:text-[#0f1210] dark:hover:text-[#f3f0e9] cursor-pointer"
                    >
                      Open Visual Diagram ({portfolioNexusGraph.edges.length} links) →
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {portfolioNexusGraph.insights.map((ins) => (
                      <button
                        key={ins.id}
                        type="button"
                        onClick={() => setView('nexus')}
                        className="text-left bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-3.5 hover:border-[#0f1210] dark:hover:border-[#8d948e] transition-colors cursor-pointer"
                      >
                        <div className="text-[10px] uppercase tracking-[0.1em] text-[#2d5a3d] dark:text-[#7fb892] mb-1">
                          {ins.category}
                        </div>
                        <div className="text-xs font-semibold mb-1">{ins.title}</div>
                        <p className="text-[11px] text-[#6a716b] dark:text-[#8d948e] leading-relaxed">
                          {ins.detail}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cases Table */}
              <div>
                <div className="flex items-baseline justify-between mb-2.5">
                  <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Cases</h2>
                  <button
                    type="button"
                    onClick={() => setView('cases')}
                    className="text-xs text-[#6a716b] hover:text-[#0f1210] dark:hover:text-[#f3f0e9] cursor-pointer"
                  >
                    View all
                  </button>
                </div>

                <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] overflow-x-auto">
                  {effectiveCases.length === 0 ? (
                    <div className="p-10 text-center space-y-3">
                      <h3 className="text-sm font-semibold">Create your first IMnexus Case or Project</h3>
                      <p className="text-xs text-[#6a716b] dark:text-[#8d948e] max-w-md mx-auto">
                        Input structured metadata, attach encrypted documents and evidence collections, inspect Nexus connections, export PDF/CSV reports, and publish a public site URL.
                      </p>
                      {canCreate && (
                        <button
                          type="button"
                          onClick={() => openNewCaseModal('legal')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] hover:opacity-85 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create First Case</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <table className="w-full text-left text-[13px] border-collapse">
                      <thead>
                        <tr className="border-b border-[#ddd8ce] dark:border-[#262b27] bg-black/[0.015] dark:bg-white/[0.02] text-[10px] font-medium uppercase tracking-[0.1em] text-[#6a716b] dark:text-[#8d948e]">
                          <th className="py-2.5 px-3.5">Case No.</th>
                          <th className="py-2.5 px-3.5">Caption</th>
                          <th className="py-2.5 px-3.5">Court / Entity</th>
                          <th className="py-2.5 px-3.5">Status</th>
                          <th className="py-2.5 px-3.5">Public Site</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e9e5db] dark:divide-[#222723]">
                        {effectiveCases.slice(0, 8).map((c) => (
                          <tr
                            key={c.id}
                            onClick={() => openCase(c.id)}
                            className="hover:bg-white/60 dark:hover:bg-white/[0.03] cursor-pointer"
                          >
                            <td className="py-2.5 px-3.5 font-mono-tabular text-[11px] text-[#6a716b]">
                              {c.caseNumber}
                            </td>
                            <td className="py-2.5 px-3.5 font-medium text-[#0f1210] dark:text-[#f3f0e9]">
                              {c.title}
                            </td>
                            <td className="py-2.5 px-3.5 text-[#6a716b] dark:text-[#8d948e]">
                              {c.court || '—'}
                            </td>
                            <td className="py-2.5 px-3.5">
                              <StatusLabel status={c.status} />
                            </td>
                            <td className="py-2.5 px-3.5">
                              {c.isPublished ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenPublicSite(c.publicSlug);
                                  }}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-[#2d5a3d] dark:text-[#7fb892] hover:underline cursor-pointer"
                                >
                                  <span>/site/{c.publicSlug}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              ) : (
                                <span className="text-xs text-[#6a716b]">Private</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27]">
                <div className="px-3.5 py-2.5 border-b border-[#ddd8ce] dark:border-[#262b27] text-[13px] font-semibold">
                  Recent activity
                </div>
                {activityLogs.length === 0 ? (
                  <div className="p-4 text-xs text-[#6a716b]">
                    Activity logs will appear here as you create cases, upload encrypted items, and publish public sites.
                  </div>
                ) : (
                  <div className="divide-y divide-[#e9e5db] dark:divide-[#222723]">
                    {activityLogs.slice(0, 8).map((log) => (
                      <div key={log.id} className="px-3.5 py-2.5 flex items-start justify-between gap-4 text-[13px]">
                        <div>
                          <div className="font-medium text-[#0f1210] dark:text-[#f3f0e9]">
                            {log.title}
                          </div>
                          <div className="text-xs text-[#6a716b] dark:text-[#8d948e]">{log.detail}</div>
                        </div>
                        <div className="text-[11px] text-[#6a716b] font-mono-tabular shrink-0">{log.actorName}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {(view === 'cases' || view === 'projects') && (
            <div className="space-y-5 max-w-6xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-lg font-semibold tracking-[-0.02em]">
                    {view === 'projects' ? 'Project Sites' : 'Cases & Dossiers'}
                  </h1>
                  <p className="text-xs text-[#6a716b] dark:text-[#8d948e] mt-1">
                    Select any workspace to edit metadata, explore its Nexus map, add timeline/actors, export reports, or publish its public site URL.
                  </p>
                </div>
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => openNewCaseModal(view === 'projects' ? 'project' : 'legal')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] hover:opacity-85 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{view === 'projects' ? 'New Project' : 'New Case'}</span>
                  </button>
                )}
              </div>

              <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] overflow-x-auto">
                {displayedCases.length === 0 ? (
                  <div className="p-10 text-center text-xs text-[#6a716b]">
                    No {view === 'projects' ? 'projects' : 'cases'} found. Click New to create one.
                  </div>
                ) : (
                  <table className="w-full text-left text-[13px] border-collapse">
                    <thead>
                      <tr className="border-b border-[#ddd8ce] dark:border-[#262b27] bg-black/[0.015] dark:bg-white/[0.02] text-[10px] font-medium uppercase tracking-[0.1em] text-[#6a716b]">
                        <th className="py-2.5 px-3.5">Case No.</th>
                        <th className="py-2.5 px-3.5">Caption</th>
                        <th className="py-2.5 px-3.5">Type</th>
                        <th className="py-2.5 px-3.5">Status</th>
                        <th className="py-2.5 px-3.5">Public URL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e9e5db] dark:divide-[#222723]">
                      {displayedCases.map((c) => (
                        <tr
                          key={c.id}
                          onClick={() => openCase(c.id)}
                          className="hover:bg-white/60 dark:hover:bg-white/[0.03] cursor-pointer"
                        >
                          <td className="py-2.5 px-3.5 font-mono-tabular text-[11px] text-[#6a716b]">
                            {c.caseNumber}
                          </td>
                          <td className="py-2.5 px-3.5 font-medium">{c.title}</td>
                          <td className="py-2.5 px-3.5 capitalize text-[#6a716b]">{c.caseType}</td>
                          <td className="py-2.5 px-3.5">
                            <StatusLabel status={c.status} />
                          </td>
                          <td className="py-2.5 px-3.5 font-mono-tabular text-xs">
                            {c.isPublished ? (
                              <span className="text-[#2d5a3d] dark:text-[#7fb892]">
                                /site/{c.publicSlug}
                              </span>
                            ) : (
                              <span className="text-[#6a716b]">Draft</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {view === 'case_detail' && selectedCase && (
            <div className="max-w-6xl">
              <CaseWorkspace
                caseRecord={selectedCase}
                vaultItems={vaultItems}
                collections={collections}
                workspaceUsers={workspaceUsers}
                userId={firebaseUser.uid}
                userName={userProfile.displayName}
                userRole={userProfile.role}
                onBack={() => setView('cases')}
                onOpenPublicSite={onOpenPublicSite}
                onLiveCaseDraftChange={handleLiveCaseDraftChange}
                onClearLiveCaseDraft={handleClearLiveCaseDraft}
              />
            </div>
          )}

          {view === 'documents' && (
            <div className="max-w-6xl">
              <VaultAndEvidenceView
                mode="documents"
                items={vaultItems}
                collections={collections}
                cases={effectiveCases}
                userId={firebaseUser.uid}
                userName={userProfile.displayName}
                userRole={userProfile.role}
                idToken={idToken}
                searchQuery={searchQuery}
              />
            </div>
          )}

          {view === 'evidence' && (
            <div className="max-w-6xl">
              <VaultAndEvidenceView
                mode="evidence"
                items={vaultItems}
                collections={collections}
                cases={effectiveCases}
                userId={firebaseUser.uid}
                userName={userProfile.displayName}
                userRole={userProfile.role}
                idToken={idToken}
                searchQuery={searchQuery}
              />
            </div>
          )}

          {view === 'nexus' && (
            <div className="space-y-5 max-w-6xl">
              <div>
                <h1 className="text-lg font-semibold tracking-[-0.02em]">
                  IMnexus Portfolio Connection &amp; Systemic Map
                </h1>
                <p className="text-xs text-[#6a716b] dark:text-[#8d948e] mt-0.5">
                  Select which cases to cross-reference across the Kumu Legal Systemic Diagram, Relationship Web, Procedural &amp; Institutional Stratigraphic Map, Axis Matrix, and Chronology Axis.
                </p>
              </div>
              <NexusMapView
                graph={portfolioNexusGraph}
                defaultViewMode="kumu"
                openCaseButtonLabel="Open Case Workspace"
                subtitle="Select cases below to isolate relationships across metadata hubs, #tags, collections, and procedural strata."
                selectableCases={selectableNexusCases}
                selectedCaseIds={effectiveNexusCaseIds}
                onToggleCaseId={(id) => {
                  const base =
                    selectedNexusCaseIds === null
                      ? effectiveCases.map((c) => c.id)
                      : selectedNexusCaseIds;
                  setSelectedNexusCaseIds(
                    base.includes(id) ? base.filter((x) => x !== id) : [...base, id]
                  );
                }}
                onSelectAllCases={() =>
                  setSelectedNexusCaseIds(effectiveCases.map((c) => c.id))
                }
                onClearCases={() => setSelectedNexusCaseIds([])}
                stratigraphicData={consoleStratigraphicData}
                onOpenStratumCase={(stratum) => openCase(stratum.caseId)}
                onSelectCaseId={openCase}
                onInspectNodeArtifact={(node) => {
                  if (node.kind === 'document') setView('documents');
                  else if (node.kind === 'evidence') setView('evidence');
                }}
              />
            </div>
          )}

          {view === 'reports' && (
            <div className="max-w-6xl">
              <ReportsAnalyticsView
                cases={effectiveCases}
                vaultItems={vaultItems}
                collections={collections}
              />
            </div>
          )}

          {view === 'roles' && (
            <div className="max-w-6xl">
              <AccessRolesView
                currentUser={userProfile}
                workspaceUsers={workspaceUsers}
              />
            </div>
          )}
        </main>
      </div>

      {/* Create New Case / Project Modal */}
      {showNewCaseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-3.5 border-b border-[#ddd8ce] dark:border-[#262b27] flex items-center justify-between">
              <h2 className="text-sm font-semibold">Create Case / Project Site</h2>
              <button
                type="button"
                onClick={() => setShowNewCaseModal(false)}
                className="p-1 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                    Case / Project No. *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCaseNumber}
                    onChange={(e) => setNewCaseNumber(e.target.value)}
                    className="w-full px-2.5 py-2 text-[13px] font-mono-tabular bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                    Type
                  </label>
                  <select
                    value={newCaseType}
                    onChange={(e) => setNewCaseType(e.target.value as CaseType)}
                    className="w-full px-2.5 py-2 text-[13px] bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                  >
                    <option value="legal">Legal Case</option>
                    <option value="investigation">Investigation</option>
                    <option value="project">Research / Project</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                  Title / Caption *
                </label>
                <input
                  type="text"
                  required
                  value={newCaseTitle}
                  onChange={(e) => setNewCaseTitle(e.target.value)}
                  placeholder="e.g. The City of Seattle vs. ..."
                  className="w-full px-2.5 py-2 text-[13px] bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                    Court / Organization
                  </label>
                  <input
                    type="text"
                    value={newCaseCourt}
                    onChange={(e) => setNewCaseCourt(e.target.value)}
                    placeholder="e.g. Seattle Municipal Court"
                    className="w-full px-2.5 py-2 text-[13px] bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                    Judge / Lead
                  </label>
                  <input
                    type="text"
                    value={newCaseJudge}
                    onChange={(e) => setNewCaseJudge(e.target.value)}
                    className="w-full px-2.5 py-2 text-[13px] bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                    Subject / Charge
                  </label>
                  <input
                    type="text"
                    value={newCaseCharge}
                    onChange={(e) => setNewCaseCharge(e.target.value)}
                    className="w-full px-2.5 py-2 text-[13px] bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                    Status
                  </label>
                  <select
                    value={newCaseStatus}
                    onChange={(e) => setNewCaseStatus(e.target.value as CaseStatus)}
                    className="w-full px-2.5 py-2 text-[13px] bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                    <option value="In Review">In Review</option>
                    <option value="Dismissed">Dismissed</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                  Executive Summary
                </label>
                <textarea
                  rows={3}
                  value={newCaseSummary}
                  onChange={(e) => setNewCaseSummary(e.target.value)}
                  className="w-full px-2.5 py-2 text-[13px] bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={withTemplate}
                  onChange={(e) => setWithTemplate(e.target.checked)}
                />
                <span>Initialize with 9 modular dossier report sections</span>
              </label>

              <div className="pt-3 border-t border-[#ddd8ce] dark:border-[#262b27] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewCaseModal(false)}
                  className="px-4 py-2 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCase}
                  className="px-4 py-2 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] hover:opacity-85 disabled:opacity-50 cursor-pointer"
                >
                  {creatingCase ? 'Creating…' : 'Create Dossier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
