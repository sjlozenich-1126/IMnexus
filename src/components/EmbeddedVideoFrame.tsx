import React from 'react';
import { ExternalLink, Film } from 'lucide-react';
import { parseVideoEmbed } from '../utils/mediaEmbed';

interface EmbeddedVideoFrameProps {
  embedUrl: string;
  title: string;
  className?: string;
  compact?: boolean;
}

export const EmbeddedVideoFrame: React.FC<EmbeddedVideoFrameProps> = ({
  embedUrl,
  title,
  className = '',
  compact = false,
}) => {
  const parsed = parseVideoEmbed(embedUrl);

  if (!parsed) {
    return (
      <div className="p-6 bg-[#f3f0e9] dark:bg-[#111413] border border-[#ddd8ce] dark:border-[#262b27] text-center text-xs text-[#8b3a3a] dark:text-[#e38b8b]">
        Invalid or unsupported embed URL. Provide an HTTPS video URL or iframe embed snippet.
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div
        className={`relative w-full overflow-hidden bg-black border border-[#ddd8ce] dark:border-[#262b27] ${
          compact ? 'aspect-[16/10]' : 'aspect-video'
        }`}
      >
        {parsed.kind === 'video' ? (
          <video
            src={parsed.embedUrl}
            controls
            playsInline
            preload="metadata"
            className="w-full h-full object-contain bg-black"
          />
        ) : (
          <iframe
            title={title}
            src={parsed.embedUrl}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          />
        )}
      </div>

      {!compact && (
        <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tabular text-[#6a716b] dark:text-[#8d948e]">
          <span className="inline-flex items-center gap-1">
            <Film className="w-3 h-3" />
            <span>Embedded Stream · {parsed.provider}</span>
          </span>
          <a
            href={parsed.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-[#ef4423] dark:hover:text-[#ff6b3d] transition-colors"
          >
            <span>Open Source</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
};
