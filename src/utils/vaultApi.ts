import { auth } from '../firebase';
import type { MediaType } from '../types';

export interface UploadedVaultFile {
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  encrypted: boolean;
}

export function inferMediaType(mimeType: string, fileName: string): MediaType {
  const lowerMime = mimeType.toLowerCase();
  const lowerName = fileName.toLowerCase();
  if (lowerMime.includes('pdf') || lowerName.endsWith('.pdf')) return 'pdf';
  if (lowerMime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/.test(lowerName)) {
    return 'image';
  }
  if (lowerMime.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv|avi)$/.test(lowerName)) {
    return 'video';
  }
  if (lowerMime.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|flac|aac)$/.test(lowerName)) {
    return 'audio';
  }
  if (lowerMime.startsWith('text/') || /\.(txt|md|log|csv|json)$/.test(lowerName)) {
    return 'text';
  }
  return 'file';
}

export async function uploadEncryptedVaultFile(
  file: File,
  isPublic = false
): Promise<UploadedVaultFile> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('Authentication required to upload files.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('isPublic', String(isPublic));

  const res = await fetch('/api/vault/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'Failed to upload encrypted file.');
  }

  return (await res.json()) as UploadedVaultFile;
}

export async function syncVaultFileVisibility(
  fileId: string,
  isPublic: boolean
): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token || !fileId) return;

  await fetch(`/api/vault/visibility/${encodeURIComponent(fileId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ isPublic }),
  }).catch(() => {
    // Non-fatal if file is external or static
  });
}

export async function deleteVaultFileAsset(fileId: string): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token || !fileId) return;

  await fetch(`/api/vault/file/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => {
    // Non-fatal cleanup
  });
}

export function getVaultFileUrl(
  fileId: string | undefined,
  token: string | null,
  isPublic: boolean
): string {
  if (!fileId) return '';
  if (isPublic || !token) {
    return `/api/vault/file/${encodeURIComponent(fileId)}`;
  }
  return `/api/vault/file/${encodeURIComponent(fileId)}?token=${encodeURIComponent(token)}`;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, idx);
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}
