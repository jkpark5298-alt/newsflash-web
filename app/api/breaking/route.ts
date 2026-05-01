import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

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
  imageUrl?: string;
}

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

const RSS_FEEDS = [
  {
    url: 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01&plink=RSSREADER',
    source: 'SBS'
  },
  {
    url: 'https://news.sbs.co.kr/news/headlineRssFeed.do?plink=RSSREADER',
    source: 'SBS 주요뉴스'
  },
  {
    url: 'https://imnews.imbc.com/rss/google_news/narrativeNews.rss',
    source: 'MBC'
  },
  {
    url: 'https://www.yonhapnewstv.co.kr/category/news/headline/feed/',
    source: '연합뉴스TV'
  },
  {
    url: 'http://fs.jtbc.co.kr//RSS/newsflash.xml',
    source: 'JTBC'
  }
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

  let cleaned = description.replace(/<[^>]*>/g, ' ');

  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  if (!cleaned) {
    return '내용 없음';
  }

  if (cleaned.length > 180) {
    return `${cleaned.substring(0, 180)}...`;
  }

  return cleaned;
}

function getItemDescription(item: RSSItem): string {
  return item.contentSnippet || item.description || item.content || item.contentEncoded || '';
}

function getItemPubDate(item: RSSItem): string {
  return item.pubDate || item.isoDate || new Date().toISOString();
}

function normalizeTitle(title: string): string {
  return title
    .replace(/\s+/g, ' ')
    .replace(/[“”"']/g, '')
    .trim()
    .toLowerCase();
}

function removeDuplicateArticles(articles: Article[]): Article[] {
  const seenTitles = new Set<string>();

  return articles.filter((article) => {
    const normalizedTitle = normalizeTitle(article.title);

    if (!normalizedTitle) {
      return false;
    }

    if (seenTitles.has(normalizedTitle)) {
      return false;
    }

    seenTitles.add(normalizedTitle);
    return true;
  });
}

async function fetchRSSFeed(url: string, source: string): Promise<Article[]> {
  try {
    const feed = await parser.parseURL(url);

    return feed.items.slice(0, 30).map((item) => {
      const imageUrl = extractImageUrl(item);

      return {
        title: item.title || '제목 없음',
        link: item.link || '#',
        pubDate: getItemPubDate(item),
        description: cleanDescription(getItemDescription(item)),
        source,
        imageUrl
      };
    });
  } catch (error) {
    console.error(`RSS 피드 가져오기 실패 (${source}):`, error);
    return [];
  }
}

export async function GET() {
  try {
    const results = await Promise.allSettled(
      RSS_FEEDS.map((feed) => fetchRSSFeed(feed.url, feed.source))
    );

    const allArticles = results.flatMap((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      return [];
    });

    const uniqueArticles = removeDuplicateArticles(allArticles);

    const articles = uniqueArticles.sort((a, b) => {
      const dateA = new Date(a.pubDate).getTime();
      const dateB = new Date(b.pubDate).getTime();

      return dateB - dateA;
    });

    return NextResponse.json({
      articles,
      lastUpdated: new Date().toISOString(),
      totalCount: articles.length,
      sources: RSS_FEEDS.map((feed) => feed.source)
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