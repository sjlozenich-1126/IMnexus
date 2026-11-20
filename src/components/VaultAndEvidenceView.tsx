import React, { useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
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
  inferMediaType,
  uploadEncryptedVaultFile,
} from '../utils/vaultApi';
import { StatusLabel } from './BrandMark';
import { EmbeddedVideoFrame } from './EmbeddedVideoFrame';
import { VaultDownloadLink, VaultImage, useResolvedVaultUrl } from './VaultMedia';
import { parseVideoEmbed } from '../utils/mediaEmbed';

const VaultItemPreviewStage: React.FC<{ item: VaultItem }> = ({ item }) => {
  const { url, loading, error } = useResolvedVaultUrl(item.fileId);

  return (
    <div className="lg:col-span-7 space-y-3">
      {item.embedUrl && (
        <EmbeddedVideoFrame embedUrl={item.embedUrl} title={item.title} />
      )}
      {item.fileId && item.mediaType !== 'text' && loading && (
        <div className="p-8 bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] text-center text-xs text-[#6a716b]">
          Decrypting AES-256-GCM asset from cloud vault…
        </div>
      )}
      {item.fileId && item.mediaType !== 'text' && error && (
        <div className="p-6 bg-[#8b3a3a]/10 border border-[#8b3a3a]/40 text-center text-xs text-[#8b3a3a] dark:text-[#e38b8b]">
          Unable to decrypt file from cloud vault. Verify permissions or re-upload the asset.
        </div>
      )}
      {item.fileId && !loading && !error && url && item.mediaType === 'image' && (
        <img
          src={url}
          alt={item.title}
          referrerPolicy="no-referrer"
          className="w-full max-h-[52vh] object-contain bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27]"
        />
      )}
      {item.fileId && !loading && !error && url && item.mediaType === 'video' && (
        <video src={url} controls className="w-full max-h-[52vh] bg-black" />
      )}
      {item.fileId && !loading && !error && url && item.mediaType === 'audio' && (
        <div className="p-6 bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27]">
          <audio src={url} controls className="w-full" />
        </div>
      )}
      {item.fileId && !loading && !error && url && item.mediaType === 'pdf' && (
        <iframe
          title={item.title}
          src={url}
          className="w-full h-[52vh] border border-[#ddd8ce] dark:border-[#262b27]"
        />
      )}
      {item.textContent && (
        <div className="p-4 bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] text-sm whitespace-pre-line font-serif-editorial leading-relaxed">
          {item.textContent}
        </div>
      )}
      {item.fileId && item.mediaType === 'file' && (
        <div className="p-6 bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] text-center space-y-2">
          <FileText className="w-8 h-8 text-[#6a716b] mx-auto" />
          <div className="text-sm font-medium">{item.fileName}</div>
          <div className="text-xs text-[#6a716b]">{formatBytes(item.fileSize)}</div>
        </div>
      )}
      {item.sha256 && (
        <div className="text-[11px] font-mono-tabular text-[#6a716b] break-all">
          SHA-256: {item.sha256}
        </div>
      )}
    </div>
  );
};

interface VaultAndEvidenceViewProps {
  mode: 'documents' | 'evidence';
  items: VaultItem[];
  collections: EvidenceCollection[];
  cases: CaseRecord[];
  userId: string;
  userName: string;
  userRole: UserRole;
  idToken?: string | null;
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
  searchQuery,
}) => {
  const canEdit = userRole === 'admin' || userRole === 'editor';
  const category: VaultCategory = mode === 'documents' ? 'document' : 'evidence';

  const [scopeFilter, setScopeFilter] = useState<'all' | 'linked' | 'standalone' | 'public'>('all');
  const [mediaFilter, setMediaFilter] = useState<'all' | MediaType>('all');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDocType, setUploadDocType] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadTextContent, setUploadTextContent] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadCaseIds, setUploadCaseIds] = useState<string[]>([]);
  const [uploadIsPublic, setUploadIsPublic] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'note' | 'embed'>('file');
  const [uploadEmbedUrl, setUploadEmbedUrl] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingEmbedUrl, setEditingEmbedUrl] = useState('');

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
      const firstSelectedImg = items.find(
        (i) => selectedIds.includes(i.id) && i.mediaType === 'image' && i.fileId
      );
      setColCoverUrl(firstSelectedImg ? `vault://${firstSelectedImg.fileId}` : '');
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

      if (uploadMode === 'embed') {
        const parsed = parseVideoEmbed(uploadEmbedUrl);
        if (!uploadTitle.trim() || !parsed) {
          throw new Error('Title and a valid video URL or iframe embed snippet are required.');
        }
        await createVaultItem({
          ownerId: userId,
          actorName: userName,
          title: uploadTitle.trim(),
          description: uploadDescription.trim() || undefined,
          category,
          mediaType: 'video',
          docType: uploadDocType.trim() || `${parsed.provider} Video`,
          encrypted: false,
          embedUrl: parsed.embedUrl,
          caseIds: uploadCaseIds,
          tags,
          isPublic: uploadIsPublic,
        });
      } else if (uploadMode === 'note') {
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
      setUploadEmbedUrl('');
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
      setColCoverUrl(`vault://${uploaded.fileId}`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload cover image.');
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[16px] font-semibold tracking-[-0.01em] text-[#0f1210] dark:text-[#f3f0e9]">
            {mode === 'documents' ? 'Document Vault' : 'Evidence Library'}
          </h1>
          <p className="text-xs text-[#6a716b] dark:text-[#8d948e] mt-0.5 font-mono-tabular">
            {categoryItems.length} encrypted {mode === 'documents' ? 'documents' : 'items'} · {publicCount} public
            {mode === 'evidence' ? ` · ${collections.length} collections` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openCollectionBuilder()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] bg-transparent hover:border-[#0f1210] transition-colors whitespace-nowrap cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>
              {selectedIds.length > 0
                ? `Create Collection (${selectedIds.length})`
                : 'New Collection'}
            </span>
          </button>
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => {
                  setUploadError(null);
                  setUploadMode('embed');
                  setShowUploadModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] bg-transparent hover:border-[#0f1210] transition-colors whitespace-nowrap cursor-pointer"
              >
                <Film className="w-3.5 h-3.5" />
                <span>Embed Video</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadError(null);
                  setUploadMode('file');
                  setShowUploadModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] hover:opacity-85 transition-opacity whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{mode === 'documents' ? 'Upload Documents' : 'Add Evidence'}</span>
              </button>
            </>
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
              className={`px-3 py-1.5 text-xs border transition-colors whitespace-nowrap cursor-pointer ${
                scopeFilter === key
                  ? 'bg-[#0f1210] text-[#faf8f4] border-[#0f1210] dark:bg-[#f3f0e9] dark:text-[#0f1210] dark:border-[#f3f0e9] font-medium'
                  : 'bg-[#faf8f4] dark:bg-[#161916] text-[#6a716b] dark:text-[#8d948e] border-[#ddd8ce] dark:border-[#262b27] hover:border-[#c4bfb4]'
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
            className="px-2.5 py-1.5 text-xs border border-[#ddd8ce] dark:border-[#262b27] bg-[#faf8f4] dark:bg-[#161916] text-[#0f1210] dark:text-[#f3f0e9] outline-none"
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
              className="px-2.5 py-1.5 text-xs border border-[#ddd8ce] dark:border-[#262b27] bg-[#faf8f4] dark:bg-[#161916] text-[#0f1210] dark:text-[#f3f0e9] outline-none"
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
        <div className="bg-[#1a2e24] text-[#faf8f4] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-medium font-mono-tabular">
            {selectedIds.length} item{selectedIds.length === 1 ? '' : 's'} selected for collection
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openCollectionBuilder()}
              className="px-3 py-1.5 text-xs font-medium bg-[#faf8f4] text-[#0f1210] hover:opacity-90 cursor-pointer"
            >
              Build Collection with Title &amp; Explanation
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 text-xs bg-white/15 hover:bg-white/25 cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Collections Strip */}
      {(mode === 'evidence' || collections.length > 0) && (
        <div>
          <div className="text-xs text-[#6a716b] dark:text-[#8d948e] mb-2.5">Collections</div>
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {collections.map((col) => {
              const linkedCase = col.caseId ? caseMap.get(col.caseId) : undefined;
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setActiveCollection(col)}
                  className="shrink-0 w-44 text-left bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] overflow-hidden hover:border-[#c4bfb4] transition-colors cursor-pointer"
                >
                  {col.coverImageUrl && (
                    <div className="h-20 bg-[#e5e1d8] dark:bg-[#0c0e0c] overflow-hidden">
                      <VaultImage
                        src={col.coverImageUrl}
                        alt={col.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-3">
                    <div className="text-[13px] font-medium text-[#0f1210] dark:text-[#f3f0e9] truncate mb-0.5">
                      {col.title}
                    </div>
                    <div className="text-[11px] text-[#6a716b] dark:text-[#8d948e]">
                      {col.itemIds.length} items ·{' '}
                      {linkedCase ? `Linked to ${linkedCase.caseNumber}` : 'Standalone'}
                    </div>
                  </div>
                </button>
              );
            })}
            {canEdit && (
              <button
                type="button"
                onClick={() => openCollectionBuilder()}
                className="shrink-0 w-36 min-h-[82px] border border-dashed border-[#ddd8ce] dark:border-[#262b27] flex items-center justify-center text-xs text-[#6a716b] hover:border-[#c4bfb4] hover:text-[#0f1210] dark:hover:text-[#f3f0e9] transition-colors cursor-pointer"
              >
                + New Collection
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty State or Content */}
      {filteredItems.length === 0 ? (
        <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-12 text-center">
          <Lock className="w-7 h-7 text-[#6a716b] mx-auto mb-3" />
          <h3 className="text-sm font-semibold mb-1">
            No {mode === 'documents' ? 'documents' : 'evidence items'} match this view
          </h3>
          <p className="text-xs text-[#6a716b] dark:text-[#8d948e] max-w-md mx-auto mb-5">
            Upload PDFs, videos, audio recordings, images, or observation notes. Every uploaded asset is AES-256-GCM encrypted at rest with a SHA-256 integrity hash.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] hover:opacity-85 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload First Item</span>
            </button>
          )}
        </div>
      ) : mode === 'documents' ? (
        <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-[#ddd8ce] dark:border-[#262b27] bg-black/[0.015] dark:bg-white/[0.02] text-[10px] font-medium uppercase tracking-[0.1em] text-[#6a716b]">
                <th className="py-2.5 px-3.5 w-10">Sel</th>
                <th className="py-2.5 px-3.5">Document</th>
                <th className="py-2.5 px-3.5">Type</th>
                <th className="py-2.5 px-3.5">Linked Case</th>
                <th className="py-2.5 px-3.5">Tags</th>
                <th className="py-2.5 px-3.5">Visibility</th>
                <th className="py-2.5 px-3.5 text-right">Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9e5db] dark:divide-[#222723]">
              {filteredItems.map((docItem) => {
                const isSelected = selectedIds.includes(docItem.id);
                const linkedLabel =
                  docItem.caseIds.length > 0
                    ? docItem.caseIds
                        .map((cid) => caseMap.get(cid)?.caseNumber || cid)
                        .join(', ')
                    : '— Unlinked';
                return (
                  <tr
                    key={docItem.id}
                    className="hover:bg-white/60 dark:hover:bg-white/[0.03] cursor-pointer"
                    onClick={() => {
                      setActiveItem(docItem);
                      setEditingEmbedUrl(docItem.embedUrl || '');
                    }}
                  >
                    <td
                      className="py-2.5 px-3.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(docItem.id);
                      }}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#2d5a3d] dark:text-[#7fb892]" />
                      ) : (
                        <Square className="w-4 h-4 text-[#6a716b]" />
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 font-medium text-[#0f1210] dark:text-[#f3f0e9]">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-[#6a716b] shrink-0" />
                        <span className="truncate max-w-xs">{docItem.title}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5 text-xs text-[#6a716b]">
                      {docItem.docType || docItem.mediaType.toUpperCase()}
                    </td>
                    <td className="py-2.5 px-3.5 font-mono-tabular text-[11px] text-[#6a716b]">
                      {linkedLabel}
                    </td>
                    <td className="py-2.5 px-3.5 text-xs text-[#6a716b]">
                      {docItem.tags.length > 0 ? docItem.tags.join(', ') : '—'}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <StatusLabel status={docItem.isPublic ? 'Public' : 'Private'} />
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono-tabular text-xs text-[#6a716b]">
                      {docItem.fileSize ? formatBytes(docItem.fileSize) : 'Note'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredItems.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            const firstCaseNum =
              item.caseIds.length > 0
                ? caseMap.get(item.caseIds[0])?.caseNumber || item.caseIds[0]
                : 'Standalone';

            return (
              <div
                key={item.id}
                onClick={() => {
                  setActiveItem(item);
                  setEditingEmbedUrl(item.embedUrl || '');
                }}
                className={`group bg-[#faf8f4] dark:bg-[#161916] border overflow-hidden transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-[#1a2e24] ring-1 ring-[#1a2e24] dark:border-[#7fb892] dark:ring-[#7fb892]'
                    : 'border-[#ddd8ce] dark:border-[#262b27] hover:border-[#c4bfb4]'
                }`}
              >
                <div className="aspect-[16/10] bg-[#e5e1d8] dark:bg-[#0c0e0c] relative flex items-center justify-center overflow-hidden">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(item.id);
                    }}
                    aria-label={`Select ${item.title}`}
                    className="absolute top-1.5 right-1.5 z-10 p-1 bg-black/55 text-white hover:bg-black/75 cursor-pointer"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-[#7fb892]" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <span className="absolute top-1.5 left-1.5 z-10 text-[9px] tracking-[0.06em] uppercase px-1.5 py-0.5 bg-black/55 text-white">
                    {item.mediaType}
                  </span>

                  {item.mediaType === 'image' && item.fileId ? (
                    <VaultImage
                      src={item.fileId}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : item.mediaType === 'video' ? (
                    (() => {
                      const parsedEmbed = item.embedUrl ? parseVideoEmbed(item.embedUrl) : null;
                      return parsedEmbed?.thumbnailUrl ? (
                        <div className="w-full h-full relative">
                          <img
                            src={parsedEmbed.thumbnailUrl}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <span className="px-2 py-1 text-[10px] font-mono-tabular uppercase tracking-wider bg-[#ef4423] text-white font-semibold">
                              ▶ {parsedEmbed.provider}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full bg-[#1a1f1c] flex flex-col items-center justify-center text-white/75 gap-1">
                          <Film className="w-6 h-6 text-[#ff6b3d]" />
                          <span className="text-[10px] uppercase tracking-wider font-mono-tabular">
                            {parsedEmbed ? `${parsedEmbed.provider} Embed` : 'Video'}
                          </span>
                        </div>
                      );
                    })()
                  ) : item.mediaType === 'audio' ? (
                    <div className="flex flex-col items-center justify-center text-[#6a716b] gap-1">
                      <Music className="w-6 h-6" />
                      <span className="text-[10px] uppercase tracking-wider">Audio</span>
                    </div>
                  ) : item.mediaType === 'text' ? (
                    <div className="p-3 pt-7 text-[10.5px] leading-relaxed text-[#6a716b] line-clamp-4 self-start">
                      {item.textContent || item.description}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-[#6a716b] gap-1">
                      <FileText className="w-6 h-6" />
                      <span className="text-[10px] uppercase">{item.mediaType}</span>
                    </div>
                  )}
                </div>

                <div className="px-3 py-2.5">
                  <div className="text-xs font-medium text-[#0f1210] dark:text-[#f3f0e9] truncate mb-1">
                    {item.title}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-[#6a716b]">
                    <span className="font-mono-tabular truncate">{firstCaseNum}</span>
                    <StatusLabel status={item.isPublic ? 'Public' : 'Private'} />
                  </div>
                </div>
              </div>
            );
          })}
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setUploadMode('file');
                setShowUploadModal(true);
              }}
              className="border border-dashed border-[#ddd8ce] dark:border-[#262b27] bg-[#faf8f4] dark:bg-[#161916] min-h-[155px] flex items-center justify-center text-xs text-[#6a716b] hover:border-[#c4bfb4] hover:text-[#0f1210] dark:hover:text-[#f3f0e9] cursor-pointer"
            >
              + Add Evidence
            </button>
          )}
        </div>
      )}

      {mode === 'evidence' && (
        <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] px-4 py-3.5 text-xs text-[#6a716b] dark:text-[#8d948e] leading-relaxed">
          <strong className="text-[#0f1210] dark:text-[#f3f0e9] font-medium block mb-0.5">
            How Evidence works
          </strong>
          Each item can be a file, image, video, audio recording, or text note. Items can be linked to one or more cases or left standalone, tagged for global search &amp; Nexus pattern mapping, and grouped into Collections. Toggle visibility between Private and Public — only Public items appear on the public archive.
        </div>
      )}

      {/* Upload / Add Item Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-3.5 border-b border-[#ddd8ce] dark:border-[#262b27] flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {mode === 'documents' ? 'Upload to Document Vault' : 'Add to Evidence Library'}
              </h2>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="p-1 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setUploadMode('file')}
                  className={`py-2 px-2 text-xs font-medium border cursor-pointer ${
                    uploadMode === 'file'
                      ? 'bg-[#0f1210] text-[#faf8f4] border-[#0f1210] dark:bg-[#f3f0e9] dark:text-[#0f1210]'
                      : 'border-[#ddd8ce] dark:border-[#262b27] text-[#6a716b]'
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('embed')}
                  className={`py-2 px-2 text-xs font-medium border cursor-pointer ${
                    uploadMode === 'embed'
                      ? 'bg-[#0f1210] text-[#faf8f4] border-[#0f1210] dark:bg-[#f3f0e9] dark:text-[#0f1210]'
                      : 'border-[#ddd8ce] dark:border-[#262b27] text-[#6a716b]'
                  }`}
                >
                  Video / Media Embed
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('note')}
                  className={`py-2 px-2 text-xs font-medium border cursor-pointer ${
                    uploadMode === 'note'
                      ? 'bg-[#0f1210] text-[#faf8f4] border-[#0f1210] dark:bg-[#f3f0e9] dark:text-[#0f1210]'
                      : 'border-[#ddd8ce] dark:border-[#262b27] text-[#6a716b]'
                  }`}
                >
                  Text Observation Note
                </button>
              </div>

              {uploadError && (
                <div className="p-3 bg-[#8b3a3a]/10 border border-[#8b3a3a]/40 text-xs text-[#8b3a3a] dark:text-[#e38b8b]">
                  {uploadError}
                </div>
              )}

              {uploadMode === 'file' ? (
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1.5">
                    Files (AES-256-GCM Encrypted)
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-dashed border-[#c4bfb4] dark:border-[#363d37] p-6 text-center hover:border-[#0f1210] transition-colors cursor-pointer bg-[#f3f0e9]/50 dark:bg-[#0c0e0c]/50"
                  >
                    <Upload className="w-5 h-5 text-[#6a716b] mx-auto mb-2" />
                    <div className="text-xs font-medium text-[#0f1210] dark:text-[#f3f0e9]">
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
              ) : uploadMode === 'embed' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                      Video URL or &lt;iframe&gt; Embed Code *
                    </label>
                    <textarea
                      rows={3}
                      value={uploadEmbedUrl}
                      onChange={(e) => setUploadEmbedUrl(e.target.value)}
                      required
                      placeholder="Paste YouTube, Vimeo, Loom, Google Drive link, direct .mp4 URL, or <iframe src='...'> embed code"
                      className="w-full px-3 py-2 text-xs font-mono-tabular bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                    />
                  </div>
                  {uploadEmbedUrl.trim() && (
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                        Live Embed Preview
                      </div>
                      <EmbeddedVideoFrame
                        embedUrl={uploadEmbedUrl}
                        title={uploadTitle || 'Video Preview'}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                    Observation / Text Content
                  </label>
                  <textarea
                    rows={5}
                    value={uploadTextContent}
                    onChange={(e) => setUploadTextContent(e.target.value)}
                    required
                    placeholder="Enter contemporaneous log, transcript, or record text…"
                    className="w-full px-3 py-2 text-[13px] bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                    Title {pendingFiles.length > 1 ? '(optional for batch)' : '*'}
                  </label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    required={uploadMode === 'note' || pendingFiles.length <= 1}
                    placeholder="Exhibit or document title"
                    className="w-full px-3 py-2 text-[13px] bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                    Classification / Type
                  </label>
                  <input
                    type="text"
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value)}
                    placeholder="e.g. Court Filing, Body-Cam, CAD Log"
                    className="w-full px-3 py-2 text-[13px] bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                  Description / Notes
                </label>
                <textarea
                  rows={2}
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Optional provenance or summary…"
                  className="w-full px-3 py-2 text-[13px] bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                  Tags (comma-separated for search &amp; Nexus)
                </label>
                <input
                  type="text"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  placeholder="arrest-sequence, 911-cad, timeline"
                  className="w-full px-3 py-2 text-[13px] bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                />
              </div>

              {cases.length > 0 && (
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1.5">
                    Link to Case(s)
                  </label>
                  <div className="max-h-28 overflow-y-auto border border-[#ddd8ce] dark:border-[#262b27] p-2 space-y-1 bg-[#f3f0e9] dark:bg-[#0c0e0c]">
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
                        <span className="font-mono-tabular text-[#6a716b]">{c.caseNumber}</span>
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
                <span>Make eligible for Public Archive (appears when linked case site is published)</span>
              </label>

              <div className="pt-3 border-t border-[#ddd8ce] dark:border-[#262b27] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] hover:opacity-85 disabled:opacity-50 cursor-pointer"
                >
                  {uploading ? 'Encrypting & Saving…' : 'Save to Vault'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collection Builder Modal */}
      {showCollectionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-3.5 border-b border-[#ddd8ce] dark:border-[#262b27] flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {editingCollection ? 'Edit Evidence Collection' : 'Build Evidence Collection'}
              </h2>
              <button
                type="button"
                onClick={() => setShowCollectionModal(false)}
                className="p-1 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCollection} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                  Collection Title *
                </label>
                <input
                  type="text"
                  value={colTitle}
                  onChange={(e) => setColTitle(e.target.value)}
                  required
                  placeholder="e.g. Arrest Sequence – Mar 7"
                  className="w-full px-3 py-2 text-[13px] bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                  Contextual Explanation *
                </label>
                <textarea
                  rows={4}
                  value={colExplanation}
                  onChange={(e) => setColExplanation(e.target.value)}
                  required
                  placeholder="Explain what these selected items demonstrate together and their evidentiary context…"
                  className="w-full px-3 py-2 text-[13px] bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                  Collection Cover Image
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={colCoverUrl}
                    onChange={(e) => setColCoverUrl(e.target.value)}
                    placeholder="Upload a cover image or paste URL…"
                    className="flex-1 px-3 py-2 text-xs bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => colCoverInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] cursor-pointer"
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
                  <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                    Assign to Case (Optional)
                  </label>
                  <select
                    value={colCaseId}
                    onChange={(e) => setColCaseId(e.target.value)}
                    className="w-full px-3 py-2 text-[13px] bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
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
                  <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={colTags}
                    onChange={(e) => setColTags(e.target.value)}
                    placeholder="sequence, custody, exhibit"
                    className="w-full px-3 py-2 text-[13px] bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1.5">
                  Included Vault &amp; Evidence Items ({colItemIds.length} selected)
                </label>
                <div className="max-h-40 overflow-y-auto border border-[#ddd8ce] dark:border-[#262b27] p-2.5 space-y-1.5 bg-[#f3f0e9] dark:bg-[#0c0e0c]">
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
                      <span className="font-mono-tabular uppercase text-[10px] text-[#6a716b]">
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

              <div className="pt-3 border-t border-[#ddd8ce] dark:border-[#262b27] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCollectionModal(false)}
                  className="px-4 py-2 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCollection}
                  className="px-4 py-2 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] hover:opacity-85 disabled:opacity-50 cursor-pointer"
                >
                  {savingCollection ? 'Saving…' : 'Save Collection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Item Modal */}
      {activeItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#ddd8ce] dark:border-[#262b27] flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10px] font-mono-tabular uppercase tracking-[0.08em] text-[#2d5a3d] dark:text-[#7fb892]">
                  {activeItem.category} · {activeItem.mediaType} ·{' '}
                  {activeItem.embedUrl ? 'Embedded Stream' : 'AES-256-GCM Encrypted'}
                </div>
                <h3 className="text-sm font-semibold truncate">{activeItem.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveItem(null)}
                className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5">
              <VaultItemPreviewStage item={activeItem} />

              <div className="lg:col-span-5 space-y-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
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
                        className="text-xs font-medium text-[#2d5a3d] dark:text-[#7fb892] hover:underline cursor-pointer"
                      >
                        Switch to {activeItem.isPublic ? 'Private' : 'Public'}
                      </button>
                    )}
                  </div>
                </div>

                {activeItem.embedUrl && canEdit && (
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                      Video / Media Embed URL
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editingEmbedUrl}
                        onChange={(e) => setEditingEmbedUrl(e.target.value)}
                        placeholder="Paste video URL or <iframe> embed code"
                        className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono-tabular bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] outline-none"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const parsed = parseVideoEmbed(editingEmbedUrl);
                          if (!parsed) return;
                          await updateVaultItem(activeItem, { embedUrl: parsed.embedUrl });
                          setActiveItem({ ...activeItem, embedUrl: parsed.embedUrl });
                          setEditingEmbedUrl(parsed.embedUrl);
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] cursor-pointer"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                )}

                {activeItem.description && (
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                      Description
                    </div>
                    <p className="text-xs text-[#0f1210]/85 dark:text-[#f3f0e9]/85 leading-relaxed">
                      {activeItem.description}
                    </p>
                  </div>
                )}

                <div>
                  <div className="text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                    Tags
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#0f1210]/85 dark:text-[#f3f0e9]/85">
                    <Tag className="w-3.5 h-3.5 text-[#6a716b]" />
                    <span>{activeItem.tags.length ? activeItem.tags.join(', ') : 'No tags'}</span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1.5">
                    Linked Cases
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto border border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9] dark:bg-[#0c0e0c] p-2">
                    {cases.length === 0 ? (
                      <div className="text-xs text-[#6a716b]">No cases available</div>
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
                            <span className="font-mono-tabular text-[#6a716b]">{c.caseNumber}</span>
                            <span className="truncate">{c.title}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#ddd8ce] dark:border-[#262b27] flex flex-wrap gap-2">
                  {activeItem.fileId && (
                    <VaultDownloadLink
                      fileId={activeItem.fileId}
                      fileName={activeItem.fileName || activeItem.title}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] hover:border-[#0f1210] cursor-pointer"
                    />
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#8b3a3a]/40 text-[#8b3a3a] dark:text-[#e38b8b] hover:bg-[#8b3a3a]/10 cursor-pointer"
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
          <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#ddd8ce] dark:border-[#262b27] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#2d5a3d] dark:text-[#7fb892]" />
                <h3 className="text-sm font-semibold">{activeCollection.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveCollection(null)}
                className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {activeCollection.coverImageUrl && (
                <VaultImage
                  src={activeCollection.coverImageUrl}
                  alt={activeCollection.title}
                  className="w-full h-52 object-cover border border-[#ddd8ce] dark:border-[#262b27]"
                />
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-[#6a716b]">
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
                      className="px-3 py-1.5 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] cursor-pointer"
                    >
                      Edit Collection
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteEvidenceCollection(activeCollection.id);
                        setActiveCollection(null);
                      }}
                      className="px-3 py-1.5 text-xs font-medium border border-[#8b3a3a]/40 text-[#8b3a3a] dark:text-[#e38b8b] cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-1">
                  Contextual Explanation
                </div>
                <p className="text-[13px] text-[#0f1210]/85 dark:text-[#f3f0e9]/85 leading-relaxed whitespace-pre-line">
                  {activeCollection.explanation}
                </p>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.08em] text-[#6a716b] mb-2">
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
                        className="text-left p-3 border border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9] dark:bg-[#0c0e0c] hover:border-[#0f1210] flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-[10px] font-mono-tabular uppercase text-[#2d5a3d] dark:text-[#7fb892]">
                            {item.mediaType}
                          </div>
                          <div className="text-xs font-medium truncate">{item.title}</div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-[#6a716b] shrink-0" />
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
