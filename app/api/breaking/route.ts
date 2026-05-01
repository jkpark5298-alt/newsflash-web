import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

type NewsCategory = '국내' | '국제';

type RSSMediaObject = {
  $?: {
    url?: string;
  };
  url?: string;
};

type RSSEnclosure = {
  url?: string;
  type?: string;
};

type RSSItem = {
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

interface Article {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  category: NewsCategory;
  imageUrl?: string;
}

interface RSSFeedConfig {
  url: string;
  source: string;
  category: NewsCategory;
  limit: number;
}

const BREAKING_MAX_AGE_HOURS = 12;
const YTN_RECENT_LIMIT = 8;
const YTN_MAX_AGE_HOURS = 12;

const parser: Parser<object, RSSItem> = new Parser<object, RSSItem>({
  customFields: {
    item: [
      ['media:content', 'media'],
      ['media:thumbnail', 'thumbnail'],
      ['description', 'description'],
      ['content:encoded', 'contentEncoded'],
      ['enclosure', 'enclosure']
    ]
  }
});

const RSS_FEEDS: RSSFeedConfig[] = [
  {
    url: 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01&plink=RSSREADER',
    source: 'SBS',
    category: '국내',
    limit: 12
  },
  {
    url: 'https://news.sbs.co.kr/news/headlineRssFeed.do?plink=RSSREADER',
    source: 'SBS 주요뉴스',
    category: '국내',
    limit: 12
  },
  {
    url: 'https://imnews.imbc.com/rss/google_news/narrativeNews.rss',
    source: 'MBC',
    category: '국내',
    limit: 15
  },
  {
    url: 'https://imnews.imbc.com/rss/news/news_00.xml',
    source: 'MBC',
    category: '국내',
    limit: 15
  },
  {
    url: 'https://www.yonhapnewstv.co.kr/category/news/headline/feed/',
    source: '연합뉴스TV',
    category: '국내',
    limit: 12
  },
  {
    url: 'https://www.newsis.com/RSS/sokbo.xml',
    source: '뉴시스',
    category: '국내',
    limit: 15
  },
  {
    url: 'https://www.mk.co.kr/rss/30000001/',
    source: '매일경제',
    category: '국내',
    limit: 10
  },
  {
    url: 'https://www.khan.co.kr/rss/rssdata/total_news.xml',
    source: '경향신문',
    category: '국내',
    limit: 10
  },
  {
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    source: 'BBC News',
    category: '국제',
    limit: 10
  },
  {
    url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    source: 'New York Times',
    category: '국제',
    limit: 10
  },
  {
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    source: 'Al Jazeera',
    category: '국제',
    limit: 10
  },
  {
    url: 'https://www.theguardian.com/world/rss',
    source: 'The Guardian',
    category: '국제',
    limit: 10
  }
];

const YTN_RECENT_URL = 'https://www.ytn.co.kr/news/list.php?mcd=recentnews';

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

const YTN_EXCLUDED_TITLE_KEYWORDS = [
  '나이트포커스',
  '이게웬날리',
  '뉴스퀘어',
  '뉴스나이트',
  '더뉴스',
  '뉴스UP',
  '뉴스 ON',
  '뉴스ON',
  '뉴스와이드',
  '굿모닝 와이티엔',
  '굿모닝 YTN',
  'YTN24',
  'YTN 라디오',
  '돌발영상',
  '자막뉴스',
  '앵커리포트',
  '뉴스라이더',
  '이 시각 세계',
  '날씨',
  '제보',
  '다시보기',
  '라이브',
  '실시간',
  '편성표'
];

const YTN_EXCLUDED_LINK_KEYWORDS = [
  'live',
  'program',
  'replay',
  'vod',
  'schedule',
  'radio',
  'weather'
];

function extractImageUrl(item: RSSItem): string | undefined {
  try {
    if (item.media) {
      if (Array.isArray(item.media)) {
        for (const mediaItem of item.media) {
          if (mediaItem.$?.url) {
            return mediaItem.$.url;
          }

          if (mediaItem.url) {
            return mediaItem.url;
          }
        }
      } else {
        if (item.media.$?.url) {
          return item.media.$.url;
        }

        if (item.media.url) {
          return item.media.url;
        }
      }
    }

    if (item.thumbnail) {
      if (typeof item.thumbnail === 'string') {
        return item.thumbnail;
      }

      if (Array.isArray(item.thumbnail)) {
        for (const thumbnailItem of item.thumbnail) {
          if (thumbnailItem.$?.url) {
            return thumbnailItem.$.url;
          }

          if (thumbnailItem.url) {
            return thumbnailItem.url;
          }
        }
      } else {
        if (item.thumbnail.$?.url) {
          return item.thumbnail.$.url;
        }

        if (item.thumbnail.url) {
          return item.thumbnail.url;
        }
      }
    }

    if (item.enclosure?.url) {
      if (item.enclosure.type?.startsWith('image/')) {
        return item.enclosure.url;
      }

      if (item.enclosure.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        return item.enclosure.url;
      }
    }

    if (item.contentEncoded) {
      const imgMatch = item.contentEncoded.match(/<img[^>]+src=["']([^"']+)["']/i);

      if (imgMatch?.[1]) {
        return imgMatch[1];
      }
    }

    if (item.description) {
      const imgMatch = item.description.match(/<img[^>]+src=["']([^"']+)["']/i);

      if (imgMatch?.[1]) {
        return imgMatch[1];
      }
    }

    if (item.content) {
      const imgMatch = item.content.match(/<img[^>]+src=["']([^"']+)["']/i);

      if (imgMatch?.[1]) {
        return imgMatch[1];
      }
    }
  } catch (error) {
    console.error('속보 이미지 추출 실패:', error);
  }

  return undefined;
}

function cleanDescription(description: string): string {
  if (!description) {
    return '내용 없음';
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
    return '내용 없음';
  }

  if (cleaned.length > 180) {
    return `${cleaned.substring(0, 180)}...`;
  }

  return cleaned;
}

function cleanTitle(title: string): string {
  return cleanDescription(title)
    .replace(/^\[?\s*속보\s*\]?\s*/g, '[속보] ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getItemDescription(item: RSSItem): string {
  return item.contentSnippet || item.description || item.content || item.contentEncoded || '';
}

function getItemPubDate(item: RSSItem): string | undefined {
  return item.pubDate || item.isoDate;
}

function normalizeTitle(title: string): string {
  return title
    .replace(/\s+/g, ' ')
    .replace(/[“”"']/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .trim()
    .toLowerCase();
}

function removeDuplicateArticles(articles: Article[]): Article[] {
  const seenTitles = new Set<string>();
  const seenLinks = new Set<string>();

  return articles.filter((article) => {
    const normalizedTitle = normalizeTitle(article.title);
    const normalizedLink = article.link.trim();

    if (!normalizedTitle) {
      return false;
    }

    if (normalizedLink && seenLinks.has(normalizedLink)) {
      return false;
    }

    if (seenTitles.has(normalizedTitle)) {
      return false;
    }

    seenTitles.add(normalizedTitle);

    if (normalizedLink) {
      seenLinks.add(normalizedLink);
    }

    return true;
  });
}

function normalizeDateValue(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function isRecentEnough(pubDate: string, maxAgeHours: number): boolean {
  const articleTime = new Date(pubDate).getTime();

  if (Number.isNaN(articleTime)) {
    return false;
  }

  const now = Date.now();
  const diffMs = now - articleTime;
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

  if (diffMs < -60 * 60 * 1000) {
    return false;
  }

  return diffMs <= maxAgeMs;
}

async function fetchRSSFeed({
  url,
  source,
  category,
  limit
}: RSSFeedConfig): Promise<Article[]> {
  try {
    const feed = await parser.parseURL(url);
    const articles: Article[] = [];

    for (const item of feed.items.slice(0, limit)) {
      const pubDate = normalizeDateValue(getItemPubDate(item));

      if (!pubDate) {
        continue;
      }

      if (!isRecentEnough(pubDate, BREAKING_MAX_AGE_HOURS)) {
        continue;
      }

      const article: Article = {
        title: cleanTitle(item.title || '제목 없음'),
        link: item.link || '#',
        pubDate,
        description: cleanDescription(getItemDescription(item)),
        source,
        category,
        imageUrl: extractImageUrl(item)
      };

      articles.push(article);
    }

    return articles;
  } catch (error) {
    console.error(`RSS 피드 가져오기 실패 (${source}):`, error);
    return [];
  }
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`요청 실패: ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

function makeAbsoluteUrl(baseUrl: string, href: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }

  return new URL(href, baseUrl).toString();
}

function parseYtnDateFromLink(link: string): string | undefined {
  const match = link.match(/_(\d{14})/);

  if (!match?.[1]) {
    return undefined;
  }

  const rawDate = match[1];

  const year = rawDate.slice(0, 4);
  const month = rawDate.slice(4, 6);
  const day = rawDate.slice(6, 8);
  const hour = rawDate.slice(8, 10);
  const minute = rawDate.slice(10, 12);
  const second = rawDate.slice(12, 14);

  const isoWithKoreanTimezone = `${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`;
  const parsed = new Date(isoWithKoreanTimezone);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function extractYtnDateFromHtml(fragment: string): string | undefined {
  const dateTimeMatch = fragment.match(
    /(\d{4})[-.](\d{1,2})[-.](\d{1,2})\s+(\d{1,2}):(\d{2})/
  );

  if (dateTimeMatch) {
    const [, year, month, day, hour, minute] = dateTimeMatch;
    const isoWithKoreanTimezone = `${year}-${month.padStart(2, '0')}-${day.padStart(
      2,
      '0'
    )}T${hour.padStart(2, '0')}:${minute}:00+09:00`;
    const parsed = new Date(isoWithKoreanTimezone);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  const timeOnlyMatch = fragment.match(/(\d{1,2}):(\d{2})/);

  if (timeOnlyMatch) {
    const now = new Date();
    const [, hour, minute] = timeOnlyMatch;
    const koreanNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

    koreanNow.setHours(Number(hour));
    koreanNow.setMinutes(Number(minute));
    koreanNow.setSeconds(0);
    koreanNow.setMilliseconds(0);

    return new Date(koreanNow.getTime() - 9 * 60 * 60 * 1000).toISOString();
  }

  return undefined;
}

function extractYtnPubDate(fragment: string, link: string): string {
  return parseYtnDateFromLink(link) || extractYtnDateFromHtml(fragment) || new Date().toISOString();
}

function extractYtnImageFromFragment(fragment: string): string | undefined {
  const imgMatch = fragment.match(/<img[^>]+src=["']([^"']+)["']/i);

  if (!imgMatch?.[1]) {
    return undefined;
  }

  return makeAbsoluteUrl('https://www.ytn.co.kr', imgMatch[1]);
}

function isYtnMenuOrProgramTitle(title: string): boolean {
  const normalizedTitle = title.replace(/\s+/g, '').toLowerCase();

  return YTN_EXCLUDED_TITLE_KEYWORDS.some((keyword) => {
    const normalizedKeyword = keyword.replace(/\s+/g, '').toLowerCase();
    return normalizedTitle.includes(normalizedKeyword);
  });
}

function isYtnMenuOrProgramLink(link: string): boolean {
  const normalizedLink = link.toLowerCase();

  return YTN_EXCLUDED_LINK_KEYWORDS.some((keyword) => normalizedLink.includes(keyword));
}

function isValidYtnArticle(title: string, link: string): boolean {
  const cleanedTitle = title.trim();

  if (!cleanedTitle) {
    return false;
  }

  if (cleanedTitle.length < 8) {
    return false;
  }

  if (isYtnMenuOrProgramTitle(cleanedTitle)) {
    return false;
  }

  if (isYtnMenuOrProgramLink(link)) {
    return false;
  }

  const hasArticleLikeLink =
    link.includes('/_ln/') ||
    link.includes('/ln/') ||
    link.includes('news_id=') ||
    link.includes('key=');

  if (!hasArticleLikeLink) {
    return false;
  }

  return true;
}

function extractYtnTitleFromFragment(fragment: string): string {
  const titleCandidates: string[] = [];

  const strongMatch = fragment.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i);
  const titleClassMatch = fragment.match(
    /<(?:span|p|div)[^>]+class=["'][^"']*(?:title|tit|subject|headline)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|p|div)>/i
  );
  const imgAltMatch = fragment.match(/<img[^>]+alt=["']([^"']+)["']/i);

  if (strongMatch?.[1]) {
    titleCandidates.push(strongMatch[1]);
  }

  if (titleClassMatch?.[1]) {
    titleCandidates.push(titleClassMatch[1]);
  }

  if (imgAltMatch?.[1]) {
    titleCandidates.push(imgAltMatch[1]);
  }

  titleCandidates.push(fragment);

  for (const candidate of titleCandidates) {
    const title = cleanTitle(candidate)
      .replace(/^YTN\s*/i, '')
      .replace(/^뉴스\s*/g, '')
      .trim();

    if (title.length >= 8 && !isYtnMenuOrProgramTitle(title)) {
      return title;
    }
  }

  return '';
}

function parseYtnArticles(html: string, source: string, limit: number): Article[] {
  const articles: Article[] = [];
  const seenLinks = new Set<string>();

  const linkRegex =
    /<a[^>]+href=["']([^"']*(?:\/_ln\/|\/ln\/|news_id=|key=)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null && articles.length < limit) {
    const href = match[1];
    const fragment = match[2];

    if (!href || href.includes('javascript:')) {
      continue;
    }

    const link = makeAbsoluteUrl('https://www.ytn.co.kr', href);

    if (seenLinks.has(link)) {
      continue;
    }

    const title = extractYtnTitleFromFragment(fragment);

    if (!isValidYtnArticle(title, link)) {
      continue;
    }

    const pubDate = extractYtnPubDate(fragment, link);

    if (!isRecentEnough(pubDate, YTN_MAX_AGE_HOURS)) {
      continue;
    }

    seenLinks.add(link);

    const article: Article = {
      title,
      link,
      pubDate,
      description: 'YTN 최신뉴스 목록에서 수집한 기사입니다.',
      source,
      category: '국내',
      imageUrl: extractYtnImageFromFragment(fragment)
    };

    articles.push(article);
  }

  return articles;
}

async function fetchYtnRecentNews(): Promise<Article[]> {
  try {
    const html = await fetchText(YTN_RECENT_URL);
    return parseYtnArticles(html, 'YTN 최신뉴스', YTN_RECENT_LIMIT);
  } catch (error) {
    console.error('YTN 최신뉴스 수집 실패:', error);
    return [];
  }
}

function sortByLatestFirst(articles: Article[]): Article[] {
  return articles.sort((a, b) => {
    const dateA = new Date(a.pubDate).getTime();
    const dateB = new Date(b.pubDate).getTime();

    return dateB - dateA;
  });
}

function createSourceStats(articles: Article[]): Record<string, number> {
  return articles.reduce<Record<string, number>>((acc, article) => {
    acc[article.source] = (acc[article.source] || 0) + 1;
    return acc;
  }, {});
}

function createCategoryStats(articles: Article[]): Record<NewsCategory, number> {
  return articles.reduce<Record<NewsCategory, number>>(
    (acc, article) => {
      acc[article.category] += 1;
      return acc;
    },
    {
      국내: 0,
      국제: 0
    }
  );
}

export async function GET() {
  try {
    const results = await Promise.allSettled([
      ...RSS_FEEDS.map((feed) => fetchRSSFeed(feed)),
      fetchYtnRecentNews()
    ]);

    const allArticles = results.flatMap((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      return [];
    });

    const errors = results
      .filter((result) => result.status === 'rejected')
      .map((result) => {
        if (result.status === 'rejected') {
          return String(result.reason);
        }

        return '';
      })
      .filter(Boolean);

    const uniqueArticles = removeDuplicateArticles(allArticles);
    const articles = sortByLatestFirst(uniqueArticles);
    const sourceStats = createSourceStats(articles);
    const categoryStats = createCategoryStats(articles);

    return NextResponse.json({
      articles,
      lastUpdated: new Date().toISOString(),
      totalCount: articles.length,
      sourceStats,
      categoryStats,
      sources: Object.keys(sourceStats),
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('속보 API 에러:', error);

    return NextResponse.json(
      {
        error: '속보를 불러오는데 실패했습니다.',
        articles: [],
        lastUpdated: new Date().toISOString(),
        totalCount: 0
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;