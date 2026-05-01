import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media'],
      ['media:thumbnail', 'thumbnail'],
      ['description', 'description'],
    ],
  },
});

interface RSSItem {
  title?: string;
  link?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  description?: string;
  media?: any;
  thumbnail?: any;
  enclosure?: {
    url?: string;
  };
}

interface Article {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  imageUrl?: string;
}

const RSS_FEEDS = [
  { url: 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01&plink=RSSREADER', source: 'SBS' },
  { url: 'https://www.yonhapnewstv.co.kr/category/news/headline/feed/', source: '연합뉴스' },
  { url: 'http://fs.jtbc.co.kr//RSS/newsflash.xml', source: 'JTBC' },
];

function extractImageUrl(item: RSSItem): string | undefined {
  // 1. media:content 확인
  if (item.media) {
    if (Array.isArray(item.media)) {
      const mediaItem = item.media[0];
      if (mediaItem && mediaItem.$) {
        return mediaItem.$.url;
      }
    } else if (item.media.$) {
      return item.media.$.url;
    }
  }

  // 2. media:thumbnail 확인
  if (item.thumbnail) {
    if (Array.isArray(item.thumbnail)) {
      const thumbItem = item.thumbnail[0];
      if (thumbItem && thumbItem.$) {
        return thumbItem.$.url;
      }
    } else if (item.thumbnail.$) {
      return item.thumbnail.$.url;
    }
  }

  // 3. enclosure 확인
  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }

  // 4. description에서 이미지 추출
  if (item.description) {
    const imgMatch = item.description.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }
  }

  // 5. content에서 이미지 추출
  if (item.content) {
    const imgMatch = item.content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }
  }

  return undefined;
}

async function fetchRSSFeed(url: string, source: string): Promise<Article[]> {
  try {
    const feed = await parser.parseURL(url);
    
    return feed.items.map((item: any) => {
      const imageUrl = extractImageUrl(item);
      
      return {
        title: item.title || '제목 없음',
        link: item.link || '#',
        pubDate: item.pubDate || new Date().toISOString(),
        description: item.contentSnippet || item.content || '내용 없음',
        source,
        imageUrl: imageUrl,
      };
    });
  } catch (error) {
    console.error(`RSS 피드 가져오기 실패 (${source}):`, error);
    return [];
  }
}

export async function GET() {
  try {
    const promises = RSS_FEEDS.map(feed => fetchRSSFeed(feed.url, feed.source));
    const results = await Promise.all(promises);
    
    const articles = results
      .flat()
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    console.log('첫 번째 기사 이미지:', articles[0]?.imageUrl); // 디버깅용

    return NextResponse.json({
      articles,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('속보 API 에러:', error);
    return NextResponse.json(
      { error: '속보를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
