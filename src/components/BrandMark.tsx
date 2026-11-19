import React from 'react';

interface BrandMarkProps {
  className?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ className = '' }) => (
  <span className={`inline-flex items-baseline select-none ${className}`}>
    <span className="font-semibold uppercase tracking-[0.14em]">IM</span>
    <span className="font-normal tracking-[0.06em]">nexus</span>
  </span>
);

export const StatusLabel: React.FC<{ status: string }> = ({ status }) => {
  const s = status.toLowerCase();
  let cls =
    'bg-transparent text-[#6a716b] border-[#ddd8ce] dark:text-[#8d948e] dark:border-[#2a302b]';
  if (s === 'dismissed' || s === 'public' || s === 'published' || s === 'closed' || s === 'owner' || s === 'admin') {
    cls =
      'bg-transparent text-[#2d5a3d] border-[#a8c4b0] dark:text-[#7fb892] dark:border-[#2d4f3a]';
  } else if (s === 'active' || s === 'in review' || s === 'editor') {
    cls =
      'bg-transparent text-[#7a642e] border-[#d4c9a8] dark:text-[#d4bc7d] dark:border-[#524626]';
  }
  return (
    <span
      className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-[2px] border whitespace-nowrap ${cls}`}
    >
      {status}
    </span>
  );
};
