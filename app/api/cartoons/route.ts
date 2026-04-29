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
    const response = await fetch('https://www.khan.co.kr/opinion/cartoon', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      }
    });
    
    if (!response.ok) {
      console.error(`경향신문 응답 실패: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const cartoons: Cartoon[] = [];

    // 경향신문의 실제 구조에 맞춘 선택자
    $('article.art_list_item, .cartoon_list li, .list_article').each((index, element) => {
      const $element = $(element);
      
      // 이미지 찾기 (여러 속성 시도)
      const $img = $element.find('img');
      const imageUrl = $img.attr('src') || 
                      $img.attr('data-src') || 
                      $img.attr('data-lazy-src') || '';
      
      if (!imageUrl) return;

      // 제목 찾기
      const title = $element.find('.art_tit, .tit, h3, h4').text().trim() || 
                   $img.attr('alt')?.trim() || 
                   '경향신문 만평';
      
      // 링크 찾기
      const $link = $element.find('a').first();
      const link = $link.attr('href') || '';
      
      // 날짜 찾기
      const date = $element.find('.date, .art_date, time').text().trim();

      cartoons.push({
        title,
        imageUrl: imageUrl.startsWith('http') ? imageUrl : `https://www.khan.co.kr${imageUrl}`,
        link: link.startsWith('http') ? link : `https://www.khan.co.kr${link}`,
        source: '경향신문',
        date: date || undefined
      });
    });

    console.log(`경향신문 만평 ${cartoons.length}개 수집`);
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      }
    });
    
    if (!response.ok) {
      console.error(`한겨레 응답 실패: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const cartoons: Cartoon[] = [];

    // 한겨레의 실제 구조에 맞춘 선택자
    $('.article-list .article-item, .cartoon-list li, .section-list-item').each((index, element) => {
      const $element = $(element);
      
      const $img = $element.find('img');
      const imageUrl = $img.attr('src') || 
                      $img.attr('data-src') || 
                      $img.attr('data-original') || '';
      
      if (!imageUrl) return;

      const title = $element.find('.article-title, .tit, h4').text().trim() || 
                   $img.attr('alt')?.trim() || 
                   '한겨레 만평';
      
      const $link = $element.find('a').first();
      const link = $link.attr('href') || '';
      
      const date = $element.find('.date, .article-date, time').text().trim();

      cartoons.push({
        title,
        imageUrl: imageUrl.startsWith('http') ? imageUrl : `https://www.hani.co.kr${imageUrl}`,
        link: link.startsWith('http') ? link : `https://www.hani.co.kr${link}`,
        source: '한겨레',
        date: date || undefined
      });
    });

    console.log(`한겨레 만평 ${cartoons.length}개 수집`);
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      }
    });
    
    if (!response.ok) {
      console.error(`조선일보 응답 실패: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const cartoons: Cartoon[] = [];

    $('.story-card, .art_list li, article').each((index, element) => {
      const $element = $(element);
      
      const $img = $element.find('img');
      const imageUrl = $img.attr('src') || 
                      $img.attr('data-src') || 
                      $img.attr('data-lazy-src') || '';
      
      if (!imageUrl) return;

      const title = $element.find('.story-card__headline, .tit, strong').text().trim() || 
                   $img.attr('alt')?.trim() || 
                   '조선일보 만평';
      
      const $link = $element.find('a').first();
      const link = $link.attr('href') || '';
      
      const date = $element.find('.story-card__date, .date, time').text().trim();

      cartoons.push({
        title,
        imageUrl: imageUrl.startsWith('http') ? imageUrl : `https://www.chosun.com${imageUrl}`,
        link: link.startsWith('http') ? link : `https://www.chosun.com${link}`,
        source: '조선일보',
        date: date || undefined
      });
    });

    console.log(`조선일보 만평 ${cartoons.length}개 수집`);
    return cartoons;
  } catch (error) {
    console.error('조선일보 크롤링 실패:', error);
    return [];
  }
}

export async function GET() {
  try {
    console.log('만평 크롤링 시작...');
    
    // 모든 신문사의 만평을 병렬로 가져오기
    const [kyunghyang, hankyoreh, chosun] = await Promise.all([
      fetchKyunghyangCartoons(),
      fetchHankyorehCartoons(),
      fetchChosunCartoons()
    ]);

    // 모든 만평 합치기
    const allCartoons = [...kyunghyang, ...hankyoreh, ...chosun];

    console.log(`총 ${allCartoons.length}개 만평 수집 완료`);

    // 만평이 하나도 없으면 샘플 데이터 반환
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
