const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "plink",
  "oc",
];

function canonicalLink(link: string) {
  try {
    const url = new URL(link.trim());

    for (const key of TRACKING_PARAMS) {
      url.searchParams.delete(key);
    }

    url.hash = "";

    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
  } catch {
    return link.trim();
  }
}

function isObituary(title: string) {
  return /부고|부음|별세/.test(title);
}

export type EconomyTopic =
  | "증권"
  | "부동산"
  | "수출"
  | "화장품"
  | "경제지표"
  | "경제통계";

export const ECONOMY_TOPICS: EconomyTopic[] = [
  "증권",
  "부동산",
  "수출",
  "화장품",
  "경제지표",
  "경제통계",
];

export const ECONOMY_MAX_AGE_HOURS = 36;
export const ECONOMY_PER_TOPIC_LIMIT = 6;

const TOPIC_KEYWORDS: Array<[EconomyTopic, string[]]> = [
  [
    "화장품",
    ["화장품", "k-뷰티", "k뷰티", "화장품주"],
  ],
  ["수출", ["수출", "수출액", "무역", "통관", "수출주"]],
  [
    "부동산",
    [
      "부동산",
      "아파트",
      "전세",
      "분양",
      "재건축",
      "재개발",
      "청약",
      "집값",
      "주택",
      "오피스텔",
      "주담대",
      "전월세",
      "분양가",
      "입주자",
      "모아주택",
      "용적률",
    ],
  ],
  [
    "증권",
    [
      "코스피",
      "코스닥",
      "증시",
      "주가",
      "주식",
      "증권",
      "나스닥",
      "다우",
      "뉴욕증시",
      "공시",
      "상장",
      "배당",
      "시가총액",
      "시총",
      "etf",
      "순매수",
      "순매도",
      "종목",
      "株",
      "레버리지",
      "시황",
    ],
  ],
  [
    "경제통계",
    ["경제통계", "국민계정", "gdp", "고용률", "실업률", "취업자", "소비자물가", "경기지표", "산업생산"],
  ],
  [
    "경제지표",
    ["금리", "기준금리", "환율", "물가", "인플레이션", "국채", "원달러"],
  ],
];

export type EconomyCandidate = {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  imageUrl?: string;
  category?: "국내" | "국제";
  topic?: EconomyTopic;
};

function keywordHits(text: string, keywords: string[]) {
  return keywords.filter((keyword) => {
    let index = text.indexOf(keyword);

    while (index !== -1) {
      const precededByGrain = keyword === "물가" && text[index - 1] === "곡";
      const surgeCausative =
        keyword === "증시" && text.startsWith("킨", index + keyword.length);

      if (!precededByGrain && !surgeCausative) {
        return true;
      }

      index = text.indexOf(keyword, index + keyword.length);
    }

    return false;
  }).length;
}

export function classifyEconomyTopic(text: string): EconomyTopic | null {
  const normalized = text.toLowerCase();
  const matches = TOPIC_KEYWORDS.map(([topic, keywords]) => ({
    topic,
    hits: keywordHits(normalized, keywords),
  })).filter((match) => match.hits > 0);

  if (matches.length === 0) {
    return null;
  }

  const specific = new Set<EconomyTopic>(["화장품", "수출", "부동산", "증권"]);
  const specificMatches = matches.filter((match) => specific.has(match.topic));
  const pool = specificMatches.length > 0 ? specificMatches : matches;

  return pool.sort((left, right) => right.hits - left.hits)[0].topic;
}

function isRecentEnough(pubDate: string, now: number) {
  const published = Date.parse(pubDate);

  if (Number.isNaN(published)) {
    return false;
  }

  const diff = now - published;

  if (diff < -60 * 60 * 1000) {
    return false;
  }

  return diff <= ECONOMY_MAX_AGE_HOURS * 60 * 60 * 1000;
}

export function selectEconomyNews<T extends EconomyCandidate>(
  articles: T[],
  now = Date.now(),
): Array<T & { topic: EconomyTopic }> {
  const seen = new Set<string>();
  const selected: Array<T & { topic: EconomyTopic }> = [];

  for (const article of articles) {
    if (isObituary(article.title)) {
      continue;
    }

    const topic = article.topic ?? classifyEconomyTopic(article.title);

    if (!topic || !isRecentEnough(article.pubDate, now)) {
      continue;
    }

    const link = canonicalLink(article.link);

    if (seen.has(link)) {
      continue;
    }

    seen.add(link);
    selected.push({ ...article, link, topic });
  }

  selected.sort(
    (left, right) => Date.parse(right.pubDate) - Date.parse(left.pubDate),
  );

  return ECONOMY_TOPICS.flatMap((topic) =>
    selected.filter((article) => article.topic === topic).slice(0, ECONOMY_PER_TOPIC_LIMIT),
  ).sort((left, right) => Date.parse(right.pubDate) - Date.parse(left.pubDate));
}

export function previewEconomyNews<T extends { topic: EconomyTopic; pubDate: string }>(
  articles: T[],
  limit = 6,
): T[] {
  const buckets = ECONOMY_TOPICS.map((topic) =>
    articles.filter((article) => article.topic === topic),
  );
  const picked: T[] = [];
  let cursor = 0;

  while (picked.length < limit && buckets.some((bucket) => bucket.length > 0)) {
    const bucket = buckets[cursor % buckets.length];
    cursor += 1;

    if (bucket.length === 0) {
      continue;
    }

    const next = bucket.shift();

    if (next) {
      picked.push(next);
    }
  }

  return picked.sort(
    (left, right) => Date.parse(right.pubDate) - Date.parse(left.pubDate),
  );
}
