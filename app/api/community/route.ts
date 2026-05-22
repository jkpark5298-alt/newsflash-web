import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

type CommunitySource = '클리앙' | '뽐뿌' | '무료앱';

interface CommunityIssue {
  id: string;
  title: string;
  link: string;
  source: CommunitySource;
  pubDate: string;
  summary: string;
  detail: string;
  category: string;
}

type CustomRSSItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  content?: string;
  contentSnippet?: string;
  description?: string;
};

const parser: Parser<object, CustomRSSItem> = new Parser<object, CustomRSSItem>({
  customFields: {
    item: [
      ['description', 'description'],
      ['content:encoded', 'content'],
    ],
  },
});

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

function cleanText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function limitText(value: string, maxLength: number): string {
  const cleaned = cleanText(value);

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.substring(0, maxLength)}...`;
}

function makeId(source: CommunitySource, link: string, title: string): string {
  return `${source}-${link || title}`.replace(/\s+/g, '-');
}

function makeAbsoluteUrl(baseUrl: string, href: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }

  return new URL(href, baseUrl).toString();
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      headers: FETCH_HEADERS,
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

async function fetchPpomppuRSS(): Promise<CommunityIssue[]> {
  try {
    const feed = await parser.parseURL('https://www.ppomppu.co.kr/rss.php?id=freeboard');

    return feed.items.slice(0, 10).map((item) => {
      const title = cleanText(item.title || '제목 없음');
      const link = item.link || 'https://www.ppomppu.co.kr/';
      const rawDescription = item.contentSnippet || item.description || item.content || '';

      return {
        id: makeId('뽐뿌', link, title),
        title,
        link,
        source: '뽐뿌',
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        summary: limitText(rawDescription || '뽐뿌 자유게시판에서 올라온 커뮤니티 이슈입니다.', 110),
        detail: limitText(rawDescription || '원문에서 자세한 내용을 확인할 수 있습니다.', 260),
        category: '자유게시판',
      };
    });
  } catch (error) {
    console.error('뽐뿌 RSS 수집 실패:', error);
    return [];
  }
}

async function fetchPpomppuHot(): Promise<CommunityIssue[]> {
  try {
    const html = await fetchText('https://www.ppomppu.co.kr/hot.php?category=1');
    const issues: CommunityIssue[] = [];
    const seenLinks = new Set<string>();

    const linkRegex = /<a[^>]+href=["']([^"']*zboard\/view\.php\?[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null && issues.length < 10) {
      const href = match[1];
      const rawTitle = match[2];
      const title = cleanText(rawTitle);

      if (!title || title.length < 5) {
        continue;
      }

      const link = makeAbsoluteUrl('https://www.ppomppu.co.kr/', href);

      if (seenLinks.has(link)) {
        continue;
      }

      seenLinks.add(link);

      issues.push({
        id: makeId('뽐뿌', link, title),
        title,
        link,
        source: '뽐뿌',
        pubDate: new Date().toISOString(),
        summary: '뽐뿌 HOT 게시글에서 확인된 커뮤니티 이슈입니다.',
        detail:
          '뽐뿌 HOT 게시글 목록에서 수집된 항목입니다. 커뮤니티 글은 검증된 뉴스가 아니므로 원문에서 맥락을 확인하세요.',
        category: 'HOT',
      });
    }

    return issues;
  } catch (error) {
    console.error('뽐뿌 HOT 수집 실패:', error);
    return [];
  }
}

async function fetchClienBoard(
  url: string,
  category: string,
  limit: number,
): Promise<CommunityIssue[]> {
  try {
    const html = await fetchText(url);
    const issues: CommunityIssue[] = [];
    const seenLinks = new Set<string>();

    const linkRegex =
      /<a[^>]+href=["']([^"']*\/service\/board\/(?:park|news|jirum)\/\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;

    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null && issues.length < limit) {
      const href = match[1];
      const rawTitle = match[2];
      const title = cleanText(rawTitle)
        .replace(/^새글\s*/g, '')
        .replace(/^댓글\s*/g, '')
        .trim();

      if (!title || title.length < 5) {
        continue;
      }

      const link = makeAbsoluteUrl('https://www.clien.net', href);

      if (seenLinks.has(link)) {
        continue;
      }

      seenLinks.add(link);

      issues.push({
        id: makeId('클리앙', link, title),
        title,
        link,
        source: '클리앙',
        pubDate: new Date().toISOString(),
        summary: `클리앙 ${category}에서 확인된 커뮤니티 이슈입니다.`,
        detail:
          '클리앙 공개 게시판 목록에서 수집된 항목입니다. 커뮤니티 글은 검증된 뉴스가 아니므로 원문에서 맥락을 확인하세요.',
        category,
      });
    }

    return issues;
  } catch (error) {
    console.error(`클리앙 ${category} 수집 실패:`, error);
    return [];
  }
}

async function fetchIphoneFreeApps(): Promise<CommunityIssue[]> {
  try {
    const html = await fetchText('https://freshapps.com/');
    const issues: CommunityIssue[] = [];
    const seenTitles = new Set<string>();

    const headingRegex = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|<\/body|$)/gi;
    const sections: Array<{ title: string; link: string; meta: string; isFree: boolean }> = [];
    let match: RegExpExecArray | null;

    while ((match = headingRegex.exec(html)) !== null) {
      const rawTitleBlock = match[1];
      const rawMetaBlock = match[2] || '';
      const title = cleanText(rawTitleBlock);

      if (!title || title.length < 2 || seenTitles.has(title)) {
        continue;
      }

      const combinedBlock = `${rawTitleBlock} ${rawMetaBlock}`;
      const hrefMatch = combinedBlock.match(/href=["']([^"']+)["']/i);
      const link = hrefMatch
        ? makeAbsoluteUrl('https://freshapps.com/', hrefMatch[1])
        : 'https://freshapps.com/';
      const meta = limitText(rawMetaBlock, 140);
      const isFree = /(?:→|&rarr;|-&gt;)\s*(?:free|\$0(?:\.00)?)/i.test(meta) || /gone\s+free/i.test(meta);

      seenTitles.add(title);
      sections.push({ title, link, meta, isFree });
    }

    const selectedSections = [
      ...sections.filter((section) => section.isFree),
      ...sections.filter((section) => !section.isFree),
    ].slice(0, 5);

    selectedSections.forEach((section) => {
      const summary = section.isFree
        ? `오늘만무료 또는 무료 전환 앱으로 확인되었습니다. ${section.meta}`
        : `무료앱 공개 소스에서 확인한 iPhone 앱 할인 정보입니다. ${section.meta}`;

      issues.push({
        id: makeId('무료앱', section.link, section.title),
        title: section.title,
        link: section.link,
        source: '무료앱',
        pubDate: new Date().toISOString(),
        summary: limitText(summary, 120),
        detail: limitText(summary, 260),
        category: '오늘만무료 App',
      });
    });

    return issues;
  } catch (error) {
    console.error('아이폰 오늘만무료 App 수집 실패:', error);
    return [];
  }
}

function removeDuplicateIssues(issues: CommunityIssue[]): CommunityIssue[] {
  const seen = new Set<string>();

  return issues.filter((issue) => {
    const key = `${issue.source}-${issue.title}`.replace(/\s+/g, '').toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export async function GET() {
  try {
    const results = await Promise.allSettled([
      fetchClienBoard('https://www.clien.net/service/board/park', '모두의공원', 8),
      fetchClienBoard('https://www.clien.net/service/board/jirum', '알뜰구매', 8),
      fetchClienBoard('https://www.clien.net/service/board/news', '새로운소식', 8),
      fetchIphoneFreeApps(),
      fetchPpomppuRSS(),
      fetchPpomppuHot(),
    ]);

    const issues = results.flatMap((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      return [];
    });

    const uniqueIssues = removeDuplicateIssues(issues).slice(0, 45);

    const sourceStats = uniqueIssues.reduce<Record<string, number>>((acc, issue) => {
      acc[issue.source] = (acc[issue.source] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      issues: uniqueIssues,
      totalCount: uniqueIssues.length,
      sourceStats,
      lastUpdated: new Date().toISOString(),
      notice: '커뮤니티 이슈는 검증된 뉴스가 아닌 이용자 반응 기반 정보입니다.',
    });
  } catch (error) {
    console.error('커뮤니티 API 에러:', error);

    return NextResponse.json(
      {
        issues: [],
        totalCount: 0,
        lastUpdated: new Date().toISOString(),
        error: '커뮤니티 이슈를 불러오는데 실패했습니다.',
      },
      { status: 200 },
    );
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
