import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

export async function GET() {
  try {
    const parser = new Parser({
      customFields: {
        item: [
          ['media:content', 'media:content', { keepArray: true }],
          ['content:encoded', 'content:encoded'],
          ['description', 'description']
        ]
      }
    });

    const feed = await parser.parseURL('https://www.hani.co.kr/rss/cartoon/');
    
    // 첫 번째 아이템의 전체 구조 출력
    const firstItem = feed.items[0];
    
    return NextResponse.json({
      feedTitle: feed.title,
      itemCount: feed.items.length,
      firstItem: {
        title: firstItem.title,
        link: firstItem.link,
        pubDate: firstItem.pubDate,
        'media:content': firstItem['media:content'],
        'content:encoded': firstItem['content:encoded'],
        description: firstItem.description,
        enclosure: firstItem.enclosure,
        allKeys: Object.keys(firstItem)
      }
    }, { status: 200 });

  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
