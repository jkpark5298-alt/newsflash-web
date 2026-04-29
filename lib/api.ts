// 만평 관련 (클라이언트 전용)
export const CARTOON_FEEDS = [
  'https://www.hani.co.kr/rss/cartoon/',
  'https://www.khan.co.kr/opinion/',
  'https://www.joongang.co.kr/rss/cartoon.xml'
];

export interface Cartoon {
  title: string;
  link: string;
  imageUrl: string;
  pubDate: string;
  source: string;
}

export async function fetchCartoons(): Promise<Cartoon[]> {
  try {
    const response = await fetch('/api/cartoons');
    if (!response.ok) {
      throw new Error('만평을 불러올 수 없습니다');
    }
    return await response.json();
  } catch (error) {
    console.error('만평 로딩 오류:', error);
    return [];
  }
}

// RSS 피드 URL들 (참고용)
export const RSS_FEEDS = [
  { name: '연합뉴스', url: 'https://www.yonhapnewstv.co.kr/category/news/headline/feed/' },
  { name: 'KBS', url: 'https://news.kbs.co.kr/rss/headline.xml' },
  { name: 'MBC', url: 'https://imnews.imbc.com/rss/news/news_00.xml' },
  { name: 'SBS', url: 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01' },
  { name: 'JTBC', url: 'https://fs.jtbc.co.kr/RSS/newsflash.xml' }
];
