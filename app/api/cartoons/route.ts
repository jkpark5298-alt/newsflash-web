import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

interface CartoonItem {
  title: string;
  imageUrl: string;
  link: string;
  source: string;
  pubDate: string;
  publishedAt: string;
}

function normalizeDateValue(value?: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function extractDateFromUrl(...values: Array<string | undefined | null>) {
  const combined = values.filter(Boolean).join(' ');

  const pathDateMatch = combined.match(/\/(20\d{2})\/(\d{2})(\d{2})\//);

  if (pathDateMatch) {
    const [, year, month, day] = pathDateMatch;
    return `${year}-${month}-${day}`;
  }

  const compactDateMatch = combined.match(/(20\d{2})(\d{2})(\d{2})/);

  if (compactDateMatch) {
    const [, year, month, day] = compactDateMatch;
    return `${year}-${month}-${day}`;
  }

  return '';
}

function pickPublishedDate(item: Parser.Item, imageUrl: string) {
  const possibleDateFields = [
    item.isoDate,
    item.pubDate,
    item.pubDate && item.pubDate.replace(/\s+/g, ' '),
  ];

  for (const value of possibleDateFields) {
    const normalized = normalizeDateValue(value);

    if (normalized) {
      return normalized;
    }
  }

  return extractDateFromUrl(imageUrl, item.link, item.content, item.contentSnippet);
}

export async function GET() {
  try {
    const parser = new Parser();
    const feed = await parser.parseURL('https://www.hani.co.kr/rss/cartoon/');

    const cartoons: CartoonItem[] = feed.items.slice(0, 10).map((item) => {
      let imageUrl = '';

      if (item.content) {
        let imgMatch = item.content.match(/<img[^>]+src=["']([^"']+)["']/i);

        if (!imgMatch) {
          imgMatch = item.content.match(/<img[^>]+src=([^\s>]+)/i);
        }

        if (imgMatch && imgMatch[1]) {
          imageUrl = imgMatch[1];
        }
      }

      if (imageUrl && imageUrl.startsWith('/')) {
        imageUrl = 'https://www.hani.co.kr' + imageUrl;
      }

      const publishedDate = pickPublishedDate(item, imageUrl);

      return {
        title: item.title || '제목 없음',
        imageUrl,
        link: item.link || '#',
        source: '그림판',
        pubDate: publishedDate,
        publishedAt: publishedDate,
      };
    });

    return NextResponse.json({
      success: true,
      count: cartoons.length,
      cartoons,
    });
  } catch (error) {
    console.error('RSS 파싱 에러:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'RSS 피드를 가져오는데 실패했습니다.',
        cartoons: [],
      },
      { status: 500 },
    );
  }
}
