import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

interface CartoonItem {
  title: string;
  imageUrl: string;
  link: string;
  source: string;
}

export async function GET() {
  try {
    const parser = new Parser();
    const feed = await parser.parseURL('https://www.hani.co.kr/rss/cartoon/');
    
    const cartoons: CartoonItem[] = feed.items.slice(0, 10).map((item) => {
      let imageUrl = '';
      
      // content에서 이미지 URL 추출
      if (item.content) {
        // 따옴표로 감싸진 src 찾기
        let imgMatch = item.content.match(/<img[^>]+src=["']([^"']+)["']/i);
        
        // 따옴표 없는 src 찾기
        if (!imgMatch) {
          imgMatch = item.content.match(/<img[^>]+src=([^\s>]+)/i);
        }
        
        if (imgMatch && imgMatch[1]) {
          imageUrl = imgMatch[1];
        }
      }

      // 상대 경로를 절대 경로로 변환
      if (imageUrl && imageUrl.startsWith('/')) {
        imageUrl = 'https://www.hani.co.kr' + imageUrl;
      }

      return {
        title: item.title || '제목 없음',
        imageUrl: imageUrl,
        link: item.link || '#',
        source: '그림판'
      };
    });

    return NextResponse.json({
      success: true,
      count: cartoons.length,
      cartoons: cartoons
    });

  } catch (error) {
    console.error('RSS 파싱 에러:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'RSS 피드를 가져오는데 실패했습니다.',
        cartoons: []
      },
      { status: 500 }
    );
  }
}
