import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media'],
      ['media:thumbnail', 'thumbnail'],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'contentEncoded']
    ]
  }
});

interface Article {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  imageUrl?: string;
}

const RSS_FEEDS = [
  // 외국 언론
  {
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    source: 'BBC News'
  },
  {
    url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    source: 'New York Times'
  },
  {
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    source: 'Al Jazeera'
  },
  {
    url: 'https://www.theguardian.com/world/rss',
    source: 'The Guardian'
  },
  
  // 국내 언론 국제면 (보수)
  {
    url: 'https://rss.donga.com/international.xml',
    source: '동아일보'
  },
  {
    url: 'https://www.chosun.com/arc/outboundfeeds/rss/category/international/?outputType=xml',
    source: '조선일보'
  },
  
  // 국내 언론 국제면 (진보)
  {
    url: 'https://www.hani.co.kr/rss/international/',
    source: '한겨레'
  },
  {
    url: 'https://www.khan.co.kr/rss/rssdata/kh_international.xml',
    source: '경향신문'
  },
  
  // 방송사
  {
    url: 'https://www.yonhapnewstv.co.kr/category/news/international/feed/',
    source: '연합뉴스TV'
  },
  {
    url: 'https://imnews.imbc.com/rss/news/international/rss.xml',
    source: 'MBC'
  }
];

function extractImageUrl(item: any): string | undefined {
  try {
    // 1. enclosure에서 이미지 추출
    if (item.enclosure?.url) {
      const url = item.enclosure.url;
      if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        return url;
      }
    }

    // 2. media:content에서 이미지 추출
    if (item.media) {
      if (typeof item.media === 'object' && item.media.$?.url) {
        return item.media.$.url;
      }
      if (Array.isArray(item.media)) {
        for (const mediaItem of item.media) {
          if (mediaItem.$?.url) {
            return mediaItem.$.url;
          }
        }
      }
    }

    // 3. media:thumbnail에서 이미지 추출
    if (item.thumbnail) {
      if (typeof item.thumbnail === 'object' && item.thumbnail.$?.url) {
        return item.thumbnail.$.url;
      }
      if (typeof item.thumbnail === 'string') {
        return item.thumbnail;
      }
    }

    // 4. content:encoded에서 이미지 추출
    if (item.contentEncoded) {
      const imgMatch = item.contentEncoded.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch && imgMatch[1]) {
        return imgMatch[1];
      }
    }

    // 5. description에서 이미지 추출
    if (item.description) {
      const imgMatch = item.description.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch && imgMatch[1]) {
        return imgMatch[1];
      }
    }

    // 6. content에서 이미지 추출
    if (item.content) {
      const imgMatch = item.content.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch && imgMatch[1]) {
        return imgMatch[1];
      }
    }

  } catch (error) {
    console.error('이미지 추출 에러:', error);
  }

  return undefined;
}

function cleanDescription(description: string): string {
  if (!description) return '';
  
  // HTML 태그 제거
  let cleaned = description.replace(/<[^>]*>/g, ' ');
  
  // HTML 엔티티 디코딩
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // 연속된 공백 제거
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // 200자로 제한
  if (cleaned.length > 200) {
    cleaned = cleaned.substring(0, 200) + '...';
  }
  
  return cleaned;
}

export async function GET() {
  try {
    console.log('🌍 국제 뉴스 API 호출 시작');
    
    const allArticles: Article[] = [];
    const errors: string[] = [];
    const sourceStats: { [key: string]: number } = {};

    // 모든 RSS 피드에서 뉴스 가져오기
    const results = await Promise.allSettled(
      RSS_FEEDS.map(async ({ url, source }) => {
        try {
          console.log(`📡 ${source} 로딩 중...`);
          
          const feed = await parser.parseURL(url);
          
          console.log(`✅ ${source} 파싱 성공: ${feed.items.length}개 항목`);
          
          const articles = feed.items.slice(0, 30).map(item => {
            const imageUrl = extractImageUrl(item);
            
            return {
              title: item.title || '제목 없음',
              link: item.link || '',
              pubDate: item.pubDate || new Date().toISOString(),
              description: cleanDescription(item.contentSnippet || item.description || ''),
              source: source,
              imageUrl: imageUrl
            };
          });

          sourceStats[source] = articles.length;
          return articles;
          
        } catch (error) {
          const errorMsg = `${source} 파싱 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
          sourceStats[source] = 0;
          return [];
        }
      })
    );

    // 성공한 결과만 수집
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        allArticles.push(...result.value);
      } else if (result.status === 'rejected') {
        errors.push(`${RSS_FEEDS[index].source}: ${result.reason}`);
      }
    });

    console.log(`📊 총 ${allArticles.length}개 기사 수집 완료`);
    console.log('출처별:', sourceStats);
    
    if (errors.length > 0) {
      console.warn('⚠️ 일부 피드 파싱 실패:', errors);
    }

    // 날짜순 정렬 (최신순)
    allArticles.sort((a, b) => {
      const dateA = new Date(a.pubDate).getTime();
      const dateB = new Date(b.pubDate).getTime();
      return dateB - dateA;
    });

    // 이미지가 있는 기사 우선 정렬
    const articlesWithImages = allArticles.filter(a => a.imageUrl);
    const articlesWithoutImages = allArticles.filter(a => !a.imageUrl);
    const sortedArticles = [...articlesWithImages, ...articlesWithoutImages];

    console.log(`✅ 국제 뉴스 API 응답 성공: ${sortedArticles.length}개 기사`);

    return NextResponse.json({
      articles: sortedArticles,
      lastUpdated: new Date().toISOString(),
      totalCount: sortedArticles.length,
      sourceStats: sourceStats,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ 국제 뉴스 API 치명적 에러:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : '국제 뉴스를 불러오는데 실패했습니다.',
        articles: [],
        lastUpdated: new Date().toISOString(),
        totalCount: 0
      },
      { status: 200 }
    );
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
