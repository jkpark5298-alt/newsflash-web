import assert from "node:assert/strict";
import { classifyEconomyTopic, previewEconomyNews, selectEconomyNews } from "../lib/economy-select.ts";

const now = Date.parse("2026-10-10T00:30:00.000Z");

assert.equal(classifyEconomyTopic("코스피가 장중 하락"), "증권");
assert.equal(classifyEconomyTopic("강남 아파트 분양가 상승"), "부동산");
assert.equal(classifyEconomyTopic("한국어교원 고용과 처우"), null);
assert.equal(classifyEconomyTopic("곡물가가 치솟았다"), null);
assert.equal(classifyEconomyTopic("9월 수출액이 늘었다"), "수출");
assert.equal(classifyEconomyTopic("K-뷰티 화장품 수출이 늘었다"), "화장품");
assert.equal(classifyEconomyTopic("한국은행 기준금리 동결"), "경제지표");
assert.equal(classifyEconomyTopic("2분기 GDP와 고용 통계"), "경제통계");
assert.equal(classifyEconomyTopic("코스피와 금리"), "증권");
assert.equal(classifyEconomyTopic("음식료株 저점 매수 종목"), "증권");
assert.equal(classifyEconomyTopic("제발 그냥 먹지 마세요"), null);
assert.equal(classifyEconomyTopic("매출을 폭증시킨 과자"), null);
assert.equal(classifyEconomyTopic("피해자 주택 주변을 답사"), "부동산");
assert.equal(
  selectEconomyNews(
    [
      {
        title: "나주 부부 살해 사건 구속",
        link: "https://news.example/crime",
        pubDate: "2026-10-09T23:50:00.000Z",
        description: "피해자 주택 주변을 사전 답사했다",
        source: "연합뉴스",
      },
    ],
    now,
  ).length,
  0,
);

const selected = selectEconomyNews(
  [
    {
      title: "[부고] 증권사 회장 별세",
      link: "https://news.example/obit",
      pubDate: "2026-10-09T22:00:00.000Z",
      description: "빈소 안내",
      source: "연합뉴스",
      topic: "증권" as const,
    },
    {
      title: "코스피 지지부진 속 코스닥 선전",
      link: "https://news.example/stock?utm_source=rss",
      pubDate: "2026-10-09T23:00:00.000Z",
      description: "증시 마감",
      source: "연합뉴스",
    },
    {
      title: "코스피 지지부진 속 코스닥 선전",
      link: "https://news.example/stock",
      pubDate: "2026-10-09T23:10:00.000Z",
      description: "같은 기사",
      source: "매일경제",
    },
    {
      title: "서울시 모아주택으로 1735가구 공급",
      link: "https://news.example/house",
      pubDate: "2026-10-09T12:00:00.000Z",
      description: "재개발 소식",
      source: "아시아경제",
      topic: "부동산" as const,
    },
    {
      title: "취업자 수와 성장률",
      link: "https://news.example/macro",
      pubDate: "2026-10-09T23:40:00.000Z",
      description: "다음주 경제 일정",
      source: "연합뉴스",
    },
  ],
  now,
);

assert.equal(selected.length, 3);
assert.equal(selected[0].topic, "경제통계");
assert.equal(selected[0].title.includes("취업자"), true);
assert.equal(selected.find((article) => article.topic === "증권")?.link, "https://news.example/stock");
assert.equal(selected.some((article) => article.topic === "부동산"), true);
assert.equal(selected.some((article) => article.title.includes("부고")), false);

const crowded = selectEconomyNews(
  [
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((index) => ({
      title: `코스피 마감 ${index}`,
      link: `https://news.example/kospi-${index}`,
      pubDate: new Date(now - index * 60_000).toISOString(),
      description: "증시",
      source: "매일경제",
      topic: "증권" as const,
    })),
    {
      title: "강남 아파트 재건축 분양",
      link: "https://news.example/apt",
      pubDate: new Date(now - 20 * 60 * 60 * 1000).toISOString(),
      description: "부동산",
      source: "아시아경제",
      topic: "부동산" as const,
    },
  ],
  now,
);

assert.equal(crowded.some((article) => article.topic === "부동산"), true);
const preview = previewEconomyNews(crowded, 6);
assert.equal(preview.length, 6);
assert.equal(preview.filter((article) => article.topic === "부동산").length, 1);

console.log("economy-select tests passed");
