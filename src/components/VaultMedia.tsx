import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { extractVaultFileId, fetchDecryptedVaultBlobUrl } from '../utils/vaultApi';

export function useResolvedVaultUrl(fileIdOrUrl?: string): {
  url: string;
  loading: boolean;
  error: boolean;
} {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (!fileIdOrUrl) {
      setUrl('');
      setLoading(false);
      setError(false);
      return;
    }

    const vfId = extractVaultFileId(fileIdOrUrl);
    if (!vfId) {
      // Static asset or direct external URL
      setUrl(fileIdOrUrl);
      setLoading(false);
      setError(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    fetchDecryptedVaultBlobUrl(vfId)
      .then((resolved) => {
        if (!cancelled) setUrl(resolved);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fileIdOrUrl]);

  return { url, loading, error };
}

interface VaultImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}

export const VaultImage: React.FC<VaultImageProps> = ({
  src,
  alt,
  className = '',
  fallback = null,
}) => {
  const { url, loading, error } = useResolvedVaultUrl(src);

  if (!src || error) {
    return <>{fallback}</>;
  }
  if (loading || !url) {
    return <div className={`animate-pulse bg-zinc-200 dark:bg-zinc-800 ${className}`} />;
  }
  return <img src={url} alt={alt} referrerPolicy="no-referrer" className={className} />;
};

interface VaultDownloadLinkProps {
  fileId: string;
  fileName?: string;
  className?: string;
  children?: React.ReactNode;
}

export const VaultDownloadLink: React.FC<VaultDownloadLinkProps> = ({
  fileId,
  fileName,
  className = '',
  children,
}) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const url = await fetchDecryptedVaultBlobUrl(fileId);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || fileId;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button type="button" onClick={handleDownload} disabled={downloading} className={className}>
      {children || (
        <>
          <Download className="w-3.5 h-3.5" />
          <span>{downloading ? 'Decrypting...' : 'Download Original File'}</span>
        </>
      )}
    </button>
  );
};
