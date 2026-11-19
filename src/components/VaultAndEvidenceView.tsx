import React, { useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  Download,
  ExternalLink,
  FileText,
  Film,
  FolderPlus,
  Image as ImageIcon,
  Layers,
  Lock,
  Music,
  Plus,
  Square,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  CaseRecord,
  EvidenceCollection,
  MediaType,
  UserRole,
  VaultCategory,
  VaultItem,
} from '../types';
import {
  createEvidenceCollection,
  createVaultItem,
  deleteEvidenceCollection,
  deleteVaultItem,
  updateEvidenceCollection,
  updateVaultItem,
} from '../services/firestoreService';
import {
  deleteVaultFileAsset,
  formatBytes,
  getVaultFileUrl,
  inferMediaType,
  uploadEncryptedVaultFile,
} from '../utils/vaultApi';
import { StatusLabel } from './BrandMark';

interface VaultAndEvidenceViewProps {
  mode: 'documents' | 'evidence';
  items: VaultItem[];
  collections: EvidenceCollection[];
  cases: CaseRecord[];
  userId: string;
  userName: string;
  userRole: UserRole;
  idToken: string | null;
  searchQuery: string;
}

export const VaultAndEvidenceView: React.FC<VaultAndEvidenceViewProps> = ({
  mode,
  items,
  collections,
  cases,
  userId,
  userName,
  userRole,
  idToken,
  searchQuery,
}) => {
  const canEdit = userRole === 'admin' || userRole === 'editor';
  const category: VaultCategory = mode === 'documents' ? 'document' : 'evidence';

  const [scopeFilter, setScopeFilter] = useState<'all' | 'linked' | 'standalone' | 'public'>('all');
  const [mediaFilter, setMediaFilter] = useState<'all' | MediaType>('all');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Upload & Note modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDocType, setUploadDocType] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadTextContent, setUploadTextContent] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadCaseIds, setUploadCaseIds] = useState<string[]>([]);
  const [uploadIsPublic, setUploadIsPublic] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'note'>('file');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Collection Builder modal
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<EvidenceCollection | null>(null);
  const [colTitle, setColTitle] = useState('');
  const [colExplanation, setColExplanation] = useState('');
  const [colCoverUrl, setColCoverUrl] = useState('');
  const [colCaseId, setColCaseId] = useState('');
  const [colTags, setColTags] = useState('');
  const [colIsPublic, setColIsPublic] = useState(false);
  const [colItemIds, setColItemIds] = useState<string[]>([]);
  const [savingCollection, setSavingCollection] = useState(false);
  const colCoverInputRef = useRef<HTMLInputElement>(null);

  // View / Inspect Item or Collection
  const [activeItem, setActiveItem] = useState<VaultItem | null>(null);
  const [activeCollection, setActiveCollection] = useState<EvidenceCollection | null>(null);

  const categoryItems = useMemo(
    () => items.filter((item) => item.category === category),
    [items, category]
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    categoryItems.forEach((i) => i.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [categoryItems]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return categoryItems.filter((item) => {
      if (scopeFilter === 'linked' && item.caseIds.length === 0) return false;
      if (scopeFilter === 'standalone' && item.caseIds.length > 0) return false;
      if (scopeFilter === 'public' && !item.isPublic) return false;
      if (mediaFilter !== 'all' && item.mediaType !== mediaFilter) return false;
      if (selectedTag && !item.tags.includes(selectedTag)) return false;
      if (q) {
        const match =
          item.title.toLowerCase().includes(q) ||
          (item.description || '').toLowerCase().includes(q) ||
          (item.docType || '').toLowerCase().includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [categoryItems, scopeFilter, mediaFilter, selectedTag, searchQuery]);

  const caseMap = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const openCollectionBuilder = (existing?: EvidenceCollection) => {
    if (existing) {
      setEditingCollection(existing);
      setColTitle(existing.title);
      setColExplanation(existing.explanation);
      setColCoverUrl(existing.coverImageUrl || '');
      setColCaseId(existing.caseId || '');
      setColTags(existing.tags.join(', '));
      setColIsPublic(existing.isPublic);
      setColItemIds(existing.itemIds);
    } else {
      setEditingCollection(null);
      setColTitle('');
      setColExplanation('');
      // Auto-pick first selected image if any
      const firstSelectedImg = items.find(
        (i) => selectedIds.includes(i.id) && i.mediaType === 'image' && i.fileId
      );
      setColCoverUrl(
        firstSelectedImg ? getVaultFileUrl(firstSelectedImg.fileId, idToken, firstSelectedImg.isPublic) : ''
      );
      setColCaseId('');
      setColTags('');
      setColIsPublic(false);
      setColItemIds(selectedIds.length > 0 ? selectedIds : []);
    }
    setShowCollectionModal(true);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploading(true);
    try {
      const tags = uploadTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      if (uploadMode === 'note') {
        if (!uploadTitle.trim() || !uploadTextContent.trim()) {
          throw new Error('Title and note content are required.');
        }
        await createVaultItem({
          ownerId: userId,
          actorName: userName,
          title: uploadTitle.trim(),
          description: uploadDescription.trim() || undefined,
          category,
          mediaType: 'text',
          docType: uploadDocType.trim() || 'Observation Note',
          encrypted: true,
          textContent: uploadTextContent.trim(),
          caseIds: uploadCaseIds,
          tags,
          isPublic: uploadIsPublic,
        });
      } else {
        if (pendingFiles.length === 0) {
          throw new Error('Select at least one file to upload.');
        }
        for (let i = 0; i < pendingFiles.length; i += 1) {
          const file = pendingFiles[i];
          const uploaded = await uploadEncryptedVaultFile(file, uploadIsPublic);
          const mediaType = inferMediaType(uploaded.mimeType, uploaded.fileName);
          const derivedTitle =
            pendingFiles.length === 1 && uploadTitle.trim()
              ? uploadTitle.trim()
              : file.name.replace(/\.[^/.]+$/, '');

          await createVaultItem({
            ownerId: userId,
            actorName: userName,
            title: derivedTitle,
            description: uploadDescription.trim() || undefined,
            category,
            mediaType,
            docType: uploadDocType.trim() || mediaType.toUpperCase(),
            fileId: uploaded.fileId,
            fileName: uploaded.fileName,
            mimeType: uploaded.mimeType,
            fileSize: uploaded.fileSize,
            sha256: uploaded.sha256,
            encrypted: true,
            caseIds: uploadCaseIds,
            tags,
            isPublic: uploadIsPublic,
          });
        }
      }

      setShowUploadModal(false);
      setUploadTitle('');
      setUploadDocType('');
      setUploadDescription('');
      setUploadTextContent('');
      setUploadTags('');
      setUploadCaseIds([]);
      setUploadIsPublic(false);
      setPendingFiles([]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleCoverImageUpload = async (file: File) => {
    try {
      const uploaded = await uploadEncryptedVaultFile(file, true);
      setColCoverUrl(`/api/vault/file/${uploaded.fileId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload cover image.');
    }
  };

  const handleSaveCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colTitle.trim()) return;
    setSavingCollection(true);
    try {
      const tags = colTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      if (editingCollection) {
        await updateEvidenceCollection(editingCollection.id, {
          title: colTitle.trim(),
          explanation: colExplanation.trim(),
          coverImageUrl: colCoverUrl.trim() || undefined,
          itemIds: colItemIds,
          caseId: colCaseId || undefined,
          tags,
          isPublic: colIsPublic,
        });
      } else {
        await createEvidenceCollection({
          ownerId: userId,
          actorName: userName,
          title: colTitle.trim(),
          explanation: colExplanation.trim(),
          coverImageUrl: colCoverUrl.trim() || undefined,
          itemIds: colItemIds,
          caseId: colCaseId || undefined,
          tags,
          isPublic: colIsPublic,
        });
      }
      setShowCollectionModal(false);
      setSelectedIds([]);
    } finally {
      setSavingCollection(false);
    }
  };

  const publicCount = categoryItems.filter((i) => i.isPublic).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
            {mode === 'documents' ? 'Document Vault' : 'Evidence Library'}
          </h1>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1 tabular-nums">
            {categoryItems.length} encrypted {mode === 'documents' ? 'documents' : 'items'} · {publicCount} public
            {mode === 'evidence' ? ` · ${collections.length} collections` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openCollectionBuilder()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>
              {selectedIds.length > 0
                ? `Create Collection (${selectedIds.length})`
                : 'New Collection'}
            </span>
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setUploadMode('file');
                setShowUploadModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md bg-[#3061d0] text-white hover:bg-[#2752b4] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{mode === 'documents' ? 'Upload Documents' : 'Add Evidence'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ['all', mode === 'documents' ? 'All Documents' : 'All Items'],
              ['linked', 'Linked to Cases'],
              ['standalone', 'Standalone'],
              ['public', 'Public'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setScopeFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                scopeFilter === key
                  ? 'bg-[#3061d0] text-white border-[#3061d0] font-semibold'
                  : 'bg-white dark:bg-[#141418] text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={mediaFilter}
            onChange={(e) => setMediaFilter(e.target.value as 'all' | MediaType)}
            className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] text-zinc-700 dark:text-zinc-200 outline-none"
          >
            <option value="all">All Formats</option>
            <option value="pdf">PDF</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
            <option value="text">Text Note</option>
            <option value="file">Other File</option>
          </select>

          {allTags.length > 0 && (
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] text-zinc-700 dark:text-zinc-200 outline-none"
            >
              <option value="">All Tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Multi-select action bar */}
      {selectedIds.length > 0 && (
        <div className="bg-[#3061d0] text-white rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-semibold tabular-nums">
            {selectedIds.length} item{selectedIds.length === 1 ? '' : 's'} selected for collection
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openCollectionBuilder()}
              className="px-3 py-1.5 text-xs font-bold rounded bg-white text-[#3061d0] hover:bg-zinc-100 cursor-pointer"
            >
              Build Collection with Title &amp; Explanation
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 text-xs font-medium rounded bg-white/15 hover:bg-white/25 cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Collections Strip (shown in Evidence Library and whenever collections exist) */}
      {(mode === 'evidence' || collections.length > 0) && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Curated Collections
            </h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {collections.map((col) => {
              const linkedCase = col.caseId ? caseMap.get(col.caseId) : undefined;
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setActiveCollection(col)}
                  className="shrink-0 w-56 text-left bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden hover:border-[#3061d0] transition-colors cursor-pointer"
                >
                  {col.coverImageUrl && (
                    <div className="h-24 bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                      <img
                        src={col.coverImageUrl}
                        alt={col.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-3.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                        {col.title}
                      </span>
                      <StatusLabel status={col.isPublic ? 'Public' : 'Private'} />
                    </div>
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 tabular-nums">
                      {col.itemIds.length} items ·{' '}
                      {linkedCase ? `Case ${linkedCase.caseNumber}` : 'Standalone'}
                    </div>
                  </div>
                </button>
              );
            })}
            {canEdit && (
              <button
                type="button"
                onClick={() => openCollectionBuilder()}
                className="shrink-0 w-44 min-h-[96px] border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg flex flex-col items-center justify-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:border-[#3061d0] hover:text-[#3061d0] transition-colors cursor-pointer"
              >
                <FolderPlus className="w-4 h-4" />
                <span>+ New Collection</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-12 text-center">
          <Lock className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
          <h3 className="text-base font-bold mb-1">
            No {mode === 'documents' ? 'documents' : 'evidence items'} match this view
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-5">
            Upload PDFs, videos, audio recordings, images, or observation notes. Every uploaded asset is AES-256-GCM encrypted at rest with a SHA-256 integrity hash.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-[#3061d0] text-white hover:bg-[#2752b4] cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload First Item</span>
            </button>
          )}
        </div>
      ) : mode === 'documents' ? (
        /* Document Vault Table View */
        <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <th className="py-3 px-4 w-10">Select</th>
                <th className="py-3 px-4">Document</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Linked Case</th>
                <th className="py-3 px-4">Tags</th>
                <th className="py-3 px-4">Visibility</th>
                <th className="py-3 px-4 text-right">Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredItems.map((docItem) => {
                const isSelected = selectedIds.includes(docItem.id);
                const linkedLabel =
                  docItem.caseIds.length > 0
                    ? docItem.caseIds
                        .map((cid) => caseMap.get(cid)?.caseNumber || cid)
                        .join(', ')
                    : 'Unlinked';
                return (
                  <tr
                    key={docItem.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 cursor-pointer"
                    onClick={() => setActiveItem(docItem)}
                  >
                    <td
                      className="py-3 px-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(docItem.id);
                      }}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#3061d0]" />
                      ) : (
                        <Square className="w-4 h-4 text-zinc-400" />
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-zinc-950 dark:text-white">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                        <span className="truncate max-w-xs">{docItem.title}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-zinc-600 dark:text-zinc-300">
                      {docItem.docType || docItem.mediaType.toUpperCase()}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-xs text-zinc-500 dark:text-zinc-400">
                      {linkedLabel}
                    </td>
                    <td className="py-3 px-4 text-xs text-zinc-500 dark:text-zinc-400">
                      {docItem.tags.length > 0 ? docItem.tags.join(', ') : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel status={docItem.isPublic ? 'Public' : 'Private'} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-xs text-zinc-500">
                      {docItem.fileSize ? formatBytes(docItem.fileSize) : 'Note'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Evidence Library Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredItems.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            const fileUrl = getVaultFileUrl(item.fileId, idToken, item.isPublic);
            const firstCaseNum =
              item.caseIds.length > 0
                ? caseMap.get(item.caseIds[0])?.caseNumber || item.caseIds[0]
                : 'Standalone';

            return (
              <div
                key={item.id}
                onClick={() => setActiveItem(item)}
                className={`group bg-white dark:bg-[#141418] border rounded-lg overflow-hidden transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-[#3061d0] ring-2 ring-[#3061d0]/20'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
                }`}
              >
                <div className="aspect-[16/10] bg-zinc-100 dark:bg-zinc-900 relative flex items-center justify-center overflow-hidden">
                  {/* Selection Checkbox */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(item.id);
                    }}
                    aria-label={`Select ${item.title}`}
                    className="absolute top-2 right-2 z-10 p-1 rounded bg-black/55 text-white hover:bg-black/75 cursor-pointer"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-300" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>

                  {/* Media Type Label */}
                  <span className="absolute top-2 left-2 z-10 text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-black/70 text-white">
                    {item.mediaType}
                  </span>

                  {item.mediaType === 'image' && fileUrl ? (
                    <img
                      src={fileUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : item.mediaType === 'video' ? (
                    <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 gap-1">
                      <Film className="w-7 h-7" />
                      <span className="text-[11px] font-medium">Encrypted Video</span>
                    </div>
                  ) : item.mediaType === 'audio' ? (
                    <div className="flex flex-col items-center justify-center text-zinc-500 gap-1">
                      <Music className="w-7 h-7" />
                      <span className="text-[11px] font-medium">Encrypted Audio</span>
                    </div>
                  ) : item.mediaType === 'text' ? (
                    <div className="p-3 pt-8 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-4 self-start">
                      {item.textContent || item.description}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-zinc-500 gap-1">
                      <FileText className="w-7 h-7" />
                      <span className="text-[11px] font-medium">{item.mediaType.toUpperCase()}</span>
                    </div>
                  )}
                </div>

                <div className="p-3.5">
                  <div className="text-sm font-bold text-zinc-950 dark:text-white truncate mb-1.5">
                    {item.title}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span className="font-mono-tabular truncate">{firstCaseNum}</span>
                    <StatusLabel status={item.isPublic ? 'Public' : 'Private'} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload / Add Item Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-base font-bold">
                {mode === 'documents' ? 'Upload to Document Vault' : 'Add to Evidence Library'}
              </h2>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-5 space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUploadMode('file')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-md border cursor-pointer ${
                    uploadMode === 'file'
                      ? 'bg-[#3061d0] text-white border-[#3061d0]'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  Upload File (PDF, Video, Audio, Image)
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('note')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-md border cursor-pointer ${
                    uploadMode === 'note'
                      ? 'bg-[#3061d0] text-white border-[#3061d0]'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  Text Observation Note
                </button>
              </div>

              {uploadError && (
                <div className="p-3 rounded bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                  {uploadError}
                </div>
              )}

              {uploadMode === 'file' ? (
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                    Files (AES-256-GCM Encrypted)
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-6 text-center hover:border-[#3061d0] transition-colors cursor-pointer"
                  >
                    <Upload className="w-6 h-6 text-zinc-400 mx-auto mb-2" />
                    <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                      {pendingFiles.length > 0
                        ? `${pendingFiles.length} file(s) selected: ${pendingFiles
                            .map((f) => f.name)
                            .join(', ')}`
                        : 'Click to select PDF, video, audio, image, or archive files'}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const list = Array.from(e.target.files || []);
                        setPendingFiles(list);
                        if (list.length === 1 && !uploadTitle) {
                          setUploadTitle(list[0].name.replace(/\.[^/.]+$/, ''));
                        }
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                    Observation / Text Content
                  </label>
                  <textarea
                    rows={5}
                    value={uploadTextContent}
                    onChange={(e) => setUploadTextContent(e.target.value)}
                    required
                    placeholder="Enter contemporaneous log, transcript, or record text..."
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none focus:border-[#3061d0]"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                    Title {pendingFiles.length > 1 ? '(optional for batch)' : '*'}
                  </label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    required={uploadMode === 'note' || pendingFiles.length <= 1}
                    placeholder="Exhibit or document title"
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none focus:border-[#3061d0]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                    Classification / Type
                  </label>
                  <input
                    type="text"
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value)}
                    placeholder="e.g. Court Filing, Body-Cam, CAD Log"
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none focus:border-[#3061d0]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                  Description / Notes
                </label>
                <textarea
                  rows={2}
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Optional provenance or summary..."
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none focus:border-[#3061d0]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  placeholder="arrest-sequence, 911-cad, timeline"
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none focus:border-[#3061d0]"
                />
              </div>

              {cases.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                    Link to Case(s)
                  </label>
                  <div className="max-h-28 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-md p-2 space-y-1 bg-zinc-50 dark:bg-zinc-900">
                    {cases.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={uploadCaseIds.includes(c.id)}
                          onChange={(e) =>
                            setUploadCaseIds((prev) =>
                              e.target.checked
                                ? [...prev, c.id]
                                : prev.filter((x) => x !== c.id)
                            )
                          }
                        />
                        <span className="font-mono-tabular text-zinc-500">{c.caseNumber}</span>
                        <span className="truncate">{c.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={uploadIsPublic}
                  onChange={(e) => setUploadIsPublic(e.target.checked)}
                />
                <span>Make eligible for Public Archive (only appears when linked case site is published)</span>
              </label>

              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-[#3061d0] text-white hover:bg-[#2752b4] disabled:opacity-50 cursor-pointer"
                >
                  {uploading ? 'Encrypting & Saving...' : 'Save to Vault'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collection Builder Modal */}
      {showCollectionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-base font-bold">
                {editingCollection ? 'Edit Evidence Collection' : 'Build Evidence Collection'}
              </h2>
              <button
                type="button"
                onClick={() => setShowCollectionModal(false)}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCollection} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                  Collection Title *
                </label>
                <input
                  type="text"
                  value={colTitle}
                  onChange={(e) => setColTitle(e.target.value)}
                  required
                  placeholder="e.g. Arrest Sequence – Mar 7"
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none focus:border-[#3061d0]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                  Contextual Explanation *
                </label>
                <textarea
                  rows={4}
                  value={colExplanation}
                  onChange={(e) => setColExplanation(e.target.value)}
                  required
                  placeholder="Explain what these selected items demonstrate together and their evidentiary context..."
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none focus:border-[#3061d0]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                  Collection Cover Image
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={colCoverUrl}
                    onChange={(e) => setColCoverUrl(e.target.value)}
                    placeholder="Upload a cover image or paste URL..."
                    className="flex-1 px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none focus:border-[#3061d0]"
                  />
                  <button
                    type="button"
                    onClick={() => colCoverInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Upload Image</span>
                  </button>
                  <input
                    ref={colCoverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleCoverImageUpload(f);
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                    Assign to Case (Optional)
                  </label>
                  <select
                    value={colCaseId}
                    onChange={(e) => setColCaseId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none"
                  >
                    <option value="">Standalone Collection</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.caseNumber} — {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={colTags}
                    onChange={(e) => setColTags(e.target.value)}
                    placeholder="sequence, custody, exhibit"
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                  Included Vault &amp; Evidence Items ({colItemIds.length} selected)
                </label>
                <div className="max-h-40 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-md p-2.5 space-y-1.5 bg-zinc-50 dark:bg-zinc-900">
                  {items.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={colItemIds.includes(item.id)}
                        onChange={(e) =>
                          setColItemIds((prev) =>
                            e.target.checked
                              ? [...prev, item.id]
                              : prev.filter((x) => x !== item.id)
                          )
                        }
                      />
                      <span className="font-mono-tabular uppercase text-[10px] text-zinc-500">
                        {item.mediaType}
                      </span>
                      <span className="truncate font-medium">{item.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={colIsPublic}
                  onChange={(e) => setColIsPublic(e.target.checked)}
                />
                <span>Publish collection when assigned case site is published</span>
              </label>

              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCollectionModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCollection}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-[#3061d0] text-white hover:bg-[#2752b4] disabled:opacity-50 cursor-pointer"
                >
                  {savingCollection ? 'Saving...' : 'Save Collection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Item Modal */}
      {activeItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[11px] font-mono-tabular uppercase text-[#3061d0] dark:text-blue-400">
                  {activeItem.category} · {activeItem.mediaType} · AES-256-GCM Encrypted
                </div>
                <h3 className="text-base font-bold truncate">{activeItem.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveItem(null)}
                className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-7 space-y-3">
                {activeItem.fileId && activeItem.mediaType === 'image' && (
                  <img
                    src={getVaultFileUrl(activeItem.fileId, idToken, activeItem.isPublic)}
                    alt={activeItem.title}
                    referrerPolicy="no-referrer"
                    className="w-full max-h-[52vh] object-contain bg-zinc-100 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800"
                  />
                )}
                {activeItem.fileId && activeItem.mediaType === 'video' && (
                  <video
                    src={getVaultFileUrl(activeItem.fileId, idToken, activeItem.isPublic)}
                    controls
                    className="w-full max-h-[52vh] rounded bg-black"
                  />
                )}
                {activeItem.fileId && activeItem.mediaType === 'audio' && (
                  <div className="p-6 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800">
                    <audio
                      src={getVaultFileUrl(activeItem.fileId, idToken, activeItem.isPublic)}
                      controls
                      className="w-full"
                    />
                  </div>
                )}
                {activeItem.fileId && activeItem.mediaType === 'pdf' && (
                  <iframe
                    title={activeItem.title}
                    src={getVaultFileUrl(activeItem.fileId, idToken, activeItem.isPublic)}
                    className="w-full h-[52vh] rounded border border-zinc-200 dark:border-zinc-800"
                  />
                )}
                {activeItem.textContent && (
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 text-sm whitespace-pre-line font-serif-editorial leading-relaxed">
                    {activeItem.textContent}
                  </div>
                )}
                {activeItem.fileId && activeItem.mediaType === 'file' && (
                  <div className="p-6 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 text-center space-y-2">
                    <FileText className="w-8 h-8 text-zinc-400 mx-auto" />
                    <div className="text-sm font-semibold">{activeItem.fileName}</div>
                    <div className="text-xs text-zinc-500">
                      {formatBytes(activeItem.fileSize)}
                    </div>
                  </div>
                )}
                {activeItem.sha256 && (
                  <div className="text-[11px] font-mono-tabular text-zinc-500 break-all">
                    SHA-256: {activeItem.sha256}
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 space-y-4">
                <div>
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                    Visibility
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <StatusLabel status={activeItem.isPublic ? 'Public' : 'Private'} />
                    {canEdit && (
                      <button
                        type="button"
                        onClick={async () => {
                          const next = !activeItem.isPublic;
                          await updateVaultItem(activeItem, { isPublic: next });
                          setActiveItem({ ...activeItem, isPublic: next });
                        }}
                        className="text-xs font-semibold text-[#3061d0] dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        Switch to {activeItem.isPublic ? 'Private' : 'Public'}
                      </button>
                    )}
                  </div>
                </div>

                {activeItem.description && (
                  <div>
                    <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                      Description
                    </div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                      {activeItem.description}
                    </p>
                  </div>
                )}

                <div>
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                    Tags
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                    <Tag className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{activeItem.tags.length ? activeItem.tags.join(', ') : 'No tags'}</span>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Linked Cases
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded p-2">
                    {cases.length === 0 ? (
                      <div className="text-xs text-zinc-400">No cases available</div>
                    ) : (
                      cases.map((c) => {
                        const linked = activeItem.caseIds.includes(c.id);
                        return (
                          <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              disabled={!canEdit}
                              checked={linked}
                              onChange={async (e) => {
                                const nextCaseIds = e.target.checked
                                  ? [...activeItem.caseIds, c.id]
                                  : activeItem.caseIds.filter((id) => id !== c.id);
                                await updateVaultItem(activeItem, { caseIds: nextCaseIds });
                                setActiveItem({ ...activeItem, caseIds: nextCaseIds });
                              }}
                            />
                            <span className="font-mono-tabular text-zinc-500">{c.caseNumber}</span>
                            <span className="truncate">{c.title}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-2">
                  {activeItem.fileId && (
                    <a
                      href={getVaultFileUrl(activeItem.fileId, idToken, activeItem.isPublic)}
                      download={activeItem.fileName || activeItem.title}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (activeItem.fileId) {
                          await deleteVaultFileAsset(activeItem.fileId);
                        }
                        await deleteVaultItem(activeItem.id);
                        setActiveItem(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Item</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collection Inspector Modal */}
      {activeCollection && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#3061d0]" />
                <h3 className="text-base font-bold">{activeCollection.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveCollection(null)}
                className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {activeCollection.coverImageUrl && (
                <img
                  src={activeCollection.coverImageUrl}
                  alt={activeCollection.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-52 object-cover rounded-lg border border-zinc-200 dark:border-zinc-800"
                />
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <StatusLabel status={activeCollection.isPublic ? 'Public' : 'Private'} />
                  <span>{activeCollection.itemIds.length} grouped items</span>
                  {activeCollection.tags.length > 0 && (
                    <span>· {activeCollection.tags.join(', ')}</span>
                  )}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const col = activeCollection;
                        setActiveCollection(null);
                        openCollectionBuilder(col);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                    >
                      Edit Collection
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteEvidenceCollection(activeCollection.id);
                        setActiveCollection(null);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded border border-red-200 text-red-600 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Contextual Explanation
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                  {activeCollection.explanation}
                </p>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                  Selected Items in Collection
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeCollection.itemIds
                    .map((id) => items.find((x) => x.id === id))
                    .filter((x): x is VaultItem => Boolean(x))
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveCollection(null);
                          setActiveItem(item);
                        }}
                        className="text-left p-3 rounded border border-zinc-200 dark:border-zinc-800 hover:border-[#3061d0] flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-[10px] font-mono-tabular uppercase text-[#3061d0]">
                            {item.mediaType}
                          </div>
                          <div className="text-xs font-bold truncate">{item.title}</div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
