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
  },
  timeout: 10000
});

function extractImageUrl(item: any): string | null {
  if (item.media) {
    if (Array.isArray(item.media)) {
      const imageMedia = item.media.find((m: any) => m.$?.url);
      if (imageMedia?.$?.url) return imageMedia.$.url;
    } else if (item.media.$?.url) {
      return item.media.$.url;
    }
  }

  if (item.mediaThumbnail?.$?.url) {
    return item.mediaThumbnail.$.url;
  }

  if (item.enclosure?.url) {
    return item.enclosure.url;
  }

  if (item.contentEncoded) {
    const imgMatch = item.contentEncoded.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }
  }

  if (item.description) {
    const imgMatch = item.description.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }
  }

  if (item.content) {
    const imgMatch = item.content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }
  }

  return null;
}

// 한겨레 만평
async function fetchHankyorehCartoons(): Promise<Cartoon[]> {
  try {
    console.log('한겨레 RSS 요청 시작...');
    const feed = await parser.parseURL('https://www.hani.co.kr/rss/');
    console.log(`한겨레 RSS: ${feed.items.length}개 항목 수신`);
    
    const cartoons: Cartoon[] = [];
    
    for (const item of feed.items) {
      if (item.title?.includes('만평') || item.link?.includes('/cartoon/')) {
        const imageUrl = extractImageUrl(item);
        console.log(`한겨레 항목: ${item.title}, 이미지: ${imageUrl}`);
        
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
      if (cartoons.length >= 10) break;
    }

    console.log(`한겨레 RSS: ${cartoons.length}개 수집 완료`);
    return cartoons;
  } catch (error) {
    console.error('한겨레 RSS 실패:', error);
    return [];
  }
}

// 경향신문 만평
async function fetchKyunghyangCartoons(): Promise<Cartoon[]> {
  try {
    console.log('경향신문 RSS 요청 시작...');
    const feed = await parser.parseURL('https://www.khan.co.kr/rss/rssdata/kh_cartoon.xml');
    console.log(`경향신문 RSS: ${feed.items.length}개 항목 수신`);
    
    const cartoons: Cartoon[] = [];
    
    for (const item of feed.items.slice(0, 10)) {
      const imageUrl = extractImageUrl(item);
      console.log(`경향신문 항목: ${item.title}, 이미지: ${imageUrl}`);
      
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

    console.log(`경향신문 RSS: ${cartoons.length}개 수집 완료`);
    return cartoons;
  } catch (error) {
    console.error('경향신문 RSS 실패:', error);
    return [];
  }
}

export async function GET() {
  try {
    console.log('=== 만평 RSS 수집 시작 ===');
    
    const [hani, kyunghyang] = await Promise.all([
      fetchHankyorehCartoons(),
      fetchKyunghyangCartoons()
    ]);

    const allCartoons = [...hani, ...kyunghyang];

    console.log(`=== 총 ${allCartoons.length}개 만평 수집 완료 ===`);

    if (allCartoons.length === 0) {
      console.warn('⚠️ 실제 만평을 가져올 수 없어 샘플 데이터 반환');
      return NextResponse.json({
        cartoons: [
          {
            title: '샘플 만평 1',
            imageUrl: 'https://via.placeholder.com/400x300/FF6B6B/FFFFFF?text=Sample+Cartoon+1',
            link: '#',
            source: '샘플',
            date: new Date().toISOString().split('T')[0]
          },
          {
            title: '샘플 만평 2',
            imageUrl: 'https://via.placeholder.com/400x300/4ECDC4/FFFFFF?text=Sample+Cartoon+2',
            link: '#',
            source: '샘플',
            date: new Date().toISOString().split('T')[0]
          },
          {
            title: '샘플 만평 3',
            imageUrl: 'https://via.placeholder.com/400x300/45B7D1/FFFFFF?text=Sample+Cartoon+3',
            link: '#',
            source: '샘플',
            date: new Date().toISOString().split('T')[0]
          }
        ],
        count: 3,
        sources: {
          hani: 0,
          kyunghyang: 0
        },
        message: '실제 만평 데이터를 가져올 수 없어 샘플 데이터를 표시합니다.'
      });
    }

    return NextResponse.json({
      cartoons: allCartoons,
      count: allCartoons.length,
      sources: {
        hani: hani.length,
        kyunghyang: kyunghyang.length
      }
    });

  } catch (error) {
    console.error('❌ 만평 API 에러:', error);
    return NextResponse.json(
      { 
        error: '만평을 가져오는데 실패했습니다.',
        cartoons: [],
        count: 0,
        sources: {
          hani: 0,
          kyunghyang: 0
        }
      },
      { status: 500 }
    );
  }
}
