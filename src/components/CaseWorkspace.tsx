import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Layers,
  Lock,
  Plus,
  Save,
  Shield,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import type {
  CaseActor,
  CaseCollaborator,
  CaseCollaboratorRole,
  CaseRecord,
  CaseSection,
  CaseStatus,
  CaseType,
  CustomField,
  EvidenceCollection,
  TimelineEvent,
  UserProfile,
  UserRole,
  VaultItem,
} from '../types';
import {
  addCaseCollaborator,
  createCaseActor,
  createCaseSection,
  createTimelineEvent,
  createVaultItem,
  deleteCaseActor,
  deleteCaseRecord,
  deleteCaseSection,
  deleteTimelineEvent,
  publishCaseToPublicSite,
  removeCaseCollaborator,
  slugify,
  subscribeCaseSubcollections,
  unpublishCaseSite,
  updateCaseActor,
  updateCaseRecord,
  updateCaseSection,
  updateTimelineEvent,
  updateVaultItem,
} from '../services/firestoreService';
import {
  DEFAULT_COMPLETE_REPORT_OPTIONS,
  exportCaseCustomCsv,
  exportCasePdf,
} from '../utils/exportReports';
import { inferMediaType, uploadEncryptedVaultFile } from '../utils/vaultApi';
import { StatusLabel } from './BrandMark';

type CaseTab =
  | 'overview'
  | 'timeline'
  | 'actors'
  | 'narrative'
  | 'documents'
  | 'evidence'
  | 'permissions'
  | 'public_builder';

interface CaseWorkspaceProps {
  caseRecord: CaseRecord;
  vaultItems: VaultItem[];
  collections: EvidenceCollection[];
  workspaceUsers: UserProfile[];
  userId: string;
  userName: string;
  userRole: UserRole;
  onBack: () => void;
  onOpenPublicSite: (slug: string) => void;
}

export const CaseWorkspace: React.FC<CaseWorkspaceProps> = ({
  caseRecord,
  vaultItems,
  collections,
  workspaceUsers,
  userId,
  userName,
  userRole,
  onBack,
  onOpenPublicSite,
}) => {
  const canEdit =
    userRole === 'admin' ||
    caseRecord.ownerId === userId ||
    caseRecord.editorUids.includes(userId);
  const isOwnerOrAdmin = userRole === 'admin' || caseRecord.ownerId === userId;

  const [activeTab, setActiveTab] = useState<CaseTab>('overview');
  const [sections, setSections] = useState<CaseSection[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [actors, setActors] = useState<CaseActor[]>([]);
  const [collaborators, setCollaborators] = useState<CaseCollaborator[]>([]);

  // Editable form state synced from caseRecord
  const [form, setForm] = useState({
    caseNumber: caseRecord.caseNumber,
    title: caseRecord.title,
    caseType: caseRecord.caseType,
    court: caseRecord.court || '',
    judge: caseRecord.judge || '',
    charge: caseRecord.charge || '',
    arrestDates: caseRecord.arrestDates || '',
    closureDate: caseRecord.closureDate || '',
    status: caseRecord.status,
    disposition: caseRecord.disposition || '',
    summary: caseRecord.summary || '',
    tags: (caseRecord.tags || []).join(', '),
    publicSlug: caseRecord.publicSlug,
    publicHeadline: caseRecord.publicHeadline || caseRecord.title,
    publicSubtitle: caseRecord.publicSubtitle || '',
    publicIntro: caseRecord.publicIntro || '',
    publicCoverUrl:
      caseRecord.publicCoverUrl ||
      '/assets/aistudio/maxim-berg-fKPZGJI4dXU-unsplash_b5b78643.jpg',
  });
  const [customFields, setCustomFields] = useState<CustomField[]>(caseRecord.customFields || []);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Sub-forms
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  const [evtDate, setEvtDate] = useState('');
  const [evtTime, setEvtTime] = useState('');
  const [evtTitle, setEvtTitle] = useState('');
  const [evtDesc, setEvtDesc] = useState('');
  const [evtPublic, setEvtPublic] = useState(true);

  const [actorName, setActorName] = useState('');
  const [actorRole, setActorRole] = useState('');
  const [actorOrg, setActorOrg] = useState('');
  const [actorNotes, setActorNotes] = useState('');
  const [actorPublic, setActorPublic] = useState(true);

  const [collabEmail, setCollabEmail] = useState('');
  const [collabRole, setCollabRole] = useState<CaseCollaboratorRole>('editor');

  const coverFileRef = useRef<HTMLInputElement>(null);
  const quickDocRef = useRef<HTMLInputElement>(null);
  const quickEvRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm({
      caseNumber: caseRecord.caseNumber,
      title: caseRecord.title,
      caseType: caseRecord.caseType,
      court: caseRecord.court || '',
      judge: caseRecord.judge || '',
      charge: caseRecord.charge || '',
      arrestDates: caseRecord.arrestDates || '',
      closureDate: caseRecord.closureDate || '',
      status: caseRecord.status,
      disposition: caseRecord.disposition || '',
      summary: caseRecord.summary || '',
      tags: (caseRecord.tags || []).join(', '),
      publicSlug: caseRecord.publicSlug,
      publicHeadline: caseRecord.publicHeadline || caseRecord.title,
      publicSubtitle: caseRecord.publicSubtitle || '',
      publicIntro: caseRecord.publicIntro || '',
      publicCoverUrl:
        caseRecord.publicCoverUrl ||
        '/assets/aistudio/maxim-berg-fKPZGJI4dXU-unsplash_b5b78643.jpg',
    });
    setCustomFields(caseRecord.customFields || []);
  }, [caseRecord]);

  useEffect(() => {
    return subscribeCaseSubcollections(caseRecord.id, {
      onSections: setSections,
      onTimeline: setTimeline,
      onActors: setActors,
      onCollaborators: setCollaborators,
    });
  }, [caseRecord.id]);

  const linkedDocs = useMemo(
    () =>
      vaultItems.filter(
        (v) => v.category === 'document' && v.caseIds.includes(caseRecord.id)
      ),
    [vaultItems, caseRecord.id]
  );

  const unlinkedDocs = useMemo(
    () =>
      vaultItems.filter(
        (v) => v.category === 'document' && !v.caseIds.includes(caseRecord.id)
      ),
    [vaultItems, caseRecord.id]
  );

  const linkedEvidence = useMemo(
    () =>
      vaultItems.filter(
        (v) => v.category === 'evidence' && v.caseIds.includes(caseRecord.id)
      ),
    [vaultItems, caseRecord.id]
  );

  const unlinkedEvidence = useMemo(
    () =>
      vaultItems.filter(
        (v) => v.category === 'evidence' && !v.caseIds.includes(caseRecord.id)
      ),
    [vaultItems, caseRecord.id]
  );

  const linkedCollections = useMemo(
    () => collections.filter((c) => c.caseId === caseRecord.id),
    [collections, caseRecord.id]
  );

  const showFlash = (msg: string) => {
    setSaveNotice(msg);
    setTimeout(() => setSaveNotice(null), 2600);
  };

  const handleSaveMetadata = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await updateCaseRecord(caseRecord.id, {
        caseNumber: form.caseNumber,
        title: form.title,
        caseType: form.caseType as CaseType,
        court: form.court,
        judge: form.judge,
        charge: form.charge,
        arrestDates: form.arrestDates,
        closureDate: form.closureDate,
        status: form.status as CaseStatus,
        disposition: form.disposition,
        summary: form.summary,
        customFields: customFields.filter((cf) => cf.label.trim()),
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        publicSlug: slugify(form.publicSlug),
        publicHeadline: form.publicHeadline,
        publicSubtitle: form.publicSubtitle,
        publicIntro: form.publicIntro,
        publicCoverUrl: form.publicCoverUrl,
      });
      showFlash('Case saved to cloud.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!isOwnerOrAdmin) return;
    setPublishing(true);
    try {
      await handleSaveMetadata();
      const updatedRecord: CaseRecord = {
        ...caseRecord,
        ...form,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        customFields: customFields.filter((cf) => cf.label.trim()),
        publicSlug: slugify(form.publicSlug),
      };
      const liveSlug = await publishCaseToPublicSite({
        caseRecord: updatedRecord,
        sections,
        timeline,
        actors,
        vaultItems,
        collections,
        actorName: userName,
      });
      showFlash(`Published to /site/${liveSlug}`);
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!isOwnerOrAdmin) return;
    setPublishing(true);
    try {
      await unpublishCaseSite(caseRecord, userName);
      showFlash('Public site unpublished.');
    } finally {
      setPublishing(false);
    }
  };

  const handleQuickUpload = async (file: File, category: 'document' | 'evidence') => {
    const uploaded = await uploadEncryptedVaultFile(file, false);
    const mediaType = inferMediaType(uploaded.mimeType, uploaded.fileName);
    await createVaultItem({
      ownerId: userId,
      actorName: userName,
      title: file.name.replace(/\.[^/.]+$/, ''),
      category,
      mediaType,
      docType: mediaType.toUpperCase(),
      fileId: uploaded.fileId,
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      fileSize: uploaded.fileSize,
      sha256: uploaded.sha256,
      encrypted: true,
      caseIds: [caseRecord.id],
      tags: [],
      isPublic: false,
    });
    showFlash(`${category === 'document' ? 'Document' : 'Evidence'} encrypted & linked.`);
  };

  const shareableUrl = `${window.location.origin}/site/${slugify(form.publicSlug)}`;

  return (
    <div className="space-y-5">
      {/* Case Header Card */}
      <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2.5">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="hover:text-zinc-950 dark:hover:text-white cursor-pointer"
            >
              Cases
            </button>
            <span className="mx-1.5">/</span>
            <span className="font-mono-tabular">{caseRecord.caseNumber}</span>
          </div>
          {saveNotice && (
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {saveNotice}
            </span>
          )}
        </div>

        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white leading-snug mb-1.5">
          {caseRecord.title}
        </h1>

        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
          <span>
            Case No. <code className="font-mono-tabular">{caseRecord.caseNumber}</code>
          </span>
          {caseRecord.court && (
            <>
              <span aria-hidden="true">·</span>
              <span>{caseRecord.court}</span>
            </>
          )}
          {caseRecord.judge && (
            <>
              <span aria-hidden="true">·</span>
              <span>{caseRecord.judge}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <StatusLabel status={caseRecord.disposition || caseRecord.status} />
          {caseRecord.isPublished && (
            <>
              <span aria-hidden="true">·</span>
              <StatusLabel status="Published" />
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          {caseRecord.isPublished ? (
            <button
              type="button"
              onClick={() => onOpenPublicSite(caseRecord.publicSlug)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View Public Site</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('public_builder')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Configure Public Site</span>
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              exportCasePdf({
                caseRecord,
                sections,
                timeline,
                actors,
                vaultItems,
                collections,
                options: DEFAULT_COMPLETE_REPORT_OPTIONS,
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>

          <button
            type="button"
            onClick={() =>
              exportCaseCustomCsv({
                caseRecord,
                sections,
                timeline,
                actors,
                vaultItems,
                collections,
                options: DEFAULT_COMPLETE_REPORT_OPTIONS,
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={handleSaveMetadata}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-[#3061d0] text-white hover:bg-[#2752b4] disabled:opacity-60 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
        {(
          [
            ['overview', 'Overview'],
            ['timeline', `Timeline (${timeline.length})`],
            ['actors', `Actors (${actors.length})`],
            ['narrative', `Narrative Sections (${sections.length})`],
            ['documents', `Documents (${linkedDocs.length})`],
            ['evidence', `Evidence (${linkedEvidence.length})`],
            ['permissions', 'Stakeholder Roles'],
            ['public_builder', 'Public Site Builder'],
          ] as Array<[CaseTab, string]>
        ).map(([tabKey, label]) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setActiveTab(tabKey)}
            className={`px-3.5 py-2.5 text-xs whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
              activeTab === tabKey
                ? 'border-[#3061d0] text-zinc-950 dark:text-white font-bold'
                : 'border-transparent text-zinc-500 dark:text-zinc-400 font-medium hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content + Right Actions Rail */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          {activeTab === 'overview' && (
            <>
              <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
                <h3 className="text-sm font-bold mb-4">Case Metadata</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                      Case Number
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.caseNumber}
                      onChange={(e) => setForm({ ...form, caseNumber: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none focus:border-[#3061d0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                      Classification
                    </label>
                    <select
                      disabled={!canEdit}
                      value={form.caseType}
                      onChange={(e) =>
                        setForm({ ...form, caseType: e.target.value as CaseType })
                      }
                      className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none"
                    >
                      <option value="legal">Legal Case</option>
                      <option value="investigation">Investigation</option>
                      <option value="project">Research / Project</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                      Caption / Title
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none focus:border-[#3061d0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                      Jurisdiction / Court / Org
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.court}
                      onChange={(e) => setForm({ ...form, court: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none focus:border-[#3061d0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                      Presiding Judge / Lead
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.judge}
                      onChange={(e) => setForm({ ...form, judge: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none focus:border-[#3061d0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                      Alleged Cause / Charge
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.charge}
                      onChange={(e) => setForm({ ...form, charge: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none focus:border-[#3061d0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                      Status
                    </label>
                    <select
                      disabled={!canEdit}
                      value={form.status}
                      onChange={(e) =>
                        setForm({ ...form, status: e.target.value as CaseStatus })
                      }
                      className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none"
                    >
                      <option value="Active">Active</option>
                      <option value="In Review">In Review</option>
                      <option value="Draft">Draft</option>
                      <option value="Dismissed">Dismissed</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                      Arrest / Key Dates
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.arrestDates}
                      onChange={(e) => setForm({ ...form, arrestDates: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none focus:border-[#3061d0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                      Official Closure Date
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.closureDate}
                      onChange={(e) => setForm({ ...form, closureDate: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none focus:border-[#3061d0]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                      Final Disposition / Outcome
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.disposition}
                      onChange={(e) => setForm({ ...form, disposition: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none focus:border-[#3061d0]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                      Executive Summary
                    </label>
                    <textarea
                      rows={4}
                      disabled={!canEdit}
                      value={form.summary}
                      onChange={(e) => setForm({ ...form, summary: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none focus:border-[#3061d0]"
                    />
                  </div>
                </div>
              </div>

              {/* Custom Metadata Fields */}
              <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold">Custom Fields</h3>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() =>
                        setCustomFields([...customFields, { label: '', value: '' }])
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Custom Field</span>
                    </button>
                  )}
                </div>
                {customFields.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    Add custom key-value attributes (docket numbers, counsel, filing status) tailored to this case.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {customFields.map((cf, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={cf.label}
                          placeholder="Field label"
                          onChange={(e) => {
                            const next = [...customFields];
                            next[idx] = { ...next[idx], label: e.target.value };
                            setCustomFields(next);
                          }}
                          className="px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded"
                        />
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={cf.value}
                          placeholder="Value"
                          onChange={(e) => {
                            const next = [...customFields];
                            next[idx] = { ...next[idx], value: e.target.value };
                            setCustomFields(next);
                          }}
                          className="px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded"
                        />
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() =>
                              setCustomFields(customFields.filter((_, i) => i !== idx))
                            }
                            className="p-1.5 text-zinc-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Sections Overview */}
              <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold">Report Sections</h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('narrative')}
                    className="text-xs font-semibold text-[#3061d0] dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Manage All Sections →
                  </button>
                </div>
                {sections.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    No narrative sections added yet. Switch to Narrative Sections to add modular dossier chapters.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {sections.map((sec) => (
                      <li
                        key={sec.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-medium"
                      >
                        <span className="truncate">
                          <span className="font-mono-tabular text-zinc-400 mr-2">
                            {String(sec.order).padStart(2, '0')}.
                          </span>
                          {sec.title}
                        </span>
                        <span
                          className={`text-[11px] font-semibold shrink-0 ${
                            sec.isPublic
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-zinc-500'
                          }`}
                        >
                          {sec.isPublic ? 'Published' : 'Private'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {activeTab === 'timeline' && (
            <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Chronological Timeline of Events</h3>
              </div>

              {canEdit && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!evtDate.trim() || !evtTitle.trim()) return;
                    await createTimelineEvent({
                      caseId: caseRecord.id,
                      ownerId: userId,
                      date: evtDate.trim(),
                      time: evtTime.trim() || undefined,
                      title: evtTitle.trim(),
                      description: evtDesc.trim(),
                      isPublic: evtPublic,
                    });
                    setEvtDate('');
                    setEvtTime('');
                    setEvtTitle('');
                    setEvtDesc('');
                  }}
                  className="p-4 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3"
                >
                  <div className="text-xs font-bold">Add Timeline Event</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      required
                      value={evtDate}
                      onChange={(e) => setEvtDate(e.target.value)}
                      placeholder="Date (e.g. 2021-03-07)"
                      className="px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded"
                    />
                    <input
                      type="text"
                      value={evtTime}
                      onChange={(e) => setEvtTime(e.target.value)}
                      placeholder="Time (e.g. 14:22)"
                      className="px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded"
                    />
                    <input
                      type="text"
                      required
                      value={evtTitle}
                      onChange={(e) => setEvtTitle(e.target.value)}
                      placeholder="Event title *"
                      className="px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={evtDesc}
                    onChange={(e) => setEvtDesc(e.target.value)}
                    placeholder="Event details & citations..."
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded"
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={evtPublic}
                        onChange={(e) => setEvtPublic(e.target.checked)}
                      />
                      <span>Include on Public Site</span>
                    </label>
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-[#3061d0] text-white cursor-pointer"
                    >
                      + Add Event
                    </button>
                  </div>
                </form>
              )}

              {timeline.length === 0 ? (
                <p className="text-xs text-zinc-500">No timeline events recorded yet.</p>
              ) : (
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {timeline.map((ev) => (
                    <div key={ev.id} className="py-3.5 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono-tabular font-semibold text-[#3061d0] dark:text-blue-400">
                            {ev.date} {ev.time ? `· ${ev.time}` : ''}
                          </span>
                          <StatusLabel status={ev.isPublic ? 'Public' : 'Private'} />
                        </div>
                        <div className="text-sm font-bold">{ev.title}</div>
                        {ev.description && (
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            {ev.description}
                          </p>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              updateTimelineEvent(caseRecord.id, ev.id, {
                                isPublic: !ev.isPublic,
                              })
                            }
                            className="px-2 py-1 text-[11px] font-semibold rounded border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                          >
                            {ev.isPublic ? 'Make Private' : 'Make Public'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTimelineEvent(caseRecord.id, ev.id)}
                            className="p-1 text-zinc-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'actors' && (
            <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-5">
              <h3 className="text-sm font-bold">Key Actors, Entities &amp; Counsel Matrix</h3>

              {canEdit && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!actorName.trim() || !actorRole.trim()) return;
                    await createCaseActor({
                      caseId: caseRecord.id,
                      ownerId: userId,
                      name: actorName.trim(),
                      role: actorRole.trim(),
                      organization: actorOrg.trim() || undefined,
                      notes: actorNotes.trim() || undefined,
                      isPublic: actorPublic,
                    });
                    setActorName('');
                    setActorRole('');
                    setActorOrg('');
                    setActorNotes('');
                  }}
                  className="p-4 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      required
                      value={actorName}
                      onChange={(e) => setActorName(e.target.value)}
                      placeholder="Full Name / Entity *"
                      className="px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded"
                    />
                    <input
                      type="text"
                      required
                      value={actorRole}
                      onChange={(e) => setActorRole(e.target.value)}
                      placeholder="Role (e.g. Presiding Judge) *"
                      className="px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded"
                    />
                    <input
                      type="text"
                      value={actorOrg}
                      onChange={(e) => setActorOrg(e.target.value)}
                      placeholder="Organization / Court"
                      className="px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded"
                    />
                  </div>
                  <input
                    type="text"
                    value={actorNotes}
                    onChange={(e) => setActorNotes(e.target.value)}
                    placeholder="Notes on involvement..."
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded"
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={actorPublic}
                        onChange={(e) => setActorPublic(e.target.checked)}
                      />
                      <span>Include on Public Site</span>
                    </label>
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-[#3061d0] text-white cursor-pointer"
                    >
                      + Add Actor
                    </button>
                  </div>
                </form>
              )}

              {actors.length === 0 ? (
                <p className="text-xs text-zinc-500">No actors recorded yet.</p>
              ) : (
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {actors.map((act) => (
                    <div key={act.id} className="py-3 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{act.name}</span>
                          <StatusLabel status={act.isPublic ? 'Public' : 'Private'} />
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {act.role}
                          {act.organization ? ` · ${act.organization}` : ''}
                        </div>
                        {act.notes && (
                          <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">
                            {act.notes}
                          </p>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              updateCaseActor(caseRecord.id, act.id, {
                                isPublic: !act.isPublic,
                              })
                            }
                            className="px-2 py-1 text-[11px] font-semibold rounded border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                          >
                            {act.isPublic ? 'Make Private' : 'Make Public'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCaseActor(caseRecord.id, act.id)}
                            className="p-1 text-zinc-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'narrative' && (
            <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-bold">Narrative &amp; Dossier Sections</h3>
                {canEdit && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newSectionTitle.trim()) return;
                      const newId = await createCaseSection({
                        caseId: caseRecord.id,
                        ownerId: userId,
                        order: sections.length + 1,
                        title: newSectionTitle.trim(),
                        content: '',
                        isPublic: true,
                      });
                      setNewSectionTitle('');
                      setEditingSectionId(newId);
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={newSectionTitle}
                      onChange={(e) => setNewSectionTitle(e.target.value)}
                      placeholder="New section title..."
                      className="px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-[#3061d0] text-white cursor-pointer"
                    >
                      + Add Section
                    </button>
                  </form>
                )}
              </div>

              {sections.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Add modular narrative sections to build the complete case dossier and public report.
                </p>
              ) : (
                <div className="space-y-3">
                  {sections.map((sec, idx) => {
                    const isEditing = editingSectionId === sec.id;
                    return (
                      <div
                        key={sec.id}
                        className="border border-zinc-200 dark:border-zinc-800 rounded-md p-4 bg-zinc-50/70 dark:bg-zinc-900/50 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono-tabular text-xs font-bold text-[#3061d0]">
                              {String(sec.order).padStart(2, '0')}.
                            </span>
                            {isEditing && canEdit ? (
                              <input
                                type="text"
                                defaultValue={sec.title}
                                onBlur={(e) =>
                                  void updateCaseSection(caseRecord.id, sec.id, {
                                    title: e.target.value,
                                  })
                                }
                                className="px-2 py-1 text-sm font-bold bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded"
                              />
                            ) : (
                              <span className="text-sm font-bold truncate">{sec.title}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <StatusLabel status={sec.isPublic ? 'Published' : 'Private'} />
                            {canEdit && (
                              <>
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={async () => {
                                    const prev = sections[idx - 1];
                                    await updateCaseSection(caseRecord.id, sec.id, {
                                      order: prev.order,
                                    });
                                    await updateCaseSection(caseRecord.id, prev.id, {
                                      order: sec.order,
                                    });
                                  }}
                                  className="p-1 text-zinc-400 hover:text-zinc-900 disabled:opacity-30 cursor-pointer"
                                  title="Move up"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === sections.length - 1}
                                  onClick={async () => {
                                    const next = sections[idx + 1];
                                    await updateCaseSection(caseRecord.id, sec.id, {
                                      order: next.order,
                                    });
                                    await updateCaseSection(caseRecord.id, next.id, {
                                      order: sec.order,
                                    });
                                  }}
                                  className="p-1 text-zinc-400 hover:text-zinc-900 disabled:opacity-30 cursor-pointer"
                                  title="Move down"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void updateCaseSection(caseRecord.id, sec.id, {
                                      isPublic: !sec.isPublic,
                                    })
                                  }
                                  className="px-2 py-1 text-[11px] font-semibold rounded border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                                >
                                  {sec.isPublic ? 'Hide' : 'Publish'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingSectionId(isEditing ? null : sec.id)
                                  }
                                  className="px-2 py-1 text-[11px] font-semibold rounded bg-[#3061d0] text-white cursor-pointer"
                                >
                                  {isEditing ? 'Done' : 'Edit'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteCaseSection(caseRecord.id, sec.id)}
                                  className="p-1 text-zinc-400 hover:text-red-500 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {isEditing && canEdit ? (
                          <textarea
                            rows={6}
                            defaultValue={sec.content}
                            onBlur={(e) =>
                              void updateCaseSection(caseRecord.id, sec.id, {
                                content: e.target.value,
                              })
                            }
                            placeholder="Write section narrative, legal analysis, or factual findings..."
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded outline-none focus:border-[#3061d0]"
                          />
                        ) : (
                          <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                            {sec.content || 'Empty section — click Edit to add content.'}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-bold">Case Documents</h3>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    {unlinkedDocs.length > 0 && (
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const item = unlinkedDocs.find((x) => x.id === e.target.value);
                          if (item) {
                            void updateVaultItem(item, {
                              caseIds: [...item.caseIds, caseRecord.id],
                            });
                          }
                          e.target.value = '';
                        }}
                        className="px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded"
                      >
                        <option value="">+ Link from Vault...</option>
                        {unlinkedDocs.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.title}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => quickDocRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[#3061d0] text-white cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Document</span>
                    </button>
                    <input
                      ref={quickDocRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleQuickUpload(f, 'document');
                      }}
                    />
                  </div>
                )}
              </div>

              {linkedDocs.length === 0 ? (
                <p className="text-xs text-zinc-500">No documents linked to this case yet.</p>
              ) : (
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {linkedDocs.map((d) => (
                    <div key={d.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{d.title}</div>
                          <div className="text-[11px] text-zinc-500">
                            {d.docType || d.mediaType.toUpperCase()} · SHA-256{' '}
                            {d.sha256 ? `${d.sha256.slice(0, 12)}…` : 'Note'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusLabel status={d.isPublic ? 'Public' : 'Private'} />
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() =>
                              void updateVaultItem(d, { isPublic: !d.isPublic })
                            }
                            className="px-2 py-1 text-[11px] font-semibold rounded border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                          >
                            {d.isPublic ? 'Make Private' : 'Make Public'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'evidence' && (
            <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-bold">Case Evidence &amp; Collections</h3>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    {unlinkedEvidence.length > 0 && (
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const item = unlinkedEvidence.find((x) => x.id === e.target.value);
                          if (item) {
                            void updateVaultItem(item, {
                              caseIds: [...item.caseIds, caseRecord.id],
                            });
                          }
                          e.target.value = '';
                        }}
                        className="px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded"
                      >
                        <option value="">+ Link from Library...</option>
                        {unlinkedEvidence.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.title}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => quickEvRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[#3061d0] text-white cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Evidence</span>
                    </button>
                    <input
                      ref={quickEvRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleQuickUpload(f, 'evidence');
                      }}
                    />
                  </div>
                )}
              </div>

              {linkedCollections.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Assigned Collections
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {linkedCollections.map((col) => (
                      <div
                        key={col.id}
                        className="p-3.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-bold flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-[#3061d0]" />
                            {col.title}
                          </span>
                          <StatusLabel status={col.isPublic ? 'Public' : 'Private'} />
                        </div>
                        <p className="text-[11px] text-zinc-500 line-clamp-2">
                          {col.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {linkedEvidence.length === 0 ? (
                <p className="text-xs text-zinc-500">No evidence items linked to this case yet.</p>
              ) : (
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {linkedEvidence.map((item) => (
                    <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{item.title}</div>
                        <div className="text-[11px] text-zinc-500 font-mono-tabular">
                          {item.mediaType.toUpperCase()}
                          {item.tags.length ? ` · ${item.tags.join(', ')}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusLabel status={item.isPublic ? 'Public' : 'Private'} />
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() =>
                              void updateVaultItem(item, { isPublic: !item.isPublic })
                            }
                            className="px-2 py-1 text-[11px] font-semibold rounded border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                          >
                            {item.isPublic ? 'Make Private' : 'Make Public'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-5">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#3061d0]" />
                <h3 className="text-sm font-bold">Stakeholder Access &amp; Permissions (RBAC)</h3>
              </div>

              {isOwnerOrAdmin && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!collabEmail.trim()) return;
                    const matchedUser = workspaceUsers.find(
                      (u) => u.email.toLowerCase() === collabEmail.trim().toLowerCase()
                    );
                    await addCaseCollaborator({
                      caseRecord,
                      ownerId: userId,
                      email: collabEmail.trim(),
                      role: collabRole,
                      knownUid: matchedUser?.uid,
                    });
                    setCollabEmail('');
                    showFlash('Stakeholder permission added.');
                  }}
                  className="p-4 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row gap-2.5"
                >
                  <input
                    type="email"
                    required
                    value={collabEmail}
                    onChange={(e) => setCollabEmail(e.target.value)}
                    placeholder="stakeholder@organization.org"
                    className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded"
                  />
                  <select
                    value={collabRole}
                    onChange={(e) => setCollabRole(e.target.value as CaseCollaboratorRole)}
                    className="px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded"
                  >
                    <option value="editor">Editor (Edit &amp; Add)</option>
                    <option value="reviewer">Reviewer (Read &amp; Export)</option>
                    <option value="viewer">Viewer (Read Only)</option>
                  </select>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded bg-[#3061d0] text-white cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Grant Access</span>
                  </button>
                </form>
              )}

              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                <div className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold">Case Owner</span>
                    <span className="text-zinc-500 ml-2 font-mono-tabular">
                      {caseRecord.ownerId}
                    </span>
                  </div>
                  <StatusLabel status="Owner" />
                </div>
                {collaborators.map((col) => (
                  <div key={col.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold">{col.email}</span>
                      <span className="ml-2 text-zinc-500 capitalize">({col.role})</span>
                    </div>
                    {isOwnerOrAdmin && (
                      <button
                        type="button"
                        onClick={() => void removeCaseCollaborator(caseRecord, col)}
                        className="text-red-600 hover:underline cursor-pointer"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'public_builder' && (
            <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#3061d0]" />
                    <span>Public Site Builder</span>
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Pulls all Public sections, timeline events, actors, documents, evidence, and collections into one standalone public URL.
                  </p>
                </div>
                <StatusLabel status={caseRecord.isPublished ? 'Published' : 'Unpublished'} />
              </div>

              {/* Shareable URL Box */}
              <div className="p-4 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-0.5">
                    Generated Public Site URL
                  </div>
                  <div className="font-mono-tabular text-xs font-semibold text-[#3061d0] dark:text-blue-400 truncate">
                    {shareableUrl}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(shareableUrl);
                      setCopiedUrl(true);
                      setTimeout(() => setCopiedUrl(false), 1800);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 cursor-pointer"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'Copied' : 'Copy URL'}</span>
                  </button>
                  {caseRecord.isPublished && (
                    <button
                      type="button"
                      onClick={() => onOpenPublicSite(caseRecord.publicSlug)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Site</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    disabled={!isOwnerOrAdmin}
                    value={form.publicSlug}
                    onChange={(e) => setForm({ ...form, publicSlug: slugify(e.target.value) })}
                    className="w-full px-3 py-2 text-xs font-mono-tabular bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                    Hero Cover Image
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.publicCoverUrl}
                      onChange={(e) => setForm({ ...form, publicCoverUrl: e.target.value })}
                      className="flex-1 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md"
                    />
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() => coverFileRef.current?.click()}
                          className="px-3 py-2 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                        >
                          Upload
                        </button>
                        <input
                          ref={coverFileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const uploaded = await uploadEncryptedVaultFile(f, true);
                            setForm({
                              ...form,
                              publicCoverUrl: `vault://${uploaded.fileId}`,
                            });
                          }}
                        />
                      </>
                    )}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                    Public Site Headline
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={form.publicHeadline}
                    onChange={(e) => setForm({ ...form, publicHeadline: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                    Public Subtitle
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={form.publicSubtitle}
                    onChange={(e) => setForm({ ...form, publicSubtitle: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                    Public Dossier Introduction
                  </label>
                  <textarea
                    rows={4}
                    disabled={!canEdit}
                    value={form.publicIntro}
                    onChange={(e) => setForm({ ...form, publicIntro: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md"
                  />
                </div>
              </div>

              {/* Public Content Inclusion Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2">
                {[
                  ['Public Sections', sections.filter((s) => s.isPublic).length],
                  ['Timeline Events', timeline.filter((t) => t.isPublic).length],
                  ['Public Actors', actors.filter((a) => a.isPublic).length],
                  ['Public Docs', linkedDocs.filter((d) => d.isPublic).length],
                  ['Public Evidence', linkedEvidence.filter((e) => e.isPublic).length],
                ].map(([label, count]) => (
                  <div
                    key={String(label)}
                    className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      {label}
                    </div>
                    <div className="text-lg font-bold tabular-nums mt-0.5">{count}</div>
                  </div>
                ))}
              </div>

              {isOwnerOrAdmin && (
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-zinc-500 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-[#3061d0]" />
                    <span>Only items explicitly marked Public are synced to the public URL.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {caseRecord.isPublished && (
                      <button
                        type="button"
                        onClick={handleUnpublish}
                        disabled={publishing}
                        className="px-3.5 py-2 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        Unpublish
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handlePublish}
                      disabled={publishing}
                      className="px-4 py-2 text-xs font-semibold rounded-md bg-[#3061d0] text-white hover:bg-[#2752b4] disabled:opacity-50 cursor-pointer"
                    >
                      {publishing
                        ? 'Publishing...'
                        : caseRecord.isPublished
                        ? 'Republish Updates'
                        : 'Publish Public Site'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Actions Panel (matches prototype) */}
        <aside className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-1">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-2 pb-2">
            Actions
          </h4>
          {canEdit && (
            <button
              type="button"
              onClick={handleSaveMetadata}
              className="w-full text-left px-2.5 py-2 text-xs font-medium rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Update Case
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              exportCasePdf({
                caseRecord,
                sections,
                timeline,
                actors,
                vaultItems,
                collections,
                options: DEFAULT_COMPLETE_REPORT_OPTIONS,
              })
            }
            className="w-full text-left px-2.5 py-2 text-xs font-medium rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            Export Complete PDF
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('public_builder')}
            className="w-full text-left px-2.5 py-2 text-xs font-medium rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            Public Site Builder
          </button>
          {isOwnerOrAdmin && (
            <button
              type="button"
              onClick={caseRecord.isPublished ? handleUnpublish : handlePublish}
              className="w-full text-left px-2.5 py-2 text-xs font-medium rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              {caseRecord.isPublished ? 'Unpublish Site' : 'Publish Site'}
            </button>
          )}
          <hr className="border-zinc-200 dark:border-zinc-800 my-2" />
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className="w-full text-left px-2.5 py-2 text-xs font-medium rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            + Add Timeline Event
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className="w-full text-left px-2.5 py-2 text-xs font-medium rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            + Link / Upload Document
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('evidence')}
            className="w-full text-left px-2.5 py-2 text-xs font-medium rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            + Link / Add Evidence
          </button>
          {isOwnerOrAdmin && (
            <>
              <hr className="border-zinc-200 dark:border-zinc-800 my-2" />
              <button
                type="button"
                onClick={async () => {
                  await deleteCaseRecord(caseRecord.id);
                  onBack();
                }}
                className="w-full text-left px-2.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
              >
                Delete Case
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
};
