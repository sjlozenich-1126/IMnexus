import React from 'react';

interface BrandMarkProps {
  className?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ className = '' }) => (
  <span className={`inline-flex items-baseline select-none tracking-[0.02em] ${className}`}>
    <span className="font-extrabold uppercase tracking-[0.04em]">IM</span>
    <span className="font-normal lowercase tracking-[0.01em]">nexus</span>
  </span>
);

export const StatusLabel: React.FC<{ status: string }> = ({ status }) => {
  const s = status.toLowerCase();
  let cls =
    'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
  if (s === 'dismissed' || s === 'public' || s === 'published' || s === 'closed') {
    cls =
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
  } else if (s === 'active' || s === 'in review') {
    cls =
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
  }
  return (
    <span
      className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${cls}`}
    >
      {status}
    </span>
  );
};
