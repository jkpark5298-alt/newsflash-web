import type { DetailView, EconomyIndicator, RegionFilter } from "./home-types";

export const BREAKING_REFRESH_MS = 5 * 60 * 1000;
export const COMMUNITY_REFRESH_MS = 5 * 60 * 1000;
export const CARTOON_REFRESH_MS = 60 * 60 * 1000;
export const INTERNATIONAL_REFRESH_MS = 15 * 60 * 1000;
export const MARKET_REFRESH_MS = 10 * 60 * 1000;
export const SAVED_ARTICLES_STORAGE_KEY = "newsflash.savedArticles.v1";
export const ALERT_KEYWORDS_STORAGE_KEY = "newsflash.alertKeywords.v1";
export const ALERT_ENABLED_STORAGE_KEY = "newsflash.alertEnabled.v1";
export const SCHEDULED_ALERT_ENABLED_STORAGE_KEY = "newsflash.scheduledAlertEnabled.v1";
export const SCHEDULED_NEWS_HOURS_STORAGE_KEY = "newsflash.scheduledNewsHours.v1";
export const RECENT_SCHEDULED_NEWS_STORAGE_KEY = "newsflash.recentScheduledNews.v1";
export const SAVED_SCHEDULED_NEWS_STORAGE_KEY = "newsflash.savedScheduledNews.v1";
export const RECENT_SCHEDULED_STOCK_STORAGE_KEY = "newsflash.recentScheduledStock.v1";
export const SAVED_SCHEDULED_STOCK_STORAGE_KEY = "newsflash.savedScheduledStock.v1";

export const ECONOMY_INDICATORS: EconomyIndicator[] = [
  {
    key: "kospi",
    label: "KOSPI",
    value: "준비 중",
    change: "-",
    note: "코스피 지수",
  },
  {
    key: "kosdaq",
    label: "KOSDAQ",
    value: "준비 중",
    change: "-",
    note: "코스닥 지수",
  },
  {
    key: "usdkrw",
    label: "USD/KRW",
    value: "준비 중",
    change: "-",
    note: "원/달러 환율",
  },
  {
    key: "us-market",
    label: "미국 증시",
    value: "준비 중",
    change: "-",
    note: "DOW · NASDAQ · S&P500",
  },
  {
    key: "rates",
    label: "금리",
    value: "준비 중",
    change: "-",
    note: "미국 기준금리 · 한국 기준금리 · 미국 10년물",
  },
];

export const REGION_KEYWORDS: Record<Exclude<RegionFilter, "전체">, string[]> = {
  서울: [
    "서울",
    "강남",
    "강북",
    "마포",
    "종로",
    "용산",
    "송파",
    "서초",
    "영등포",
    "서울시",
  ],
  경기도: [
    "경기",
    "경기도",
    "수원",
    "성남",
    "고양",
    "용인",
    "부천",
    "안산",
    "안양",
    "화성",
    "평택",
    "의정부",
    "파주",
    "운정",
  ],
  부산: [
    "부산",
    "해운대",
    "서면",
    "남포동",
    "부산항",
    "기장",
    "사하",
    "수영",
    "동래",
    "강서구",
    "대저동",
    "대저1동",
  ],
};

export const DETAIL_VIEW_OPTIONS: DetailView[] = [
  "속보",
  "핵심 이슈",
  "국제 뉴스",
  "경제 뉴스",
  "지역 이슈",
  "보관함",
  "알림 안내판",
];
