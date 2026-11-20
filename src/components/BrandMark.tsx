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

export const StatusLabel: React.FC<{ status: string; variant?: 'default' | 'bright' }> = ({
  status,
  variant = 'default',
}) => {
  const s = status.toLowerCase();

  if (variant === 'bright') {
    let brightCls =
      'bg-[#faf8f4] text-[#0f1210] border-[#c4bfb4] font-semibold';
    if (s === 'active') {
      brightCls =
        'bg-[#ff4d1c] text-white border-[#ff8566] font-semibold shadow-xs';
    } else if (
      s === 'closed' ||
      s === 'dismissed' ||
      s === 'public' ||
      s === 'published' ||
      s === 'owner' ||
      s === 'admin'
    ) {
      brightCls =
        'bg-[#10b981] text-[#041b11] border-[#34d399] font-semibold shadow-xs';
    } else if (s === 'in review' || s === 'editor') {
      brightCls =
        'bg-[#f59e0b] text-[#1a1204] border-[#fbbf24] font-semibold shadow-xs';
    }
    return (
      <span
        className={`inline-block text-[11px] uppercase tracking-[0.06em] px-2.5 py-0.5 rounded-[2px] border whitespace-nowrap ${brightCls}`}
      >
        {status}
      </span>
    );
  }

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
