import React, { useEffect, useMemo, useState } from 'react';
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
  subscribeActivityLogs,
  subscribeCases,
  subscribeCollections,
  subscribeVaultItems,
  subscribeWorkspaceUsers,
} from '../services/firestoreService';
import type {
  ActivityLog,
  CaseRecord,
  CaseStatus,
  CaseType,
  EvidenceCollection,
  UserProfile,
  VaultItem,
} from '../types';
import { exportCasesPortfolioCsv } from '../utils/exportReports';
import { AccessRolesView } from './AccessRolesView';
import { BrandMark, StatusLabel } from './BrandMark';
import { CaseWorkspace } from './CaseWorkspace';
import { ReportsAnalyticsView } from './ReportsAnalyticsView';
import { VaultAndEvidenceView } from './VaultAndEvidenceView';

export type ConsoleView =
  | 'dashboard'
  | 'cases'
  | 'projects'
  | 'case_detail'
  | 'documents'
  | 'evidence'
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
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [collections, setCollections] = useState<EvidenceCollection[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [workspaceUsers, setWorkspaceUsers] = useState<UserProfile[]>([]);
  const [idToken, setIdToken] = useState<string | null>(null);

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
      // Claim invited cases automatically
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

  const docCount = useMemo(
    () => vaultItems.filter((v) => v.category === 'document').length,
    [vaultItems]
  );
  const evidenceCount = useMemo(
    () => vaultItems.filter((v) => v.category === 'evidence').length,
    [vaultItems]
  );
  const projectCount = useMemo(
    () => cases.filter((c) => c.caseType === 'project').length,
    [cases]
  );
  const publicItemsCount = useMemo(
    () =>
      vaultItems.filter((v) => v.isPublic).length +
      cases.filter((c) => c.isPublished).length,
    [vaultItems, cases]
  );

  const selectedCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId) || null,
    [cases, selectedCaseId]
  );

  // Global Index Search Results
  const globalSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { cases: [], vault: [], collections: [] };
    return {
      cases: cases
        .filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            c.caseNumber.toLowerCase().includes(q) ||
            (c.court || '').toLowerCase().includes(q) ||
            (c.judge || '').toLowerCase().includes(q) ||
            (c.summary || '').toLowerCase().includes(q)
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
  }, [searchQuery, cases, vaultItems, collections]);

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
    { id: 'dashboard', label: 'Console', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'cases', label: 'Cases', icon: <FileText className="w-4 h-4" />, count: cases.length },
    { id: 'documents', label: 'Document Vault', icon: <HardDrive className="w-4 h-4" />, count: docCount },
    { id: 'evidence', label: 'Evidence Library', icon: <FolderKanban className="w-4 h-4" />, count: evidenceCount },
    { id: 'projects', label: 'Projects', icon: <Globe className="w-4 h-4" />, count: projectCount },
    { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'roles', label: 'Access & Roles', icon: <Shield className="w-4 h-4" /> },
  ];

  const displayedCases =
    view === 'projects' ? cases.filter((c) => c.caseType === 'project') : cases;

  return (
    <div className="min-h-screen flex bg-[#f4f4f5] dark:bg-[#09090b] text-zinc-950 dark:text-zinc-100">
      {/* Mobile Sidebar Backdrop */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      {/* Left Sidebar (Cobalt #3061d0 matching prototype) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[232px] bg-[#3061d0] dark:bg-[#111827] text-white/70 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-14 px-5 flex items-center justify-between border-b border-white/10">
          <BrandMark className="text-[15px] text-white" />
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="lg:hidden p-1 text-white/70 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
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
                className={`w-full flex items-center gap-2.5 px-5 py-2.5 text-[13px] font-medium border-l-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-white bg-white/10 border-white font-semibold'
                    : 'text-white/65 border-transparent hover:text-white hover:bg-white/5'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
                {item.count !== undefined && (
                  <span className="ml-auto text-[11px] font-mono-tabular text-white/50">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}

          <div className="mt-4 pt-4 border-t border-white/10 px-5">
            <button
              type="button"
              onClick={onOpenPublicArchive}
              className="w-full flex items-center justify-between py-2 text-xs font-semibold text-white/80 hover:text-white cursor-pointer"
            >
              <span>Public Archive Site</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/10 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#22479c] dark:bg-[#3061d0] flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials || 'IM'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate">
              {userProfile.displayName}
            </div>
            <div className="text-[11px] text-white/55 capitalize">{userProfile.role}</div>
          </div>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            title="Sign out"
            className="p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-white cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-white dark:bg-[#0f1014] border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 flex-1 max-w-md relative">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden p-2 rounded-md border border-zinc-200 dark:border-zinc-800"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Global index: search cases, documents, evidence, tags..."
                className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-[#f4f4f5] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none focus:border-[#3061d0]"
              />

              {/* Global Index Search Dropdown */}
              {searchFocused && searchQuery.trim().length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg max-h-80 overflow-y-auto p-2 space-y-2">
                  {globalSearchResults.cases.length === 0 &&
                  globalSearchResults.vault.length === 0 &&
                  globalSearchResults.collections.length === 0 ? (
                    <div className="p-3 text-xs text-zinc-500">
                      No indexed cases, documents, or evidence matched &ldquo;{searchQuery}&rdquo;.
                    </div>
                  ) : (
                    <>
                      {globalSearchResults.cases.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Cases &amp; Projects
                          </div>
                          {globalSearchResults.cases.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onMouseDown={() => openCase(c.id)}
                              className="w-full text-left px-2.5 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <span className="font-semibold truncate">{c.title}</span>
                              <span className="font-mono-tabular text-zinc-400 shrink-0">
                                {c.caseNumber}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {globalSearchResults.vault.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
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
                              className="w-full text-left px-2.5 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <span className="font-semibold truncate">{v.title}</span>
                              <span className="font-mono-tabular uppercase text-[10px] text-zinc-400 shrink-0">
                                {v.mediaType}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {globalSearchResults.collections.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
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
                              className="w-full text-left px-2.5 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <span className="font-semibold truncate">{col.title}</span>
                              <span className="text-[10px] text-zinc-400 shrink-0">
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
              aria-label="Toggle dark mode"
              className="p-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => exportCasesPortfolioCsv(cases, vaultItems, collections)}
              disabled={cases.length === 0}
              className="hidden sm:inline-flex px-3 py-1.5 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              Export CSV
            </button>

            {canCreate && (
              <button
                type="button"
                onClick={() => openNewCaseModal('legal')}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-[#3061d0] text-white hover:bg-[#2752b4] cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New</span>
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Workspace Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-7">
          {view === 'dashboard' && (
            <div className="space-y-7 max-w-6xl">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                    Cases &amp; Projects
                  </div>
                  <div className="text-3xl font-bold tabular-nums">{cases.length}</div>
                </div>
                <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                    Documents
                  </div>
                  <div className="text-3xl font-bold tabular-nums">{docCount}</div>
                </div>
                <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                    Evidence Items
                  </div>
                  <div className="text-3xl font-bold tabular-nums">{evidenceCount}</div>
                </div>
                <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                    Public Items &amp; Sites
                  </div>
                  <div className="text-3xl font-bold tabular-nums">{publicItemsCount}</div>
                </div>
              </div>

              {/* Quick Create */}
              {canCreate && (
                <div>
                  <h2 className="text-sm font-bold mb-2.5">Quick Create</h2>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openNewCaseModal('legal')}
                      className="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] hover:border-[#3061d0] cursor-pointer"
                    >
                      <span className="text-zinc-400 font-bold mr-1">+</span> Case
                    </button>
                    <button
                      type="button"
                      onClick={() => openNewCaseModal('project')}
                      className="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] hover:border-[#3061d0] cursor-pointer"
                    >
                      <span className="text-zinc-400 font-bold mr-1">+</span> Project Site
                    </button>
                    <button
                      type="button"
                      onClick={() => setView('documents')}
                      className="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] hover:border-[#3061d0] cursor-pointer"
                    >
                      <span className="text-zinc-400 font-bold mr-1">+</span> Document
                    </button>
                    <button
                      type="button"
                      onClick={() => setView('evidence')}
                      className="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] hover:border-[#3061d0] cursor-pointer"
                    >
                      <span className="text-zinc-400 font-bold mr-1">+</span> Evidence / Collection
                    </button>
                    <button
                      type="button"
                      onClick={() => setView('reports')}
                      className="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] hover:border-[#3061d0] cursor-pointer"
                    >
                      Custom Report
                    </button>
                  </div>
                </div>
              )}

              {/* Cases Table */}
              <div>
                <div className="flex items-baseline justify-between mb-2.5">
                  <h2 className="text-sm font-bold">Cases &amp; Public Sites</h2>
                  <button
                    type="button"
                    onClick={() => setView('cases')}
                    className="text-xs font-medium text-zinc-500 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                  >
                    View all
                  </button>
                </div>

                <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-x-auto">
                  {cases.length === 0 ? (
                    <div className="p-10 text-center space-y-3">
                      <h3 className="text-base font-bold">Create your first IMnexus Case or Project</h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                        Input structured metadata, attach encrypted documents and evidence collections, export PDF/CSV reports, and publish to a dedicated public URL.
                      </p>
                      {canCreate && (
                        <button
                          type="button"
                          onClick={() => openNewCaseModal('legal')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-[#3061d0] text-white hover:bg-[#2752b4] cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create First Case</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs sm:text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                          <th className="py-3 px-4">Case No.</th>
                          <th className="py-3 px-4">Caption</th>
                          <th className="py-3 px-4">Court / Entity</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Public Site</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {cases.slice(0, 8).map((c) => (
                          <tr
                            key={c.id}
                            onClick={() => openCase(c.id)}
                            className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 cursor-pointer"
                          >
                            <td className="py-3 px-4 font-mono-tabular text-xs text-zinc-500">
                              {c.caseNumber}
                            </td>
                            <td className="py-3 px-4 font-semibold text-zinc-950 dark:text-white">
                              {c.title}
                            </td>
                            <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400">
                              {c.court || '—'}
                            </td>
                            <td className="py-3 px-4">
                              <StatusLabel status={c.status} />
                            </td>
                            <td className="py-3 px-4">
                              {c.isPublished ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenPublicSite(c.publicSlug);
                                  }}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#3061d0] dark:text-blue-400 hover:underline cursor-pointer"
                                >
                                  <span>/site/{c.publicSlug}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              ) : (
                                <span className="text-xs text-zinc-400">Private</span>
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
              <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold">
                  Recent Activity
                </div>
                {activityLogs.length === 0 ? (
                  <div className="p-5 text-xs text-zinc-500">
                    Activity logs will appear here as you create cases, upload encrypted items, and publish public sites.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {activityLogs.slice(0, 8).map((log) => (
                      <div key={log.id} className="px-4 py-3 flex items-start justify-between gap-4 text-xs">
                        <div>
                          <div className="font-semibold text-zinc-950 dark:text-white">
                            {log.title}
                          </div>
                          <div className="text-zinc-500 dark:text-zinc-400">{log.detail}</div>
                        </div>
                        <div className="text-[11px] text-zinc-400 shrink-0">{log.actorName}</div>
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
                  <h1 className="text-2xl font-extrabold tracking-tight">
                    {view === 'projects' ? 'Project Sites' : 'Cases & Dossiers'}
                  </h1>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Select any workspace to edit metadata, add timeline/actors, export reports, or publish its public site URL.
                  </p>
                </div>
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => openNewCaseModal(view === 'projects' ? 'project' : 'legal')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-[#3061d0] text-white hover:bg-[#2752b4] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{view === 'projects' ? 'New Project' : 'New Case'}</span>
                  </button>
                )}
              </div>

              <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-x-auto">
                {displayedCases.length === 0 ? (
                  <div className="p-10 text-center text-xs text-zinc-500">
                    No {view === 'projects' ? 'projects' : 'cases'} found. Click New to create one.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        <th className="py-3 px-4">Case No.</th>
                        <th className="py-3 px-4">Caption</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Public URL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {displayedCases.map((c) => (
                        <tr
                          key={c.id}
                          onClick={() => openCase(c.id)}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 cursor-pointer"
                        >
                          <td className="py-3 px-4 font-mono-tabular text-xs text-zinc-500">
                            {c.caseNumber}
                          </td>
                          <td className="py-3 px-4 font-semibold">{c.title}</td>
                          <td className="py-3 px-4 capitalize text-zinc-500">{c.caseType}</td>
                          <td className="py-3 px-4">
                            <StatusLabel status={c.status} />
                          </td>
                          <td className="py-3 px-4 font-mono-tabular text-xs">
                            {c.isPublished ? (
                              <span className="text-[#3061d0] dark:text-blue-400">
                                /site/{c.publicSlug}
                              </span>
                            ) : (
                              <span className="text-zinc-400">Draft</span>
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
              />
            </div>
          )}

          {view === 'documents' && (
            <div className="max-w-6xl">
              <VaultAndEvidenceView
                mode="documents"
                items={vaultItems}
                collections={collections}
                cases={cases}
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
                cases={cases}
                userId={firebaseUser.uid}
                userName={userProfile.displayName}
                userRole={userProfile.role}
                idToken={idToken}
                searchQuery={searchQuery}
              />
            </div>
          )}

          {view === 'reports' && (
            <div className="max-w-6xl">
              <ReportsAnalyticsView
                cases={cases}
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
          <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-base font-bold">Create Case / Project Site</h2>
              <button
                type="button"
                onClick={() => setShowNewCaseModal(false)}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                    Case / Project No. *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCaseNumber}
                    onChange={(e) => setNewCaseNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-tabular bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                    Type
                  </label>
                  <select
                    value={newCaseType}
                    onChange={(e) => setNewCaseType(e.target.value as CaseType)}
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md"
                  >
                    <option value="legal">Legal Case</option>
                    <option value="investigation">Investigation</option>
                    <option value="project">Research / Project</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                  Title / Caption *
                </label>
                <input
                  type="text"
                  required
                  value={newCaseTitle}
                  onChange={(e) => setNewCaseTitle(e.target.value)}
                  placeholder="e.g. The City of Seattle vs. ..."
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                    Court / Organization
                  </label>
                  <input
                    type="text"
                    value={newCaseCourt}
                    onChange={(e) => setNewCaseCourt(e.target.value)}
                    placeholder="e.g. Seattle Municipal Court"
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                    Judge / Lead
                  </label>
                  <input
                    type="text"
                    value={newCaseJudge}
                    onChange={(e) => setNewCaseJudge(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                    Subject / Charge
                  </label>
                  <input
                    type="text"
                    value={newCaseCharge}
                    onChange={(e) => setNewCaseCharge(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                    Status
                  </label>
                  <select
                    value={newCaseStatus}
                    onChange={(e) => setNewCaseStatus(e.target.value as CaseStatus)}
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md"
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
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                  Executive Summary
                </label>
                <textarea
                  rows={3}
                  value={newCaseSummary}
                  onChange={(e) => setNewCaseSummary(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md"
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

              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewCaseModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCase}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-[#3061d0] text-white hover:bg-[#2752b4] disabled:opacity-50 cursor-pointer"
                >
                  {creatingCase ? 'Creating...' : 'Create Dossier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
