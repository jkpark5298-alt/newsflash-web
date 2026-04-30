import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

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
  if (item.description) {
    const imgMatch = item.description.match(/<img[^>]+src=["']?([^"'\s>]+)["']?/i);
    if (imgMatch && imgMatch[1]) return imgMatch[1];
  }

  if (item.contentEncoded) {
    const imgMatch = item.contentEncoded.match(/<img[^>]+src=["']?([^"'\s>]+)["']?/i);
    if (imgMatch && imgMatch[1]) return imgMatch[1];
  }

  if (item.media) {
    if (Array.isArray(item.media)) {
      const imageMedia = item.media.find((m: any) => m.$?.url);
      if (imageMedia?.$?.url) return imageMedia.$.url;
    } else if (item.media.$?.url) {
      return item.media.$.url;
    }
  }

  if (item.mediaThumbnail?.$?.url) return item.mediaThumbnail.$.url;
  if (item.enclosure?.url) return item.enclosure.url;

  return null;
}

export async function GET() {
  try {
    const feed = await parser.parseURL('http://www.khan.co.kr/rss/rssdata/total_news.xml');
    
    const allItems = feed.items.slice(0, 50).map(item => ({
      title: item.title,
      link: item.link,
      hasImage: !!extractImageUrl(item),
      imageUrl: extractImageUrl(item),
      isCartoon: 
        item.title?.includes('만평') || 
        item.title?.includes('김용민') ||
        item.title?.includes('그림마당')
    }));

    const cartoonItems = allItems.filter(item => item.isCartoon);

    return NextResponse.json({
      totalItems: allItems.length,
      cartoonItems,
      cartoonCount: cartoonItems.length,
      allTitles: allItems.map(item => item.title).slice(0, 20)
    });

  } catch (error) {
    return NextResponse.json({
      error: String(error)
    }, { status: 500 });
  }
}
