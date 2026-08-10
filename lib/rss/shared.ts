import Parser from 'rss-parser';

export type RSSMediaObject = {
  $?: {
    url?: string;
  };
  url?: string;
};

export type RSSEnclosure = {
  url?: string;
  type?: string;
};

export type RSSItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  contentSnippet?: string;
  content?: string;
  description?: string;
  media?: RSSMediaObject | RSSMediaObject[];
  thumbnail?: RSSMediaObject | RSSMediaObject[] | string;
  enclosure?: RSSEnclosure;
  contentEncoded?: string;
};

export const FETCH_HEADERS: HeadersInit = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const ttlCache = new Map<string, CacheEntry<unknown>>();

export function createRssParser(): Parser<object, RSSItem> {
  return new Parser<object, RSSItem>({
    customFields: {
      item: [
        ['media:content', 'media'],
        ['media:thumbnail', 'thumbnail'],
        ['description', 'description'],
        ['content:encoded', 'contentEncoded'],
        ['enclosure', 'enclosure'],
      ],
    },
  });
}

function pickMediaUrl(
  media: RSSMediaObject | RSSMediaObject[] | string | undefined,
): string | undefined {
  if (!media) {
    return undefined;
  }

  if (typeof media === 'string') {
    return media || undefined;
  }

  if (Array.isArray(media)) {
    for (const mediaItem of media) {
      const url = mediaItem.$?.url || mediaItem.url;
      if (url) {
        return url;
      }
    }
    return undefined;
  }

  return media.$?.url || media.url;
}

function extractImgSrc(html: string | undefined): string | undefined {
  if (!html) {
    return undefined;
  }

  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imgMatch?.[1];
}

export function extractImageUrl(item: RSSItem): string | undefined {
  try {
    const mediaUrl = pickMediaUrl(item.media);
    if (mediaUrl) {
      return mediaUrl;
    }

    const thumbnailUrl = pickMediaUrl(item.thumbnail);
    if (thumbnailUrl) {
      return thumbnailUrl;
    }

    if (item.enclosure?.url) {
      if (item.enclosure.type?.startsWith('image/')) {
        return item.enclosure.url;
      }

      if (item.enclosure.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        return item.enclosure.url;
      }
    }

    return (
      extractImgSrc(item.contentEncoded) ||
      extractImgSrc(item.description) ||
      extractImgSrc(item.content)
    );
  } catch (error) {
    console.error('RSS 이미지 추출 실패:', error);
  }

  return undefined;
}

export function cleanDescription(
  description: string,
  options?: { maxLength?: number; emptyFallback?: string },
): string {
  const maxLength = options?.maxLength ?? 180;
  const emptyFallback = options?.emptyFallback ?? '내용 없음';

  if (!description) {
    return emptyFallback;
  }

  let cleaned = description
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');

  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'");

  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  if (!cleaned) {
    return emptyFallback;
  }

  if (cleaned.length > maxLength) {
    return `${cleaned.substring(0, maxLength)}...`;
  }

  return cleaned;
}

export async function fetchText(
  url: string,
  options?: { timeoutMs?: number; headers?: HeadersInit },
): Promise<string> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  const headers = options?.headers ?? FETCH_HEADERS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`요청 실패: ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

export function makeAbsoluteUrl(baseUrl: string, href: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }

  return new URL(href, baseUrl).toString();
}

export async function withTtlCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const cached = ttlCache.get(key) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const value = await loader();
  ttlCache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}
