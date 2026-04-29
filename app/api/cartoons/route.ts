import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

interface Cartoon {
  title: string;
  imageUrl: string;
  link: string;
  source: string;
  date?: string;
}

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure', 'enclosure'],
      ['description', 'description'],
      ['content:encoded', 'contentEncoded']
    ]
  }
});

function extractImageUrl(item: any): string | null {
  // media:content 확인
  if (item.media) {
    if (Array.isArray(item.media)) {
      const imageMedia = item.media.find((m: any) => m.$?.url);
      if (imageMedia?.$?.url) return imageMedia.$.url;
    } else if (item.media.$?.url) {
      return item.media.$.url;
    }
  }

  // media:thumbnail 확인
  if (item.mediaThumbnail?.$?.url) {
    return item.mediaThumbnail.$.url;
  }

  // enclosure 확인
  if (item.enclosure?.url) {
    return item.enclosure.url;
  }

  // content:encoded에서 이미지 추출
  if (item.contentEncoded) {
    const imgMatch = item.contentEncoded.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }
  }

  // description에서 이미지 추출
  if (item.description) {
    const imgMatch = item.description.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }
  }

  return null;
}

// 한겨레 만평
async function fetchHankyorehCartoons(): Promise<Cartoon[]> {
  try {
    const feed = await parser.parseURL('https://www.hani.co.kr/rss/');
    const cartoons: Cartoon[] = [];
    
    for (const item of feed.items) {
      if (item.title?.includes('만평') || item.link?.includes('/cartoon/')) {
        const imageUrl = extractImageUrl(item);
        
        if (imageUrl) {
          cartoons.push({
            title: item.title || '한겨레 만평',
            imageUrl,
            link: item.link || '',
            source: '한겨레',
            date: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : undefined
          });
        }
      }
      if (cartoons.length >= 5) break;
    }

    return cartoons;
  } catch (error) {
    console.error('한겨레 RSS 실패:', error);
    return [];
  }
}

// 경향신문 만평
async function fetchKyunghyangCartoons(): Promise<Cartoon[]> {
  try {
    const feed = await parser.parseURL('http://www.khan.co.kr/rss/rssdata/total_news.xml');
    const cartoons: Cartoon[] = [];
    
    for (const item of feed.items) {
      if (item.title?.includes('만평') || item.link?.includes('cartoon')) {
        const imageUrl = extractImageUrl(item);
        
        if (imageUrl) {
          cartoons.push({
            title: item.title || '경향신문 만평',
            imageUrl,
            link: item.link || '',
            source: '경향신문',
            date: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : undefined
          });
        }
      }
      if (cartoons.length >= 5) break;
    }

    return cartoons;
  } catch (error) {
    console.error('경향신문 RSS 실패:', error);
    return [];
  }
}

export async function GET() {
  try {
    const [hani, kyunghyang] = await Promise.all([
      fetchHankyorehCartoons(),
      fetchKyunghyangCartoons()
    ]);

    const allCartoons = [...hani, ...kyunghyang];

    return NextResponse.json({
      cartoons: allCartoons,
      count: allCartoons.length,
      sources: {
        hani: hani.length,
        kyunghyang: kyunghyang.length
      }
    });

  } catch (error) {
    console.error('만평 API 에러:', error);
    return NextResponse.json(
      { 
        error: '만평을 가져오는데 실패했습니다.',
        cartoons: [],
        count: 0
      },
      { status: 500 }
    );
  }
}
