import { NextResponse } from "next/server";
import {
  classifyEconomyTopic,
  ECONOMY_TOPICS,
  selectEconomyNews,
  type EconomyTopic,
} from "@/lib/economy-select";
import { canonicalizeArticleLink, isObituaryTitle } from "@/lib/breaking-select";
import {
  cleanDescription,
  createRssParser,
  extractImageUrl,
  withTtlCache,
  type RSSItem,
} from "@/lib/rss";

type EconomyArticle = {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  imageUrl?: string;
  category: "국내";
  topic: EconomyTopic;
};

type EconomyFeed = {
  url: string;
  source: string;
  limit: number;
  topic?: EconomyTopic;
};

const ECONOMY_CACHE_TTL_MS = 60_000;
const ECONOMY_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=30";
const MAX_AGE_MS = 36 * 60 * 60 * 1000;

const FEEDS: EconomyFeed[] = [
  {
    url: "https://www.mk.co.kr/rss/50200011/",
    source: "매일경제",
    limit: 12,
    topic: "증권",
  },
  {
    url: "https://view.asiae.co.kr/rss/stock.htm",
    source: "아시아경제",
    limit: 10,
  },
  {
    url: "https://view.asiae.co.kr/rss/realestate.htm",
    source: "아시아경제",
    limit: 12,
  },
  {
    url: "https://www.yna.co.kr/rss/market.xml",
    source: "연합뉴스",
    limit: 12,
  },
  {
    url: "https://www.yna.co.kr/rss/economy.xml",
    source: "연합뉴스",
    limit: 12,
  },
  {
    url: "https://view.asiae.co.kr/rss/economy.htm",
    source: "아시아경제",
    limit: 12,
  },
];

const parser = createRssParser();

function itemPubDate(item: RSSItem) {
  const value = item.isoDate || item.pubDate;

  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function isRecent(pubDate: string) {
  const published = Date.parse(pubDate);

  if (Number.isNaN(published)) {
    return false;
  }

  const diff = Date.now() - published;

  if (diff < -60 * 60 * 1000) {
    return false;
  }

  return diff <= MAX_AGE_MS;
}

async function fetchEconomyFeed(feed: EconomyFeed): Promise<EconomyArticle[]> {
  try {
    const parsed = await parser.parseURL(feed.url);
    const articles: EconomyArticle[] = [];

    for (const item of parsed.items) {
      if (!item.link || !/^https?:\/\//i.test(item.link)) {
        continue;
      }

      const title = cleanDescription(item.title || "", { emptyFallback: "" });
      const description = cleanDescription(
        item.contentSnippet || item.description || item.content || "",
      );
      const pubDate = itemPubDate(item);

      if (!title || !pubDate || !isRecent(pubDate) || isObituaryTitle(title)) {
        continue;
      }

      const topic = feed.topic ?? classifyEconomyTopic(title);

      if (!topic) {
        continue;
      }

      articles.push({
        title,
        link: canonicalizeArticleLink(item.link),
        pubDate,
        description,
        source: feed.source,
        imageUrl: extractImageUrl(item),
        category: "국내",
        topic,
      });
    }

    articles.sort(
      (left, right) => Date.parse(right.pubDate) - Date.parse(left.pubDate),
    );

    return articles.slice(0, feed.limit);
  } catch (error) {
    console.error(`경제 피드 수집 실패 (${feed.source}):`, error);
    return [];
  }
}

async function aggregateEconomyNews() {
  const results = await Promise.all(FEEDS.map((feed) => fetchEconomyFeed(feed)));
  const articles = selectEconomyNews(results.flat());

  return {
    articles,
    lastUpdated: new Date().toISOString(),
    totalCount: articles.length,
    topicCounts: ECONOMY_TOPICS.reduce<Record<string, number>>((counts, topic) => {
      counts[topic] = articles.filter((article) => article.topic === topic).length;
      return counts;
    }, {}),
  };
}

export async function GET() {
  try {
    const payload = await withTtlCache(
      "economy-news-v9",
      ECONOMY_CACHE_TTL_MS,
      aggregateEconomyNews,
    );

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": ECONOMY_CACHE_CONTROL,
      },
    });
  } catch (error) {
    console.error("경제 뉴스 API 에러:", error);

    return NextResponse.json(
      {
        error: "경제 뉴스를 불러오지 못했습니다.",
        articles: [],
        totalCount: 0,
        topicCounts: {},
      },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
