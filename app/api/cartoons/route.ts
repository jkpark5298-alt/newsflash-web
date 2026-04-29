import { NextRequest, NextResponse } from 'next/server';
import Parser from 'rss-parser';
import * as cheerio from 'cheerio';

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
      ['description', 'description'],
      ['content:encoded', 'content:encoded'],
      ['dc:date', 'dcDate'],
    ],
  },
});

const RSS_FEEDS = {
  hani: 'https://www.hani.co.kr/rss/cartoon/',
};

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
    if (imgMatch) {
      return imgMatch[1];
    }
  }

  if (item.description) {
    const imgMatch = item.description.match(/<img[^>]+src=["']?([^"'\s>]+)["']?/i);
    if (imgMatch) {
      return imgMatch[1];
    }
  }

  if (item.content) {
    const imgMatch = item.content.match(/<img[^>]+src=["']?([^"'\s>]+)["']?/i);
    if (imgMatch) {
      return imgMatch[1];
    }
  }

  return null;
}

// URL이나 이미지 경로에서 날짜 추출
function extractDateFromUrl(url: string): string | null {
  // 한겨레 이미지 URL 패턴: /2026/0428/20260428503683.webp
  const haniMatch = url.match(/\/(\d{4})\/(\d{2})(\d{2})\//);
  if (haniMatch) {
    const [, year, month, day] = haniMatch;
    return `${year}-${month}-${day}`;
  }

  // 경향신문 이미지 URL 패턴: /2026/04/28/
  const khanMatch = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (khanMatch) {
    const [, year, month, day] = khanMatch;
    return `${year}-${month}-${day}`;
  }

  return null;
}

// 경향신문 웹 크롤링
async function fetchKhanCartoons() {
  try {
    const response = await fetch('https://www.khan.co.kr/cartoon', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const cartoons = [];

    // 만평 목록 찾기
    $('.cartoon-list .item, .list-item, article, .art_list li').each((index, element) => {
      const $el = $(element);
      
      // 이미지 찾기
      const img = $el.find('img').first();
      const imageUrl = img.attr('src') || img.attr('data-src') || img.attr('data-original');
      
      // 제목 찾기
      const title = $el.find('.title, h3, h4, .subject, .art_tit').first().text().trim() 
                    || img.attr('alt') 
                    || '경향신문 만평';
      
      // 링크 찾기
      const link = $el.find('a').first().attr('href') || 'https://www.khan.co.kr/cartoon';
      
      if (imageUrl) {
        // 상대 경로를 절대 경로로 변환
        const fullImageUrl = imageUrl.startsWith('http') 
          ? imageUrl 
          : `https://www.khan.co.kr${imageUrl}`;
        
        const fullLink = link.startsWith('http')
          ? link
          : `https://www.khan.co.kr${link}`;

        // URL에서 날짜 추출
        const dateFromUrl = extractDateFromUrl(fullImageUrl) || extractDateFromUrl(fullLink);
        const pubDate = dateFromUrl || new Date().toISOString().split('T')[0];

        cartoons.push({
          id: `khan-${index}`,
          title,
          imageUrl: fullImageUrl,
          link: fullLink,
          source: '경향신문',
          pubDate,
        });
      }
    });

    console.log('경향신문 크롤링 결과:', cartoons.length, '개');
    if (cartoons.length > 0) {
      console.log('첫 번째 만평:', cartoons[0]);
    }

    return cartoons;
  } catch (error) {
    console.error('경향신문 크롤링 실패:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('=== RSS 피드 요청 시작 ===');
    console.log('한겨레:', RSS_FEEDS.hani);
    
    let haniRss;

    try {
      haniRss = await parser.parseURL(RSS_FEEDS.hani);
      console.log('✅ 한겨레 RSS 성공:', haniRss.items.length, '개');
    } catch (error) {
      console.error('❌ 한겨레 RSS 실패:', error);
    }

    const cartoons = [];

    // 한겨레 RSS 파싱
    if (haniRss) {
      haniRss.items.forEach((item: any, index: number) => {
        const imageUrl = extractImageUrl(item);
        
        // 날짜 추출 시도
        let pubDate = item.pubDate || item.isoDate || item.dcDate || item.date;
        
        // RSS에 날짜가 없으면 URL에서 추출
        if (!pubDate && imageUrl) {
          const dateFromUrl = extractDateFromUrl(imageUrl);
          if (dateFromUrl) {
            pubDate = dateFromUrl;
          }
        }
        
        // 그래도 없으면 링크에서 추출
        if (!pubDate && item.link) {
          const dateFromLink = extractDateFromUrl(item.link);
          if (dateFromLink) {
            pubDate = dateFromLink;
          }
        }
        
        // 최종적으로 현재 날짜 사용
        if (!pubDate) {
          pubDate = new Date().toISOString().split('T')[0];
        }
        
        if (index === 0) {
          console.log('=== 한겨레 첫 번째 아이템 ===');
          console.log('제목:', item.title);
          console.log('링크:', item.link);
          console.log('이미지 URL:', imageUrl);
          console.log('추출된 날짜:', pubDate);
        }
        
        if (imageUrl) {
          cartoons.push({
            id: `hani-${item.guid || item.link}`,
            title: item.title || '제목 없음',
            imageUrl,
            link: item.link || '#',
            source: '한겨레',
            pubDate,
          });
        }
      });
    }

    // 경향신문 크롤링
    console.log('경향신문 크롤링 시작...');
    const khanCartoons = await fetchKhanCartoons();
    cartoons.push(...khanCartoons);

    // 날짜순 정렬
    cartoons.sort((a, b) => {
      const dateA = new Date(a.pubDate).getTime();
      const dateB = new Date(b.pubDate).getTime();
      return dateB - dateA;
    });

    console.log('=== 최종 결과 ===');
    console.log('총 만평 수:', cartoons.length);
    console.log('출처별:', cartoons.reduce((acc: any, c) => {
      acc[c.source] = (acc[c.source] || 0) + 1;
      return acc;
    }, {}));

    return NextResponse.json({
      success: true,
      count: cartoons.length,
      data: cartoons,
    });
  } catch (error) {
    console.error('RSS 파싱 에러:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'RSS 피드를 가져오는데 실패했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
