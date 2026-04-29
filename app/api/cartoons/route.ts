
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

async function fetchYonhapCartoons(): Promise<Cartoon[]> {
  try {
    console.log('연합뉴스 RSS 요청 시작...');
    const feed = await parser.parseURL('https://www.yna.co.kr/rss/cartoon.xml');
    console.log(`연합뉴스 RSS: ${feed.items.length}개 항목 수신`);
    
    const cartoons: Cartoon[] = [];
    
    for (const item of feed.items.slice(0, 5)) {
      const imageUrl = extractImageUrl(item);
      console.log(`연합뉴스 항목: ${item.title}, 이미지: ${imageUrl}`);
      
      if (imageUrl) {
        cartoons.push({
          title: item.title || '연합뉴스 만평',
          imageUrl,
          link: item.link || '',
          source: '연합뉴스',
          date: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : undefined
        });
      }
    }

    console.log(`연합뉴스 RSS: ${cartoons.length}개 수집 완료`);
    return cartoons;
  } catch (error) {
    console.error('연합뉴스 RSS 실패:', error);
    return [];
  }
}

async function fetchMBCCartoons(): Promise<Cartoon[]> {
  try {
    console.log('MBC RSS 요청 시작...');
    const feed = await parser.parseURL('https://imnews.imbc.com/rss/news/news_00.xml');
    console.log(`MBC RSS: ${feed.items.length}개 항목 수신`);
    
    const cartoons: Cartoon[] = [];
    
    for (const item of feed.items) {
      if (item.title?.includes('만평') || item.title?.includes('그림')) {
        const imageUrl = extractImageUrl(item);
        console.log(`MBC 항목: ${item.title}, 이미지: ${imageUrl}`);
        
        if (imageUrl) {
          cartoons.push({
            title: item.title || 'MBC 만평',
            imageUrl,
            link: item.link || '',
            source: 'MBC',
            date: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : undefined
          });
        }
      }
      if (cartoons.length >= 5) break;
    }

    console.log(`MBC RSS: ${cartoons.length}개 수집 완료`);
    return cartoons;
  } catch (error) {
    console.error('MBC RSS 실패:', error);
    return [];
  }
}

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
      if (cartoons.length >= 5) break;
    }

    console.log(`한겨레 RSS: ${cartoons.length}개 수집 완료`);
    return cartoons;
  } catch (error) {
    console.error('한겨레 RSS 실패:', error);
    return [];
  }
}

async function fetchSBSCartoons(): Promise<Cartoon[]> {
  try {
    console.log('SBS RSS 요청 시작...');
    const feed = await parser.parseURL('https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01');
    console.log(`SBS RSS: ${feed.items.length}개 항목 수신`);
    
    const cartoons: Cartoon[] = [];
    
    for (const item of feed.items) {
      if (item.title?.includes('만평') || item.title?.includes('그림')) {
        const imageUrl = extractImageUrl(item);
        console.log(`SBS 항목: ${item.title}, 이미지: ${imageUrl}`);
        
        if (imageUrl) {
          cartoons.push({
            title: item.title || 'SBS 만평',
            imageUrl,
            link: item.link || '',
            source: 'SBS',
            date: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : undefined
          });
        }
      }
      if (cartoons.length >= 5) break;
    }

    console.log(`SBS RSS: ${cartoons.length}개 수집 완료`);
    return cartoons;
  } catch (error) {
    console.error('SBS RSS 실패:', error);
    return [];
  }
}

async function fetchKBSCartoons(): Promise<Cartoon[]> {
  try {
    console.log('KBS RSS 요청 시작...');
    const feed = await parser.parseURL('https://news.kbs.co.kr/rss/news.do?id=R01');
    console.log(`KBS RSS: ${feed.items.length}개 항목 수신`);
    
    const cartoons: Cartoon[] = [];
    
    for (const item of feed.items) {
      if (item.title?.includes('만평') || item.title?.includes('그림')) {
        const imageUrl = extractImageUrl(item);
        console.log(`KBS 항목: ${item.title}, 이미지: ${imageUrl}`);
        
        if (imageUrl) {
          cartoons.push({
            title: item.title || 'KBS 만평',
            imageUrl,
            link: item.link || '',
            source: 'KBS',
            date: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : undefined
          });
        }
      }
      if (cartoons.length >= 5) break;
    }

    console.log(`KBS RSS: ${cartoons.length}개 수집 완료`);
    return cartoons;
  } catch (error) {
    console.error('KBS RSS 실패:', error);
    return [];
  }
}

export async function GET() {
  try {
    console.log('=== 만평 RSS 수집 시작 ===');
    
    const [yonhap, mbc, hani, sbs, kbs] = await Promise.all([
      fetchYonhapCartoons(),
      fetchMBCCartoons(),
      fetchHankyorehCartoons(),
      fetchSBSCartoons(),
      fetchKBSCartoons()
    ]);

    const allCartoons = [...yonhap, ...mbc, ...hani, ...sbs, ...kbs];

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
          yonhap: 0,
          mbc: 0,
          hani: 0,
          sbs: 0,
          kbs: 0
        },
        message: '실제 만평 데이터를 가져올 수 없어 샘플 데이터를 표시합니다.'
      });
    }

    return NextResponse.json({
      cartoons: allCartoons,
      count: allCartoons.length,
      sources: {
        yonhap: yonhap.length,
        mbc: mbc.length,
        hani: hani.length,
        sbs: sbs.length,
        kbs: kbs.length
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
          yonhap: 0,
          mbc: 0,
          hani: 0,
          sbs: 0,
          kbs: 0
        }
      },
      { status: 500 }
    );
  }
}
