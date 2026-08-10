export interface ScheduledNewsAlertItem {
  id: string;
  timeTitle: string;
  articles: Article[];
  timestamp: string;
}

export interface ScheduledStockAlertItem {
  id: string;
  timeTitle: string;
  content: string;
  timestamp: string;
}

export type RegionFilter = "전체" | "서울" | "경기도" | "부산";
export type DetailView =
  | "속보"
  | "핵심 이슈"
  | "국제 뉴스"
  | "경제 뉴스"
  | "지역 이슈"
  | "보관함"
  | "알림 안내판";

export type EconomyIndicator = {
  key: string;
  label: string;
  value: string;
  change: string;
  note: string;
  status?: string;
};

export type CompactMarketCard = {
  label: string;
  value: string;
  change: string;
  changeTone?: "up" | "down" | "neutral";
};

export type MarketItem = {
  key: string;
  label: string;
  symbol: string;
  value: string;
  change: string;
  changeRate: string;
  status: string;
  description: string;
};

export interface Article {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  imageUrl?: string;
}

export interface Cartoon {
  title: string;
  imageUrl: string;
  link: string;
  source: string;
  pubDate: string;
}

export interface CommunityIssue {
  id: string;
  title: string;
  link: string;
  source: "클리앙" | "뽐뿌" | "무료앱";
  pubDate: string;
  summary: string;
  detail: string;
  category: string;
}

export type SavedArticle = Article & {
  savedAt: string;
};

export type TranslationResult = {
  titleKo: string;
  summaryKo: string;
  notice?: string;
};

export type TranslationState = {
  loading?: boolean;
  error?: string;
  result?: TranslationResult;
};

export type IssueGroup = Article & {
  issueKeyword: string;
  relatedCount: number;
  relatedSources: string[];
  relatedArticles: Article[];
  score?: number;
};

export type PushSettings = {
  alertEnabled: boolean;
  scheduledAlertEnabled: boolean;
  alertKeywords: string[];
};
