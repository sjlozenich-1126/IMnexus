export interface ParsedVideoEmbed {
  kind: 'iframe' | 'video';
  embedUrl: string;
  originalUrl: string;
  provider: string;
  thumbnailUrl?: string;
}

const DIRECT_VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|ogv|ogg)(\?.*)?$/i;

function extractRawSrcFromSnippet(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Support pasting full <iframe ... src="..."> or <video ... src="..."> embed HTML
  if (trimmed.startsWith('<')) {
    try {
      if (typeof DOMParser !== 'undefined') {
        const doc = new DOMParser().parseFromString(trimmed, 'text/html');
        const iframe = doc.querySelector('iframe[src]');
        if (iframe?.getAttribute('src')) {
          return iframe.getAttribute('src')!.trim();
        }
        const video = doc.querySelector('video[src], video source[src]');
        if (video?.getAttribute('src')) {
          return video.getAttribute('src')!.trim();
        }
      }
    } catch {
      // Fallback regex below
    }
    const srcMatch = trimmed.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (srcMatch?.[1]) {
      return srcMatch[1].trim();
    }
  }

  return trimmed;
}

function normalizeSafeUrl(candidate: string): URL | null {
  let cleaned = candidate.trim();
  if (!cleaned) return null;
  if (cleaned.startsWith('//')) {
    cleaned = `https:${cleaned}`;
  } else if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }

  try {
    const url = new URL(cleaned);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function parseVideoEmbed(rawInput: string): ParsedVideoEmbed | null {
  const rawSrc = extractRawSrcFromSnippet(rawInput);
  if (!rawSrc) return null;

  const url = normalizeSafeUrl(rawSrc);
  if (!url) return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const href = url.toString();

  // 1. YouTube (watch, youtu.be, shorts, live, embed, youtube-nocookie)
  if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'youtu.be' ||
    host === 'youtube-nocookie.com'
  ) {
    let videoId = '';
    if (host === 'youtu.be') {
      videoId = url.pathname.split('/').filter(Boolean)[0] || '';
    } else if (url.pathname.startsWith('/embed/')) {
      videoId = url.pathname.split('/')[2] || '';
    } else if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/live/')) {
      videoId = url.pathname.split('/')[2] || '';
    } else {
      videoId = url.searchParams.get('v') || '';
    }

    if (videoId && /^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
      return {
        kind: 'iframe',
        embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0`,
        originalUrl: href,
        provider: 'YouTube',
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      };
    }
  }

  // 2. Vimeo
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const segments = url.pathname.split('/').filter(Boolean);
    const numericId = [...segments].reverse().find((s) => /^\d+$/.test(s));
    if (numericId) {
      return {
        kind: 'iframe',
        embedUrl: `https://player.vimeo.com/video/${numericId}`,
        originalUrl: href,
        provider: 'Vimeo',
      };
    }
  }

  // 3. Loom
  if (host === 'loom.com' || host === 'www.loom.com') {
    const match = url.pathname.match(/\/(?:share|embed)\/([a-zA-Z0-9]+)/);
    if (match?.[1]) {
      return {
        kind: 'iframe',
        embedUrl: `https://www.loom.com/embed/${match[1]}`,
        originalUrl: href,
        provider: 'Loom',
      };
    }
  }

  // 4. Google Drive
  if (host === 'drive.google.com') {
    const match = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match?.[1]) {
      return {
        kind: 'iframe',
        embedUrl: `https://drive.google.com/file/d/${match[1]}/preview`,
        originalUrl: href,
        provider: 'Google Drive',
      };
    }
  }

  // 5. Dailymotion
  if (host === 'dailymotion.com' || host === 'dai.ly' || host === 'geo.dailymotion.com') {
    let vid = '';
    if (host === 'dai.ly') {
      vid = url.pathname.split('/').filter(Boolean)[0] || '';
    } else {
      const m = url.pathname.match(/\/(?:embed\/)?video\/([a-zA-Z0-9]+)/);
      if (m?.[1]) vid = m[1];
    }
    if (vid) {
      return {
        kind: 'iframe',
        embedUrl: `https://www.dailymotion.com/embed/video/${vid}`,
        originalUrl: href,
        provider: 'Dailymotion',
      };
    }
  }

  // 6. Streamable
  if (host === 'streamable.com') {
    const seg = url.pathname.split('/').filter(Boolean).pop() || '';
    if (seg && /^[a-zA-Z0-9]+$/.test(seg)) {
      return {
        kind: 'iframe',
        embedUrl: `https://streamable.com/e/${seg}`,
        originalUrl: href,
        provider: 'Streamable',
      };
    }
  }

  // 7. Direct HTML5 Video File URL
  if (DIRECT_VIDEO_EXT_RE.test(url.pathname + url.search)) {
    return {
      kind: 'video',
      embedUrl: href,
      originalUrl: href,
      provider: 'Direct Video',
    };
  }

  // 8. Any other HTTPS iframe embed URL (Rumble, C-SPAN, Internet Archive, Cloudflare Stream, Vimeo Showcase, etc.)
  return {
    kind: 'iframe',
    embedUrl: href,
    originalUrl: href,
    provider: host,
  };
}
