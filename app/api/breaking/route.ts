import { NextRequest, NextResponse } from 'next/server';
import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
    ],
  },
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
});

// RSS 피드 URL
const RSS_FEEDS = {
  yonhap: 'https://www.yonhapnewstv.co.kr/category/news/headline/feed/',
  sbs: 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01',
  jtbc: 'https://fs.jtbc.co.kr/RSS/newsflash.xml',
};

// 이미지 URL 추출
function extractImageUrl(item: any): string | null {
  if (item['media:content']?.$ && item['media:content'].$.url) {
    return item['media:content'].$.url;
  }

  if (item['media:thumbnail']?.$ && item['media:thumbnail'].$.url) {
    return item['media:thumbnail'].$.url;
  }

  if (item.enclosure?.url) {
    return item.enclosure.url;
  }

  if (item['content:encoded']) {
    const imgMatch = item['content:encoded'].match(/<img[^>]+src=["']?([^"'\s>]+)["']?/i);
    if (imgMatch) return imgMatch[1];
  }

  if (item.description) {
    const imgMatch = item.description.match(/<img[^>]+src=["']?([^"'\s>]+)["']?/i);
    if (imgMatch) return imgMatch[1];
  }

  return null;
}

// 날짜 포맷팅
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  } catch {
    return dateString;
  }
}

export async function GET(request: NextRequest) {
  try {
    const allNews: any[] = [];

    // 연합뉴스
    try {
      console.log('📰 연합뉴스 RSS 로딩 중...');
      const feed = await parser.parseURL(RSS_FEEDS.yonhap);
      console.log(`✅ 연합뉴스: ${feed.items.length}개`);
      
      feed.items.forEach((item: any) => {
        allNews.push({
          id: `yonhap-${item.guid || item.link}`,
          title: item.title || '제목 없음',
          description: item.contentSnippet || item.description || '',
          link: item.link || '#',
          source: '연합뉴스',
          pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
          imageUrl: extractImageUrl(item),
        });
      });
    } catch (error) {
      console.error('❌ 연합뉴스 실패:', error);
    }

    // SBS
    try {
      console.log('📰 SBS RSS 로딩 중...');
      const feed = await parser.parseURL(RSS_FEEDS.sbs);
      console.log(`✅ SBS: ${feed.items.length}개`);
      
      feed.items.forEach((item: any) => {
        allNews.push({
          id: `sbs-${item.guid || item.link}`,
          title: item.title || '제목 없음',
          description: item.contentSnippet || item.description || '',
          link: item.link || '#',
          source: 'SBS',
          pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
          imageUrl: extractImageUrl(item),
        });
      });
    } catch (error) {
      console.error('❌ SBS 실패:', error);
    }

    // JTBC
    try {
      console.log('📰 JTBC RSS 로딩 중...');
      const feed = await parser.parseURL(RSS_FEEDS.jtbc);
      console.log(`✅ JTBC: ${feed.items.length}개`);
      
      feed.items.forEach((item: any) => {
        allNews.push({
          id: `jtbc-${item.guid || item.link}`,
          title: item.title || '제목 없음',
          description: item.contentSnippet || item.description || '',
          link: item.link || '#',
          source: 'JTBC',
          pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
          imageUrl: extractImageUrl(item),
        });
      });
    } catch (error) {
      console.error('❌ JTBC 실패:', error);
    }

    // 날짜순 정렬
    allNews.sort((a, b) => {
      const dateA = new Date(a.pubDate).getTime();
      const dateB = new Date(b.pubDate).getTime();
      return dateB - dateA;
    });

    // 상대 시간 추가
    const newsWithTime = allNews.map(news => ({
      ...news,
      timeAgo: formatDate(news.pubDate),
    }));

    const sourceCount = newsWithTime.reduce((acc: any, n) => {
      acc[n.source] = (acc[n.source] || 0) + 1;
      return acc;
    }, {});

    console.log(`\n🎉 총 ${newsWithTime.length}개 속보 로딩 완료`);
    console.log('📊 출처별:', sourceCount);

    return NextResponse.json({
      success: true,
      count: newsWithTime.length,
      data: newsWithTime,
    });
  } catch (error) {
    console.error('❌ 속보 로딩 에러:', error);
    return NextResponse.json(
      {
        success: false,
        error: '속보를 가져오는데 실패했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
