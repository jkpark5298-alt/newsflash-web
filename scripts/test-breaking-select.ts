import assert from "node:assert/strict";
import {
  canonicalizeArticleLink,
  isAlertKeywordValid,
  isAlreadySeenArticle,
  isKeywordMatch,
  isNearDuplicateTitle,
  rememberSeenArticle,
  resolveClockTimePubDate,
  selectBreakingLists,
  koreanWallTimeToIso,
} from "../lib/breaking-select.ts";

const now = new Date("2026-10-10T00:00:00.000Z");

assert.equal(
  canonicalizeArticleLink("https://news.example.com/a?utm_source=rss&id=1"),
  "https://news.example.com/a?id=1",
);

assert.equal(
  isNearDuplicateTitle(
    "대통령이대국민담화에서경제정책을발표",
    "대통령이대국민담화에서경제정책을발표했다",
  ),
  true,
);
assert.equal(isNearDuplicateTitle("코스피상승", "환율급등"), false);

assert.equal(isAlertKeywordValid("미"), false);
assert.equal(isAlertKeywordValid("환율"), true);
assert.equal(isAlertKeywordValid("금리+한"), false);
assert.equal(isAlertKeywordValid("금리+한국"), true);
assert.equal(isKeywordMatch("한국 기준금리 동결", "미"), false);
assert.equal(isKeywordMatch("한국 기준금리 동결", "금리+한국"), true);

const seen = new Set<string>();
rememberSeenArticle(seen, "윤 대통령, 대국민 담화 발표", "https://a.example/1");
assert.equal(
  isAlreadySeenArticle(seen, "윤 대통령 대국민 담화 발표", "https://b.example/2"),
  true,
);

const clock = resolveClockTimePubDate(23, 30, now);
const parsedClock = new Date(clock || "");
assert.equal(Number.isNaN(parsedClock.getTime()), false);
assert.ok(parsedClock.getTime() <= now.getTime());

const wall = koreanWallTimeToIso(2026, 10, 10, 8, 30, 0);
assert.equal(wall, "2026-10-09T23:30:00.000Z");

const selected = selectBreakingLists(
  [
    {
      title: "대통령이 대국민 담화에서 경제정책을 발표",
      link: "https://a.example/1",
      pubDate: "2026-10-09T23:50:00.000Z",
      description: "담화 내용입니다. 충분히 긴 설명입니다.",
      source: "연합뉴스",
      feedPriority: "headline" as const,
    },
    {
      title: "[속보] 대통령이 대국민 담화에서 경제정책을 발표했다",
      link: "https://b.example/2",
      pubDate: "2026-10-09T23:40:00.000Z",
      description: "다른 매체 설명입니다. 충분히 긴 설명입니다.",
      source: "JTBC",
      feedPriority: "breaking" as const,
    },
    {
      title: "코스피가 장중에 소폭으로 상승 마감",
      link: "https://c.example/3",
      pubDate: "2026-10-09T23:55:00.000Z",
      description: "증시 설명입니다. 충분히 긴 설명입니다.",
      source: "SBS",
      feedPriority: "general" as const,
    },
    {
      title: "코스피가 장중에 소폭으로 상승 마감 소식",
      link: "https://d.example/4",
      pubDate: "2026-10-09T23:20:00.000Z",
      description: "다른 증시 설명입니다. 충분히 긴 설명입니다.",
      source: "MBC",
      feedPriority: "general" as const,
    },
    {
      title: "날씨 맑음",
      link: "https://e.example/5",
      pubDate: "2026-10-09T23:58:00.000Z",
      description: "날씨 설명입니다. 충분히 긴 설명입니다.",
      source: "SBS 주요뉴스",
      feedPriority: "general" as const,
    },
  ],
  { now: now.getTime(), featuredLimit: 3, perSource: 2 },
);

assert.equal(selected.articles.length, 3);
assert.equal(selected.featured[0].title.includes("담화"), true);

const diverse = selectBreakingLists(
  [
    ...[1, 2, 3].map((index) => ({
      title: `서울 교통 통제 ${index}번째 서로 다른 소식`,
      link: `https://sbs.example/${index}`,
      pubDate: new Date(now.getTime() - index * 60_000).toISOString(),
      description: "설명입니다. 충분히 긴 설명입니다.",
      source: "SBS",
      feedPriority: "general" as const,
    })),
    {
      title: "부산 항만 하역 작업이 재개됐다",
      link: "https://jtbc.example/1",
      pubDate: new Date(now.getTime() - 4 * 60_000).toISOString(),
      description: "설명입니다. 충분히 긴 설명입니다.",
      source: "JTBC",
      feedPriority: "breaking" as const,
    },
  ],
  { now: now.getTime(), featuredLimit: 3, perSource: 2 },
);

assert.equal(diverse.featured.length, 3);
assert.ok(diverse.featured.filter((article) => article.source === "SBS").length <= 2);
assert.equal(diverse.featured.some((article) => article.source === "JTBC"), true);

console.log("breaking-select tests passed");
