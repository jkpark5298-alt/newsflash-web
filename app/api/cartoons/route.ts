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
      ['enclosure', 'enclosure'],
      ['description', 'description']
    ]
  }
});

// 이미지 URL 추출 함수
function extractImageUrl(item: any): string | null {
  // 1. media:content
  if (item.media?.$ && item.media.$.url) {
    return item.media.$.url;
  }
  
  // 2. enclosure
  if (item.enclosure?.url) {
    return item.enclosure.url;
  }
  
  // 3. description에서 img 태그 추출
  if (item.description || item.content) {
    const content = item.description || item.content;
    const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }
  }
  
  return null;
}

// 경향신문 RSS
async function fetchKyunghyangCartoons(): Promise<Cartoon[]> {
  try {
    const feed = await parser.parseURL('https://www.khan.co.kr/rss/rssPrintOpinion.xml');
    
    const cartoons = feed.items
      .filter(item => item.title?.includes('만평') || item.categories?.some(cat => cat.includes('만평')))
      .slice(0, 5)
      .map(item => {
        const imageUrl = extractImageUrl(item);
        return imageUrl ? {
          title: item.title || '경향신문 만평',
          imageUrl,
          link: item.link || '',
          source: '경향신문',
          date: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : undefined
        } : null;
      })
      .filter((item): item is Cartoon => item !== null);

    console.log(`경향신문 RSS: ${cartoons.length}개 수집`);
    return cartoons;
  } catch (error) {
    console.error('경향신문 RSS 실패:', error);
    return [];
  }
}

// 한겨레 RSS
async function fetchHankyorehCartoons(): Promise<Cartoon[]> {
  try {
    const feed = await parser.parseURL('https://www.hani.co.kr/rss/cartoon/');
    
    const cartoons = feed.items
      .slice(0, 5)
      .map(item => {
        const imageUrl = extractImageUrl(item);
        return imageUrl ? {
          title: item.title || '한겨레 만평',
          imageUrl,
          link: item.link || '',
          source: '한겨레',
          date: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : undefined
        } : null;
      })
      .filter((item): item is Cartoon => item !== null);

    console.log(`한겨레 RSS: ${cartoons.length}개 수집`);
    return cartoons;
  } catch (error) {
    console.error('한겨레 RSS 실패:', error);
    return [];
  }
}

// 조선일보 RSS
async function fetchChosunCartoons(): Promise<Cartoon[]> {
  try {
    const feed = await parser.parseURL('https://www.chosun.com/arc/outboundfeeds/rss/category/opinion/?outputType=xml');
    
    const cartoons = feed.items
      .filter(item => item.title?.includes('만평') || item.categories?.some(cat => cat.includes('만평')))
      .slice(0, 5)
      .map(item => {
        const imageUrl = extractImageUrl(item);
        return imageUrl ? {
          title: item.title || '조선일보 만평',
          imageUrl,
          link: item.link || '',
          source: '조선일보',
          date: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : undefined
        } : null;
      })
      .filter((item): item is Cartoon => item !== null);

    console.log(`조선일보 RSS: ${cartoons.length}개 수집`);
    return cartoons;
  } catch (error) {
    console.error('조선일보 RSS 실패:', error);
    return [];
  }
}

export async function GET() {
  try {
    console.log('만평 RSS 수집 시작...');
    
    const [kyunghyang, hankyoreh, chosun] = await Promise.all([
      fetchKyunghyangCartoons(),
      fetchHankyorehCartoons(),
      fetchChosunCartoons()
    ]);

    const allCartoons = [...kyunghyang, ...hankyoreh, ...chosun];

    console.log(`총 ${allCartoons.length}개 만평 수집 완료`);

    if (allCartoons.length === 0) {
      console.warn('실제 만평을 가져올 수 없어 샘플 데이터 반환');
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
          khan: 0,
          hani: 0,
          chosun: 0
        },
        message: '실제 만평 데이터를 가져올 수 없어 샘플 데이터를 표시합니다.'
      });
    }

    return NextResponse.json({
      cartoons: allCartoons,
      count: allCartoons.length,
      sources: {
        khan: kyunghyang.length,
        hani: hankyoreh.length,
        chosun: chosun.length
      }
    });

  } catch (error) {
    console.error('만평 API 에러:', error);
    return NextResponse.json(
      { 
        error: '만평을 가져오는데 실패했습니다.',
        cartoons: [],
        count: 0,
        sources: {
          khan: 0,
          hani: 0,
          chosun: 0
        }
      },
      { status: 500 }
    );
  }
}
