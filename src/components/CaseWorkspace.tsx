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
  Network,
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
import { buildSingleCaseFromWorkspace } from '../utils/nexusEngine';
import { inferMediaType, uploadEncryptedVaultFile } from '../utils/vaultApi';
import { StatusLabel } from './BrandMark';
import { NexusMapView } from './NexusMapView';

type CaseTab =
  | 'overview'
  | 'timeline'
  | 'actors'
  | 'narrative'
  | 'documents'
  | 'evidence'
  | 'nexus'
  | 'permissions'
  | 'public_builder';

const DEFAULT_COVER_URL =
  '/assets/aistudio/kanhaiya-sharma-EiAqej-cGks-unsplash_c5de0270.jpg';

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
  onLiveCaseDraftChange?: (caseId: string, draft: Partial<CaseRecord>) => void;
  onClearLiveCaseDraft?: (caseId: string) => void;
}

function parseTagsInput(raw: string): string[] {
  const seen = new Set<string>();
  const parsed: string[] = [];
  for (const part of raw.split(/[,\n]+/)) {
    const cleaned = part.replace(/^#+/, '').trim().slice(0, 100);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parsed.push(cleaned);
    if (parsed.length >= 20) break;
  }
  return parsed;
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
  onLiveCaseDraftChange,
  onClearLiveCaseDraft,
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
    publicCoverUrl: caseRecord.publicCoverUrl || DEFAULT_COVER_URL,
  });
  const [customFields, setCustomFields] = useState<CustomField[]>(caseRecord.customFields || []);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

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

  const lastCaseIdRef = useRef<string>(caseRecord.id);
  const [hasUnsavedDraft, setHasUnsavedDraft] = useState(false);

  const parsedTags = useMemo(() => parseTagsInput(form.tags), [form.tags]);

  useEffect(() => {
    const caseChanged = lastCaseIdRef.current !== caseRecord.id;
    if (!caseChanged && hasUnsavedDraft) {
      return;
    }
    lastCaseIdRef.current = caseRecord.id;
    setHasUnsavedDraft(false);
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
      publicCoverUrl: caseRecord.publicCoverUrl || DEFAULT_COVER_URL,
    });
    setCustomFields(caseRecord.customFields || []);
  }, [caseRecord, hasUnsavedDraft]);

  useEffect(() => {
    if (!hasUnsavedDraft || !onLiveCaseDraftChange) return;
    onLiveCaseDraftChange(caseRecord.id, {
      caseNumber: form.caseNumber || caseRecord.caseNumber,
      title: form.title || caseRecord.title,
      caseType: form.caseType as CaseType,
      court: form.court,
      judge: form.judge,
      charge: form.charge,
      arrestDates: form.arrestDates,
      closureDate: form.closureDate,
      status: form.status as CaseStatus,
      disposition: form.disposition,
      summary: form.summary,
      tags: parsedTags,
      customFields: customFields.filter((cf) => cf.label.trim() && cf.value.trim()),
      publicSlug: form.publicSlug,
      publicHeadline: form.publicHeadline,
      publicSubtitle: form.publicSubtitle,
      publicIntro: form.publicIntro,
      publicCoverUrl: form.publicCoverUrl,
    });
  }, [
    hasUnsavedDraft,
    caseRecord.id,
    caseRecord.caseNumber,
    caseRecord.title,
    form,
    parsedTags,
    customFields,
    onLiveCaseDraftChange,
  ]);

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

  const caseNexusGraph = useMemo(
    () =>
      buildSingleCaseFromWorkspace({
        caseRecord: {
          ...caseRecord,
          title: form.title || caseRecord.title,
          caseNumber: form.caseNumber || caseRecord.caseNumber,
          court: form.court,
          judge: form.judge,
          charge: form.charge,
          status: form.status as CaseStatus,
          disposition: form.disposition,
          customFields: customFields.filter((cf) => cf.label.trim() && cf.value.trim()),
          tags: parsedTags,
        },
        sections,
        timeline,
        actors,
        vaultItems,
        collections,
      }),
    [caseRecord, form, customFields, parsedTags, sections, timeline, actors, vaultItems, collections]
  );

  const showFlash = (msg: string) => {
    setSaveNotice(msg);
    setTimeout(() => setSaveNotice(null), 2600);
  };

  const updateFormField = (patch: Partial<typeof form>) => {
    setHasUnsavedDraft(true);
    setForm((prev) => ({ ...prev, ...patch }));
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
        tags: parsedTags,
        publicSlug: slugify(form.publicSlug),
        publicHeadline: form.publicHeadline,
        publicSubtitle: form.publicSubtitle,
        publicIntro: form.publicIntro,
        publicCoverUrl: form.publicCoverUrl,
      });
      setHasUnsavedDraft(false);
      onClearLiveCaseDraft?.(caseRecord.id);
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
        tags: parsedTags,
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

  const inputClass =
    'w-full px-2.5 py-2 text-[13px] bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] text-[#0f1210] dark:text-[#f3f0e9] outline-none focus:border-[#b5b0a4] dark:focus:border-[#6a716b]';
  const labelClass =
    'block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] dark:text-[#8d948e] mb-1';

  return (
    <div className="space-y-4">
      {/* Case Header Card */}
      <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6a716b] dark:text-[#8d948e] mb-2">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="hover:text-[#0f1210] dark:hover:text-[#f3f0e9] cursor-pointer"
            >
              Cases
            </button>
            <span className="mx-1.5">/</span>
            <span className="font-mono-tabular">{caseRecord.caseNumber}</span>
          </div>
          {saveNotice && (
            <span className="text-xs font-medium text-[#2d5a3d] dark:text-[#7fb892]">
              {saveNotice}
            </span>
          )}
        </div>

        <h1 className="text-lg font-semibold tracking-[-0.02em] text-[#0f1210] dark:text-[#f3f0e9] leading-snug mb-1">
          {caseRecord.title}
        </h1>

        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#6a716b] dark:text-[#8d948e]">
          <span>
            Case No. <code className="font-mono-tabular text-xs">{caseRecord.caseNumber}</code>
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

        <div className="flex flex-wrap items-center gap-2 mt-3.5">
          {caseRecord.isPublished ? (
            <button
              type="button"
              onClick={() => onOpenPublicSite(caseRecord.publicSlug)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] bg-transparent hover:border-[#0f1210] cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Preview Public</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('public_builder')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] bg-transparent hover:border-[#0f1210] cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Configure Public Site</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('nexus')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] bg-transparent hover:border-[#0f1210] cursor-pointer"
          >
            <Network className="w-3.5 h-3.5 text-[#2d5a3d] dark:text-[#7fb892]" />
            <span>Nexus Map ({caseNexusGraph.edges.length})</span>
          </button>

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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] bg-transparent hover:border-[#0f1210] cursor-pointer"
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] bg-transparent hover:border-[#0f1210] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={handleSaveMetadata}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] hover:opacity-85 disabled:opacity-60 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving…' : 'Save'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#ddd8ce] dark:border-[#262b27] overflow-x-auto">
        {(
          [
            ['overview', 'Overview'],
            ['timeline', `Timeline (${timeline.length})`],
            ['actors', `Actors (${actors.length})`],
            ['narrative', `Narrative Sections (${sections.length})`],
            ['documents', `Documents (${linkedDocs.length})`],
            ['evidence', `Evidence (${linkedEvidence.length})`],
            ['nexus', `Nexus Map (${caseNexusGraph.edges.length})`],
            ['permissions', 'Stakeholder Roles'],
            ['public_builder', 'Public Settings'],
          ] as Array<[CaseTab, string]>
        ).map(([tabKey, label]) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setActiveTab(tabKey)}
            className={`px-3.5 py-2.5 text-[13px] whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
              activeTab === tabKey
                ? 'border-[#0f1210] dark:border-[#f3f0e9] text-[#0f1210] dark:text-[#f3f0e9] font-medium'
                : 'border-transparent text-[#6a716b] dark:text-[#8d948e] hover:text-[#0f1210] dark:hover:text-[#f3f0e9]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content + Right Actions Rail */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_205px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          {activeTab === 'overview' && (
            <>
              <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-[18px]">
                <h3 className="text-[13px] font-semibold mb-3.5">Case Metadata</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Case Number</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.caseNumber}
                      onChange={(e) => updateFormField({ caseNumber: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Classification</label>
                    <select
                      disabled={!canEdit}
                      value={form.caseType}
                      onChange={(e) =>
                        updateFormField({ caseType: e.target.value as CaseType })
                      }
                      className={inputClass}
                    >
                      <option value="legal">Legal Case</option>
                      <option value="investigation">Investigation</option>
                      <option value="project">Research / Project</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Caption / Title</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.title}
                      onChange={(e) => updateFormField({ title: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Jurisdiction / Court / Org</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.court}
                      onChange={(e) => updateFormField({ court: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Presiding Judge / Lead</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.judge}
                      onChange={(e) => updateFormField({ judge: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Alleged Cause / Charge</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.charge}
                      onChange={(e) => updateFormField({ charge: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Status</label>
                    <select
                      disabled={!canEdit}
                      value={form.status}
                      onChange={(e) =>
                        updateFormField({ status: e.target.value as CaseStatus })
                      }
                      className={inputClass}
                    >
                      <option value="Active">Active</option>
                      <option value="In Review">In Review</option>
                      <option value="Draft">Draft</option>
                      <option value="Dismissed">Dismissed</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Arrest / Key Dates</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.arrestDates}
                      onChange={(e) => updateFormField({ arrestDates: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Official Closure Date</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.closureDate}
                      onChange={(e) => updateFormField({ closureDate: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Final Disposition / Outcome</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.disposition}
                      onChange={(e) => updateFormField({ disposition: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>
                      Case Tags (comma-separated — no # required; updates Nexus Map live)
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.tags}
                      onChange={(e) => updateFormField({ tags: e.target.value })}
                      placeholder="e.g. Procedural Due Process Failure, Information asymmetry, Failure to disclose"
                      className={inputClass}
                    />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6a716b] dark:text-[#8d948e]">
                      <span>
                        <strong className="font-mono-tabular text-[#0f1210] dark:text-[#f3f0e9]">
                          {parsedTags.length}/20
                        </strong>{' '}
                        {parsedTags.length === 1 ? 'tag' : 'tags'} active in Nexus
                        {hasUnsavedDraft && ' · Unsaved draft (click Save to persist)'}
                      </span>
                      <div className="flex items-center gap-3">
                        {hasUnsavedDraft && canEdit && (
                          <button
                            type="button"
                            onClick={handleSaveMetadata}
                            disabled={saving}
                            className="font-medium text-[#0f1210] dark:text-[#f3f0e9] underline underline-offset-4 cursor-pointer"
                          >
                            {saving ? 'Saving…' : 'Save Tags'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveTab('nexus')}
                          className="font-medium text-[#2d5a3d] dark:text-[#7fb892] hover:underline underline-offset-4 cursor-pointer"
                        >
                          View on Nexus Map →
                        </button>
                      </div>
                    </div>
                    {parsedTags.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-[#e9e5db] dark:border-[#242924] flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
                        {parsedTags.map((tag, i) => (
                          <React.Fragment key={`${tag}-${i}`}>
                            {i > 0 && <span className="text-[#c4bfb4] dark:text-[#3b423c]">·</span>}
                            <button
                              type="button"
                              onClick={() => setActiveTab('nexus')}
                              className="text-[#8b3a3a] dark:text-[#e39b9b] hover:underline underline-offset-2 text-left cursor-pointer"
                            >
                              #{tag}
                            </button>
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Executive Summary</label>
                    <textarea
                      rows={4}
                      disabled={!canEdit}
                      value={form.summary}
                      onChange={(e) => updateFormField({ summary: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Custom Metadata Fields */}
              <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-[18px]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-semibold">Custom Fields</h3>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setHasUnsavedDraft(true);
                        setCustomFields([...customFields, { label: '', value: '' }]);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border border-[#ddd8ce] dark:border-[#262b27] hover:border-[#0f1210] cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Custom Field</span>
                    </button>
                  )}
                </div>
                {customFields.length === 0 ? (
                  <p className="text-xs text-[#6a716b]">
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
                            setHasUnsavedDraft(true);
                            setCustomFields(next);
                          }}
                          className="px-2.5 py-1.5 text-xs bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27]"
                        />
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={cf.value}
                          placeholder="Value"
                          onChange={(e) => {
                            const next = [...customFields];
                            next[idx] = { ...next[idx], value: e.target.value };
                            setHasUnsavedDraft(true);
                            setCustomFields(next);
                          }}
                          className="px-2.5 py-1.5 text-xs bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27]"
                        />
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              setHasUnsavedDraft(true);
                              setCustomFields(customFields.filter((_, i) => i !== idx));
                            }}
                            className="p-1.5 text-[#6a716b] hover:text-[#8b3a3a] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Report Sections Quick Overview */}
              <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-[18px]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-semibold">Report Sections</h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('narrative')}
                    className="text-xs font-medium text-[#2d5a3d] dark:text-[#7fb892] hover:underline cursor-pointer"
                  >
                    + Manage Sections
                  </button>
                </div>
                {sections.length === 0 ? (
                  <p className="text-xs text-[#6a716b]">
                    No narrative sections added yet. Switch to Narrative Sections to add modular dossier chapters.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {sections.map((sec) => (
                      <li
                        key={sec.id}
                        className="flex items-center gap-2.5 px-2.5 py-2 border border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9] dark:bg-[#0c0e0c] text-[13px]"
                      >
                        <span className="text-[#6a716b] text-xs select-none">⠿</span>
                        <span className="truncate">
                          <span className="font-mono-tabular text-xs text-[#6a716b] mr-1.5">
                            {String(sec.order).padStart(2, '0')}.
                          </span>
                          {sec.title}
                        </span>
                        <span
                          className={`ml-auto text-[11px] shrink-0 ${
                            sec.isPublic
                              ? 'text-[#2d5a3d] dark:text-[#7fb892]'
                              : 'text-[#6a716b]'
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
            <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-[18px] space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold">Chronological Timeline of Events</h3>
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
                  className="p-4 bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] space-y-3"
                >
                  <div className="text-xs font-semibold">Add Timeline Event</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      required
                      value={evtDate}
                      onChange={(e) => setEvtDate(e.target.value)}
                      placeholder="Date (e.g. 2021-03-07)"
                      className="px-2.5 py-1.5 text-xs bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27]"
                    />
                    <input
                      type="text"
                      value={evtTime}
                      onChange={(e) => setEvtTime(e.target.value)}
                      placeholder="Time (e.g. 14:22)"
                      className="px-2.5 py-1.5 text-xs bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27]"
                    />
                    <input
                      type="text"
                      required
                      value={evtTitle}
                      onChange={(e) => setEvtTitle(e.target.value)}
                      placeholder="Event title *"
                      className="px-2.5 py-1.5 text-xs bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27]"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={evtDesc}
                    onChange={(e) => setEvtDesc(e.target.value)}
                    placeholder="Event details & citations…"
                    className="w-full px-2.5 py-1.5 text-xs bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27]"
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
                      className="px-3 py-1.5 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] cursor-pointer"
                    >
                      + Add Event
                    </button>
                  </div>
                </form>
              )}

              {timeline.length === 0 ? (
                <p className="text-xs text-[#6a716b]">No timeline events recorded yet.</p>
              ) : (
                <div className="divide-y divide-[#e9e5db] dark:divide-[#242924]">
                  {timeline.map((ev) => (
                    <div key={ev.id} className="py-3.5 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono-tabular font-medium text-[#2d5a3d] dark:text-[#7fb892]">
                            {ev.date} {ev.time ? `· ${ev.time}` : ''}
                          </span>
                          <StatusLabel status={ev.isPublic ? 'Public' : 'Private'} />
                        </div>
                        <div className="text-[13px] font-semibold">{ev.title}</div>
                        {ev.description && (
                          <p className="text-xs text-[#6a716b] dark:text-[#8d948e] leading-relaxed">
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
                            className="px-2 py-1 text-[11px] font-medium border border-[#ddd8ce] dark:border-[#262b27] cursor-pointer"
                          >
                            {ev.isPublic ? 'Make Private' : 'Make Public'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTimelineEvent(caseRecord.id, ev.id)}
                            className="p-1 text-[#6a716b] hover:text-[#8b3a3a] cursor-pointer"
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
            <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-[18px] space-y-5">
              <h3 className="text-[13px] font-semibold">Key Actors, Entities &amp; Counsel Matrix</h3>

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
                  className="p-4 bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      required
                      value={actorName}
                      onChange={(e) => setActorName(e.target.value)}
                      placeholder="Full Name / Entity *"
                      className="px-2.5 py-1.5 text-xs bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27]"
                    />
                    <input
                      type="text"
                      required
                      value={actorRole}
                      onChange={(e) => setActorRole(e.target.value)}
                      placeholder="Role (e.g. Presiding Judge) *"
                      className="px-2.5 py-1.5 text-xs bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27]"
                    />
                    <input
                      type="text"
                      value={actorOrg}
                      onChange={(e) => setActorOrg(e.target.value)}
                      placeholder="Organization / Court"
                      className="px-2.5 py-1.5 text-xs bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27]"
                    />
                  </div>
                  <input
                    type="text"
                    value={actorNotes}
                    onChange={(e) => setActorNotes(e.target.value)}
                    placeholder="Notes on involvement…"
                    className="w-full px-2.5 py-1.5 text-xs bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27]"
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
                      className="px-3 py-1.5 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] cursor-pointer"
                    >
                      + Add Actor
                    </button>
                  </div>
                </form>
              )}

              {actors.length === 0 ? (
                <p className="text-xs text-[#6a716b]">No actors recorded yet.</p>
              ) : (
                <div className="divide-y divide-[#e9e5db] dark:divide-[#242924]">
                  {actors.map((act) => (
                    <div key={act.id} className="py-3 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold">{act.name}</span>
                          <StatusLabel status={act.isPublic ? 'Public' : 'Private'} />
                        </div>
                        <div className="text-xs text-[#6a716b] dark:text-[#8d948e]">
                          {act.role}
                          {act.organization ? ` · ${act.organization}` : ''}
                        </div>
                        {act.notes && (
                          <p className="text-xs text-[#0f1210]/80 dark:text-[#f3f0e9]/80 mt-1">
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
                            className="px-2 py-1 text-[11px] font-medium border border-[#ddd8ce] dark:border-[#262b27] cursor-pointer"
                          >
                            {act.isPublic ? 'Make Private' : 'Make Public'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCaseActor(caseRecord.id, act.id)}
                            className="p-1 text-[#6a716b] hover:text-[#8b3a3a] cursor-pointer"
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
            <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-[18px] space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[13px] font-semibold">Narrative &amp; Dossier Sections</h3>
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
                      placeholder="New section title…"
                      className="px-2.5 py-1.5 text-xs bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27]"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] cursor-pointer"
                    >
                      + Add Section
                    </button>
                  </form>
                )}
              </div>

              {sections.length === 0 ? (
                <p className="text-xs text-[#6a716b]">
                  Add modular narrative sections to build the complete case dossier and public report.
                </p>
              ) : (
                <div className="space-y-3">
                  {sections.map((sec, idx) => {
                    const isEditing = editingSectionId === sec.id;
                    return (
                      <div
                        key={sec.id}
                        className="border border-[#ddd8ce] dark:border-[#262b27] p-4 bg-[#f3f0e9] dark:bg-[#0c0e0c] space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono-tabular text-xs font-medium text-[#2d5a3d] dark:text-[#7fb892]">
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
                                className="px-2 py-1 text-[13px] font-semibold bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27]"
                              />
                            ) : (
                              <span className="text-[13px] font-semibold truncate">{sec.title}</span>
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
                                  className="p-1 text-[#6a716b] hover:text-[#0f1210] disabled:opacity-30 cursor-pointer"
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
                                  className="p-1 text-[#6a716b] hover:text-[#0f1210] disabled:opacity-30 cursor-pointer"
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
                                  className="px-2 py-1 text-[11px] font-medium border border-[#ddd8ce] dark:border-[#262b27] cursor-pointer"
                                >
                                  {sec.isPublic ? 'Hide' : 'Publish'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingSectionId(isEditing ? null : sec.id)
                                  }
                                  className="px-2 py-1 text-[11px] font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] cursor-pointer"
                                >
                                  {isEditing ? 'Done' : 'Edit'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteCaseSection(caseRecord.id, sec.id)}
                                  className="p-1 text-[#6a716b] hover:text-[#8b3a3a] cursor-pointer"
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
                            placeholder="Write section narrative, legal analysis, or factual findings…"
                            className="w-full px-3 py-2 text-[13px] bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                          />
                        ) : (
                          <p className="text-xs text-[#6a716b] dark:text-[#c4bfb4] leading-relaxed whitespace-pre-line">
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
            <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-[18px] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[13px] font-semibold">Case Documents</h3>
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
                        className="px-2.5 py-1.5 text-xs bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27]"
                      >
                        <option value="">+ Link from Vault…</option>
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] cursor-pointer"
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
                <p className="text-xs text-[#6a716b]">No documents linked to this case yet.</p>
              ) : (
                <div className="divide-y divide-[#e9e5db] dark:divide-[#242924]">
                  {linkedDocs.map((d) => (
                    <div key={d.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-[#6a716b] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium truncate">{d.title}</div>
                          <div className="text-[11px] text-[#6a716b] font-mono-tabular">
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
                            className="px-2 py-1 text-[11px] font-medium border border-[#ddd8ce] dark:border-[#262b27] cursor-pointer"
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
            <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-[18px] space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[13px] font-semibold">Case Evidence &amp; Collections</h3>
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
                        className="px-2.5 py-1.5 text-xs bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27]"
                      >
                        <option value="">+ Link from Library…</option>
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] cursor-pointer"
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
                  <div className="text-[10px] uppercase tracking-[0.1em] text-[#6a716b] mb-2">
                    Assigned Collections
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {linkedCollections.map((col) => (
                      <div
                        key={col.id}
                        className="p-3.5 border border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9] dark:bg-[#0c0e0c]"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-[#2d5a3d] dark:text-[#7fb892]" />
                            {col.title}
                          </span>
                          <StatusLabel status={col.isPublic ? 'Public' : 'Private'} />
                        </div>
                        <p className="text-[11px] text-[#6a716b] line-clamp-2">
                          {col.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {linkedEvidence.length === 0 ? (
                <p className="text-xs text-[#6a716b]">No evidence items linked to this case yet.</p>
              ) : (
                <div className="divide-y divide-[#e9e5db] dark:divide-[#242924]">
                  {linkedEvidence.map((item) => (
                    <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium truncate">{item.title}</div>
                        <div className="text-[11px] text-[#6a716b] font-mono-tabular">
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
                            className="px-2 py-1 text-[11px] font-medium border border-[#ddd8ce] dark:border-[#262b27] cursor-pointer"
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

          {activeTab === 'nexus' && (
            <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-[18px]">
              <NexusMapView
                graph={caseNexusGraph}
                compact
                subtitle="Visualizing case metadata (#tags, jurisdiction, lead, subject, custom fields), actors, chronology, and bridged collections across Relationship Web, Axis Matrix, and Time Axis."
                onInspectNodeArtifact={(node) =>
                  setActiveTab(node.kind === 'document' ? 'documents' : 'evidence')
                }
              />
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-[18px] space-y-5">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#2d5a3d] dark:text-[#7fb892]" />
                <h3 className="text-[13px] font-semibold">Stakeholder Access &amp; Permissions (RBAC)</h3>
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
                  className="p-4 bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] flex flex-col sm:flex-row gap-2.5"
                >
                  <input
                    type="email"
                    required
                    value={collabEmail}
                    onChange={(e) => setCollabEmail(e.target.value)}
                    placeholder="stakeholder@organization.org"
                    className="flex-1 px-3 py-1.5 text-xs bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27]"
                  />
                  <select
                    value={collabRole}
                    onChange={(e) => setCollabRole(e.target.value as CaseCollaboratorRole)}
                    className="px-2.5 py-1.5 text-xs bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27]"
                  >
                    <option value="editor">Editor (Edit &amp; Add)</option>
                    <option value="reviewer">Reviewer (Read &amp; Export)</option>
                    <option value="viewer">Viewer (Read Only)</option>
                  </select>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Grant Access</span>
                  </button>
                </form>
              )}

              <div className="divide-y divide-[#e9e5db] dark:divide-[#242924]">
                <div className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold">Case Owner</span>
                    <span className="text-[#6a716b] ml-2 font-mono-tabular">
                      {caseRecord.ownerId}
                    </span>
                  </div>
                  <StatusLabel status="Owner" />
                </div>
                {collaborators.map((col) => (
                  <div key={col.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-medium">{col.email}</span>
                      <span className="ml-2 text-[#6a716b] capitalize">({col.role})</span>
                    </div>
                    {isOwnerOrAdmin && (
                      <button
                        type="button"
                        onClick={() => void removeCaseCollaborator(caseRecord, col)}
                        className="text-[#8b3a3a] hover:underline cursor-pointer"
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
            <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-[18px] space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[13px] font-semibold flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#2d5a3d] dark:text-[#7fb892]" />
                    <span>Public Site Builder</span>
                  </h3>
                  <p className="text-xs text-[#6a716b] dark:text-[#8d948e] mt-0.5">
                    Pulls all Public sections, timeline events, actors, documents, evidence, collections, and visual Nexus mapping into one standalone public URL.
                  </p>
                </div>
                <StatusLabel status={caseRecord.isPublished ? 'Published' : 'Unpublished'} />
              </div>

              <div className="p-4 bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-0.5">
                    Generated Public Site URL
                  </div>
                  <div className="font-mono-tabular text-xs font-medium text-[#2d5a3d] dark:text-[#7fb892] truncate">
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] bg-[#faf8f4] dark:bg-[#161916] cursor-pointer"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-[#2d5a3d]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'Copied' : 'Copy URL'}</span>
                  </button>
                  {caseRecord.isPublished && (
                    <button
                      type="button"
                      onClick={() => onOpenPublicSite(caseRecord.publicSlug)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Site</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className={labelClass}>URL Slug</label>
                  <input
                    type="text"
                    disabled={!isOwnerOrAdmin}
                    value={form.publicSlug}
                    onChange={(e) => setForm({ ...form, publicSlug: slugify(e.target.value) })}
                    className={`${inputClass} font-mono-tabular text-xs`}
                  />
                </div>
                <div>
                  <label className={labelClass}>Hero Cover Image</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.publicCoverUrl}
                      onChange={(e) => setForm({ ...form, publicCoverUrl: e.target.value })}
                      className={inputClass}
                    />
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() => coverFileRef.current?.click()}
                          className="px-3 py-2 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] cursor-pointer shrink-0"
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
                  <label className={labelClass}>Public Site Headline</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={form.publicHeadline}
                    onChange={(e) => setForm({ ...form, publicHeadline: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Public Subtitle</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={form.publicSubtitle}
                    onChange={(e) => setForm({ ...form, publicSubtitle: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Public Dossier Short Description / Introduction</label>
                  <textarea
                    rows={4}
                    disabled={!canEdit}
                    value={form.publicIntro}
                    onChange={(e) => setForm({ ...form, publicIntro: e.target.value })}
                    placeholder="Concise summary displayed on the Public Archive directory card and the dossier site overview…"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
                {[
                  ['Public Sections', sections.filter((s) => s.isPublic).length],
                  ['Timeline Events', timeline.filter((t) => t.isPublic).length],
                  ['Public Actors', actors.filter((a) => a.isPublic).length],
                  ['Public Docs', linkedDocs.filter((d) => d.isPublic).length],
                  ['Public Evidence', linkedEvidence.filter((e) => e.isPublic).length],
                ].map(([label, count]) => (
                  <div
                    key={String(label)}
                    className="p-3 border border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9] dark:bg-[#0c0e0c]"
                  >
                    <div className="text-[10px] uppercase tracking-[0.08em] text-[#6a716b]">
                      {label}
                    </div>
                    <div className="text-lg font-semibold font-mono-tabular mt-0.5">{count}</div>
                  </div>
                ))}
              </div>

              {isOwnerOrAdmin && (
                <div className="pt-3 border-t border-[#ddd8ce] dark:border-[#262b27] flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-[#6a716b] flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-[#2d5a3d] dark:text-[#7fb892]" />
                    <span>Only items explicitly marked Public are synced to the public URL.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {caseRecord.isPublished && (
                      <button
                        type="button"
                        onClick={handleUnpublish}
                        disabled={publishing}
                        className="px-3.5 py-2 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] hover:border-[#0f1210] cursor-pointer"
                      >
                        Unpublish
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handlePublish}
                      disabled={publishing}
                      className="px-4 py-2 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] hover:opacity-85 disabled:opacity-50 cursor-pointer"
                    >
                      {publishing
                        ? 'Publishing…'
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

        {/* Right Actions Panel (matching design artifact) */}
        <aside className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-[18px] space-y-0.5">
          <h4 className="text-[10px] uppercase tracking-[0.1em] text-[#6a716b] pb-2">
            Actions
          </h4>
          {canEdit && (
            <button
              type="button"
              onClick={handleSaveMetadata}
              className="w-full text-left px-2.5 py-2 text-xs hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer"
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
            className="w-full text-left px-2.5 py-2 text-xs hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer"
          >
            Export PDF Report
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('nexus')}
            className="w-full text-left px-2.5 py-2 text-xs hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer"
          >
            View Nexus Map
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('public_builder')}
            className="w-full text-left px-2.5 py-2 text-xs hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer"
          >
            Public Site Builder
          </button>
          {isOwnerOrAdmin && (
            <button
              type="button"
              onClick={caseRecord.isPublished ? handleUnpublish : handlePublish}
              className="w-full text-left px-2.5 py-2 text-xs hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer"
            >
              {caseRecord.isPublished ? 'Unpublish Site' : 'Publish / Unpublish'}
            </button>
          )}
          <hr className="border-[#ddd8ce] dark:border-[#262b27] my-2" />
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className="w-full text-left px-2.5 py-2 text-xs hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer"
          >
            + Add Timeline Event
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className="w-full text-left px-2.5 py-2 text-xs hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer"
          >
            + Upload Document
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('evidence')}
            className="w-full text-left px-2.5 py-2 text-xs hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer"
          >
            + Add Evidence
          </button>
          {isOwnerOrAdmin && (
            <>
              <hr className="border-[#ddd8ce] dark:border-[#262b27] my-2" />
              <button
                type="button"
                onClick={async () => {
                  await deleteCaseRecord(caseRecord.id);
                  onBack();
                }}
                className="w-full text-left px-2.5 py-2 text-xs text-[#8b3a3a] dark:text-[#e38b8b] hover:bg-[#8b3a3a]/10 cursor-pointer"
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
