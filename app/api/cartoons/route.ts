import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

interface Cartoon {
  title: string;
  imageUrl: string;
  link: string;
  source: string;
  date?: string;
}

// 경향신문 만평 크롤링
async function fetchKyunghyangCartoons(): Promise<Cartoon[]> {
  try {
    const response = await fetch('https://www.khan.co.kr/cartoon', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`경향신문 응답 실패: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const cartoons: Cartoon[] = [];

    $('.cartoon-list .item, .list-item, article').each((index, element) => {
      const $element = $(element);
      const title = $element.find('h3, .title, .tit').text().trim() || 
                   $element.find('img').attr('alt') || 
                   '경향신문 만평';
      const imageUrl = $element.find('img').attr('src') || '';
      const link = $element.find('a').attr('href') || '';
      const date = $element.find('.date, time').text().trim();

      if (imageUrl) {
        cartoons.push({
          title,
          imageUrl: imageUrl.startsWith('http') ? imageUrl : `https://www.khan.co.kr${imageUrl}`,
          link: link.startsWith('http') ? link : `https://www.khan.co.kr${link}`,
          source: '경향신문',
          date: date || undefined
        });
      }
    });

    return cartoons;
  } catch (error) {
    console.error('경향신문 크롤링 실패:', error);
    return [];
  }
}

// 한겨레 만평 크롤링
async function fetchHankyorehCartoons(): Promise<Cartoon[]> {
  try {
    const response = await fetch('https://www.hani.co.kr/arti/cartoon', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`한겨레 응답 실패: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const cartoons: Cartoon[] = [];

    $('.article-list .article-item, .cartoon-list li, article').each((index, element) => {
      const $element = $(element);
      const title = $element.find('h4, .title, .tit').text().trim() || 
                   $element.find('img').attr('alt') || 
                   '한겨레 만평';
      const imageUrl = $element.find('img').attr('src') || '';
      const link = $element.find('a').attr('href') || '';
      const date = $element.find('.date, time').text().trim();

      if (imageUrl) {
        cartoons.push({
          title,
          imageUrl: imageUrl.startsWith('http') ? imageUrl : `https://www.hani.co.kr${imageUrl}`,
          link: link.startsWith('http') ? link : `https://www.hani.co.kr${link}`,
          source: '한겨레',
          date: date || undefined
        });
      }
    });

    return cartoons;
  } catch (error) {
    console.error('한겨레 크롤링 실패:', error);
    return [];
  }
}

// 조선일보 만평 크롤링
async function fetchChosunCartoons(): Promise<Cartoon[]> {
  try {
    const response = await fetch('https://www.chosun.com/cartoon/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`조선일보 응답 실패: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const cartoons: Cartoon[] = [];

    $('.cartoon-list .item, .list-item, article, .art_list li').each((index, element) => {
      const $element = $(element);
      const title = $element.find('h3, .title, .tit, strong').text().trim() || 
                   $element.find('img').attr('alt') || 
                   '조선일보 만평';
      const imageUrl = $element.find('img').attr('src') || 
                      $element.find('img').attr('data-src') || '';
      const link = $element.find('a').attr('href') || '';
      const date = $element.find('.date, time, .byline').text().trim();

      if (imageUrl) {
        cartoons.push({
          title,
          imageUrl: imageUrl.startsWith('http') ? imageUrl : `https://www.chosun.com${imageUrl}`,
          link: link.startsWith('http') ? link : `https://www.chosun.com${link}`,
          source: '조선일보',
          date: date || undefined
        });
      }
    });

    return cartoons;
  } catch (error) {
    console.error('조선일보 크롤링 실패:', error);
    return [];
  }
}

export async function GET() {
  try {
    // 모든 신문사의 만평을 병렬로 가져오기
    const [kyunghyang, hankyoreh, chosun] = await Promise.all([
      fetchKyunghyangCartoons(),
      fetchHankyorehCartoons(),
      fetchChosunCartoons()
    ]);

    // 모든 만평 합치기
    const allCartoons = [...kyunghyang, ...hankyoreh, ...chosun];

    // 만평이 하나도 없으면 샘플 데이터 반환
    if (allCartoons.length === 0) {
      return NextResponse.json({
        cartoons: [
          {
            title: '샘플 만평',
            imageUrl: 'https://via.placeholder.com/400x300?text=Sample+Cartoon',
            link: '#',
            source: '샘플',
            date: new Date().toISOString().split('T')[0]
          }
        ],
        total: 1,
        message: '실제 만평 데이터를 가져올 수 없어 샘플 데이터를 표시합니다.'
      });
    }

    return NextResponse.json({
      cartoons: allCartoons,
      total: allCartoons.length,
      sources: {
        kyunghyang: kyunghyang.length,
        hankyoreh: hankyoreh.length,
        chosun: chosun.length
      }
    });

  } catch (error) {
    console.error('만평 API 에러:', error);
    return NextResponse.json(
      { 
        error: '만평을 가져오는데 실패했습니다.',
        cartoons: [],
        total: 0
      },
      { status: 500 }
    );
  }
}
