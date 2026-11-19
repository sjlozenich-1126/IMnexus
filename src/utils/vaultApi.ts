import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import type { MediaType } from '../types';

export interface UploadedVaultFile {
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  encrypted: boolean;
}

const CHUNK_BYTE_SIZE = 450 * 1024; // 450KB binary -> ~600KB base64, safely under Firestore 1MB doc limit
const MAX_CLOUD_FILE_BYTES = 15 * 1024 * 1024; // 15MB max per cloud vault file

const decryptedBlobUrlCache = new Map<string, string>();
const inFlightDecrypts = new Map<string, Promise<string>>();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function extractVaultFileId(urlOrId?: string): string | null {
  if (!urlOrId) return null;
  if (urlOrId.startsWith('vault://')) {
    return urlOrId.slice('vault://'.length);
  }
  if (urlOrId.startsWith('/api/vault/file/')) {
    return urlOrId.slice('/api/vault/file/'.length).split('?')[0];
  }
  if (/^vf_[a-zA-Z0-9_\-]+$/.test(urlOrId)) {
    return urlOrId;
  }
  return null;
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
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Authentication required to upload files.');
  }
  if (file.size > MAX_CLOUD_FILE_BYTES) {
    throw new Error('File exceeds 15 MB cloud vault limit. Please upload a file under 15 MB.');
  }

  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const sha256 = bytesToHex(new Uint8Array(hashBuffer));

  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', aesKey));
  const keyB64 = bytesToBase64(rawKey);

  const fileId = `vf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const totalBytes = new Uint8Array(buffer);
  const chunkCount = Math.max(1, Math.ceil(totalBytes.length / CHUNK_BYTE_SIZE));
  const mimeType = file.type || 'application/octet-stream';
  const fileName = (file.name || `${fileId}.bin`).slice(0, 260);

  const manifestPath = `vaultFiles/${fileId}`;
  try {
    await setDoc(doc(db, 'vaultFiles', fileId), {
      fileId,
      ownerId: uid,
      memberUids: [uid],
      fileName,
      mimeType: mimeType.slice(0, 160),
      fileSize: file.size,
      sha256,
      chunkCount,
      keyB64,
      isPublic,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, manifestPath);
  }

  for (let i = 0; i < chunkCount; i += 1) {
    const start = i * CHUNK_BYTE_SIZE;
    const end = Math.min(totalBytes.length, start + CHUNK_BYTE_SIZE);
    const slice = totalBytes.subarray(start, end);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, slice);
    const chunkId = `c_${i}`;
    const chunkPath = `vaultFiles/${fileId}/chunks/${chunkId}`;
    try {
      await setDoc(doc(db, 'vaultFiles', fileId, 'chunks', chunkId), {
        id: chunkId,
        fileId,
        index: i,
        ivB64: bytesToBase64(iv),
        dataB64: bytesToBase64(new Uint8Array(encrypted)),
        ownerId: uid,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, chunkPath);
    }
  }

  // Warm the local cache immediately so previews appear instantaneously
  const immediateBlobUrl = URL.createObjectURL(new Blob([buffer], { type: mimeType }));
  decryptedBlobUrlCache.set(fileId, immediateBlobUrl);

  return {
    fileId,
    fileName,
    mimeType,
    fileSize: file.size,
    sha256,
    encrypted: true,
  };
}

export async function fetchDecryptedVaultBlobUrl(fileId: string): Promise<string> {
  const cached = decryptedBlobUrlCache.get(fileId);
  if (cached) return cached;

  const existingPromise = inFlightDecrypts.get(fileId);
  if (existingPromise) return existingPromise;

  const task = (async () => {
    const manifestPath = `vaultFiles/${fileId}`;
    let manifestData: {
      mimeType: string;
      keyB64: string;
      chunkCount: number;
    } | null = null;

    try {
      const snap = await getDoc(doc(db, 'vaultFiles', fileId));
      if (!snap.exists()) {
        throw new Error('Encrypted file manifest not found in Cloud Firestore.');
      }
      manifestData = snap.data() as {
        mimeType: string;
        keyB64: string;
        chunkCount: number;
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, manifestPath);
    }

    const chunksPath = `vaultFiles/${fileId}/chunks`;
    let chunks: Array<{ index: number; ivB64: string; dataB64: string }> = [];
    try {
      const chunkSnap = await getDocs(collection(db, 'vaultFiles', fileId, 'chunks'));
      chunks = chunkSnap.docs
        .map((d) => d.data() as { index: number; ivB64: string; dataB64: string })
        .sort((a, b) => a.index - b.index);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, chunksPath);
    }

    const rawKeyBytes = base64ToBytes(manifestData.keyB64);
    const keyBuf = new ArrayBuffer(rawKeyBytes.byteLength);
    new Uint8Array(keyBuf).set(rawKeyBytes);
    const aesKey = await crypto.subtle.importKey('raw', keyBuf, 'AES-GCM', false, ['decrypt']);

    const decryptedParts: ArrayBuffer[] = [];
    for (const chunk of chunks) {
      const ivRaw = base64ToBytes(chunk.ivB64);
      const ivBuf = new ArrayBuffer(ivRaw.byteLength);
      new Uint8Array(ivBuf).set(ivRaw);

      const cipherRaw = base64ToBytes(chunk.dataB64);
      const cipherBuf = new ArrayBuffer(cipherRaw.byteLength);
      new Uint8Array(cipherBuf).set(cipherRaw);

      const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBuf },
        aesKey,
        cipherBuf
      );
      decryptedParts.push(plainBuf);
    }

    const blob = new Blob(decryptedParts, {
      type: manifestData.mimeType || 'application/octet-stream',
    });
    const url = URL.createObjectURL(blob);
    decryptedBlobUrlCache.set(fileId, url);
    return url;
  })().finally(() => {
    inFlightDecrypts.delete(fileId);
  });

  inFlightDecrypts.set(fileId, task);
  return task;
}

export async function syncVaultFileVisibility(
  fileId: string,
  isPublic: boolean
): Promise<void> {
  const cleanId = extractVaultFileId(fileId);
  if (!cleanId) return;
  try {
    const ref = doc(db, 'vaultFiles', cleanId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        isPublic,
        updatedAt: serverTimestamp(),
      });
    }
  } catch {
    // Ignore if file manifest does not exist in Firestore
  }
}

export async function deleteVaultFileAsset(fileId: string): Promise<void> {
  const cleanId = extractVaultFileId(fileId);
  if (!cleanId) return;
  decryptedBlobUrlCache.delete(cleanId);
  try {
    const chunkSnap = await getDocs(collection(db, 'vaultFiles', cleanId, 'chunks'));
    await Promise.all(chunkSnap.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(doc(db, 'vaultFiles', cleanId));
  } catch {
    // Best-effort cleanup
  }
}

export function getVaultFileUrl(
  fileId: string | undefined,
  _token: string | null,
  _isPublic: boolean
): string {
  if (!fileId) return '';
  return decryptedBlobUrlCache.get(fileId) || '';
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, idx);
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}
