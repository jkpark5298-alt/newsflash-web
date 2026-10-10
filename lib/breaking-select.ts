export type FeedPriority = "breaking" | "headline" | "general";

export type RankableArticle = {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  imageUrl?: string;
  feedPriority?: FeedPriority;
};

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

const PRIORITY_SCORE: Record<FeedPriority, number> = {
  breaking: 3,
  headline: 1,
  general: 0,
};

export function canonicalizeArticleLink(link: string): string {
  const trimmed = link.trim();

  try {
    const url = new URL(trimmed);

    for (const key of TRACKING_PARAMS) {
      url.searchParams.delete(key);
    }

    url.hash = "";

    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
  } catch {
    return trimmed;
  }
}

export function compactTitle(title: string): string {
  return title
    .replace(/\[(?:속보|단독|긴급|종합\d*)\]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
}

export function isNearDuplicateTitle(left: string, right: string): boolean {
  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;

  if (shorter.length >= 14 && longer.includes(shorter)) {
    return true;
  }

  if (shorter.length >= 18 && longer.slice(0, 18) === shorter.slice(0, 18)) {
    return true;
  }

  return false;
}

export function normalizeOutlet(source: string): string {
  if (source.startsWith("SBS")) return "SBS";
  if (source.startsWith("MBC")) return "MBC";
  if (source.startsWith("연합")) return "연합뉴스";
  if (source.startsWith("YTN")) return "YTN";
  return source;
}

export function isAlertKeywordValid(keyword: string): boolean {
  const parts = keyword
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 && parts.every((part) => part.length >= 2);
}

export function isKeywordMatch(text: string, keyword: string): boolean {
  if (!isAlertKeywordValid(keyword)) {
    return false;
  }

  const normalized = text.toLowerCase();
  const trimmed = keyword.trim().toLowerCase();

  if (trimmed.includes("+")) {
    const parts = trimmed
      .split("+")
      .map((part) => part.trim())
      .filter(Boolean);

    return parts.every((part) => normalized.includes(part));
  }

  return normalized.includes(trimmed);
}

export function articleStoryKey(title: string): string {
  const compact = compactTitle(title);

  if (compact.length < 10) {
    return "";
  }

  return `story:${compact}`;
}

export function isAlreadySeenArticle(
  seen: Set<string>,
  title: string,
  link: string,
): boolean {
  const normalizedLink = link.trim();

  if (normalizedLink && seen.has(normalizedLink)) {
    return true;
  }

  const key = articleStoryKey(title);

  if (key && seen.has(key)) {
    return true;
  }

  const compact = compactTitle(title);

  if (compact.length < 10) {
    return false;
  }

  for (const item of seen) {
    if (!item.startsWith("story:")) {
      continue;
    }

    if (isNearDuplicateTitle(compact, item.slice("story:".length))) {
      return true;
    }
  }

  return false;
}

export function rememberSeenArticle(
  seen: Set<string>,
  title: string,
  link: string,
): void {
  const normalizedLink = link.trim();

  if (normalizedLink) {
    seen.add(normalizedLink);
  }

  const key = articleStoryKey(title);

  if (key) {
    seen.add(key);
  }
}

export function seoulParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const read = (type: Intl.DateTimeFormatPartTypes) => {
    const value = Number(parts.find((part) => part.type === type)?.value);
    return Number.isNaN(value) ? 0 : value;
  };

  let hour = read("hour");

  if (hour === 24) {
    hour = 0;
  }

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour,
    minute: read("minute"),
  };
}

export function koreanWallTimeToIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): string | undefined {
  if (
    [year, month, day, hour, minute, second].some((value) =>
      Number.isNaN(value),
    )
  ) {
    return undefined;
  }

  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}+09:00`;
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

export function resolveClockTimePubDate(
  hour: number,
  minute: number,
  now = new Date(),
): string | undefined {
  const seoul = seoulParts(now);
  let year = seoul.year;
  let month = seoul.month;
  let day = seoul.day;
  const nowMinutes = seoul.hour * 60 + seoul.minute;
  const targetMinutes = hour * 60 + minute;

  if (targetMinutes > nowMinutes + 60) {
    const noon = koreanWallTimeToIso(year, month, day, 12, 0);

    if (!noon) {
      return undefined;
    }

    const previous = seoulParts(new Date(new Date(noon).getTime() - 24 * 60 * 60 * 1000));
    year = previous.year;
    month = previous.month;
    day = previous.day;
  }

  return koreanWallTimeToIso(year, month, day, hour, minute, 0);
}

function recencyScore(pubDate: string, now = Date.now()): number {
  const published = new Date(pubDate).getTime();

  if (Number.isNaN(published)) {
    return 0;
  }

  const diffHours = (now - published) / 3600000;

  if (diffHours < 0) {
    return 0;
  }

  if (diffHours <= 1) return 8;
  if (diffHours <= 3) return 6;
  if (diffHours <= 6) return 4;
  if (diffHours <= 12) return 2;
  return 0;
}

function hasBreakingMark(title: string): boolean {
  return /속보|긴급/.test(title);
}

function routinePenalty(title: string): number {
  if (/부고|부음|별세/.test(title)) {
    return 20;
  }

  return 0;
}

function descriptionQuality(description: string): number {
  if (!description || description === "내용 없음") {
    return 0;
  }

  return Math.min(description.length, 180);
}

function pickRepresentative<T extends RankableArticle>(group: T[], now: number): T {
  return [...group].sort((left, right) => {
    const score = (item: T) =>
      descriptionQuality(item.description) +
      (item.imageUrl ? 40 : 0) +
      PRIORITY_SCORE[item.feedPriority || "general"] * 5 +
      recencyScore(item.pubDate, now) * 5;

    return score(right) - score(left);
  })[0];
}

function groupArticles<T extends RankableArticle>(articles: T[]): T[][] {
  const groups: Array<{ compactTitles: string[]; articles: T[] }> = [];

  for (const article of articles) {
    const compact = compactTitle(article.title);
    const existing = groups.find((group) =>
      group.compactTitles.some((title) => isNearDuplicateTitle(compact, title)),
    );

    if (existing) {
      existing.articles.push(article);
      existing.compactTitles.push(compact);
      continue;
    }

    groups.push({
      compactTitles: [compact],
      articles: [article],
    });
  }

  return groups.map((group) => group.articles);
}

export function selectBreakingLists<T extends RankableArticle>(
  articles: T[],
  options?: { featuredLimit?: number; perSource?: number; now?: number },
): { articles: T[]; featured: T[] } {
  const now = options?.now ?? Date.now();
  const featuredLimit = options?.featuredLimit ?? 12;
  const perSource = options?.perSource ?? 2;
  const groups = groupArticles(articles);

  const rankedGroups = groups
    .map((group) => {
      const representative = pickRepresentative(group, now);
      const outlets = new Set(group.map((item) => normalizeOutlet(item.source)));
      const priority = Math.max(
        ...group.map((item) => PRIORITY_SCORE[item.feedPriority || "general"]),
      );
      const score =
        outlets.size * 12 +
        Math.min(group.length, 6) * 2 +
        recencyScore(representative.pubDate, now) +
        (hasBreakingMark(representative.title) ||
        group.some((item) => hasBreakingMark(item.title))
          ? 10
          : 0) +
        priority -
        routinePenalty(representative.title);

      return { representative, score };
    })
    .sort((left, right) => {
      const scoreDiff = right.score - left.score;

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return (
        new Date(right.representative.pubDate).getTime() -
        new Date(left.representative.pubDate).getTime()
      );
    });

  const chronological = rankedGroups
    .map((group) => group.representative)
    .sort(
      (left, right) =>
        new Date(right.pubDate).getTime() - new Date(left.pubDate).getTime(),
    );

  const featured: T[] = [];
  const sourceCounts = new Map<string, number>();
  const leftovers: T[] = [];

  for (const group of rankedGroups) {
    const source = normalizeOutlet(group.representative.source);
    const count = sourceCounts.get(source) || 0;

    if (count >= perSource) {
      leftovers.push(group.representative);
      continue;
    }

    sourceCounts.set(source, count + 1);
    featured.push(group.representative);

    if (featured.length >= featuredLimit) {
      break;
    }
  }

  if (featured.length < featuredLimit) {
    for (const article of leftovers) {
      featured.push(article);

      if (featured.length >= featuredLimit) {
        break;
      }
    }
  }

  return { articles: chronological, featured };
}
