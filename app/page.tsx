"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";

const BREAKING_REFRESH_MS = 5 * 60 * 1000;
const COMMUNITY_REFRESH_MS = 5 * 60 * 1000;
const CARTOON_REFRESH_MS = 60 * 60 * 1000;
const INTERNATIONAL_REFRESH_MS = 15 * 60 * 1000;
const MARKET_REFRESH_MS = 10 * 60 * 1000;
const SAVED_ARTICLES_STORAGE_KEY = "newsflash.savedArticles.v1";

type RegionFilter = "전체" | "서울" | "경기도" | "부산";
type DetailView = "속보" | "핵심 이슈" | "국제 뉴스" | "지역 이슈" | "보관함";

type EconomyIndicator = {
  key: string;
  label: string;
  value: string;
  change: string;
  note: string;
  status?: string;
};

type CompactMarketCard = {
  label: string;
  value: string;
  change: string;
  changeTone?: "up" | "down" | "neutral";
};

function MiniTrend({ tone = "neutral" }: { tone?: "up" | "down" | "neutral" }) {
  const strokeColor =
    tone === "down" ? "#2563eb" : tone === "up" ? "#ef4444" : "#94a3b8";
  const fillColor =
    tone === "down" ? "#eff6ff" : tone === "up" ? "#fef2f2" : "#f8fafc";
  const points =
    tone === "down"
      ? "4,12 18,10 32,13 46,18 60,22 74,25"
      : tone === "up"
        ? "4,26 18,22 32,20 46,15 60,11 74,6"
        : "4,17 18,17 32,17 46,17 60,17 74,17";

  return (
    <div className="flex h-[76px] items-center justify-center rounded-xl border border-slate-100 bg-slate-50 px-2">
      <svg viewBox="0 0 78 32" className="h-11 w-full" aria-label="추이 그래프">
        <rect x="0" y="0" width="78" height="32" rx="8" fill={fillColor} />
        <path
          d="M4 26 H74"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="74" cy={tone === "down" ? "25" : tone === "up" ? "6" : "17"} r="3" fill={strokeColor} />
      </svg>
    </div>
  );
}

type MarketItem = {
  key: string;
  label: string;
  symbol: string;
  value: string;
  change: string;
  changeRate: string;
  status: string;
  description: string;
};

interface Article {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  imageUrl?: string;
}

interface Cartoon {
  title: string;
  imageUrl: string;
  link: string;
  source: string;
  pubDate: string;
}

interface CommunityIssue {
  id: string;
  title: string;
  link: string;
  source: "클리앙" | "뽐뿌";
  pubDate: string;
  summary: string;
  detail: string;
  category: string;
}

type SavedArticle = Article & {
  savedAt: string;
};

type IssueGroup = Article & {
  issueKeyword: string;
  relatedCount: number;
  relatedSources: string[];
  relatedArticles: Article[];
};

const ECONOMY_INDICATORS: EconomyIndicator[] = [
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

const REGION_KEYWORDS: Record<Exclude<RegionFilter, "전체">, string[]> = {
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

const ISSUE_GROUP_RULES = [
  {
    label: "환율·외환",
    keywords: ["환율", "원달러", "원·달러", "달러", "외환", "강달러"],
  },
  {
    label: "금리·물가",
    keywords: [
      "금리",
      "기준금리",
      "국채",
      "물가",
      "인플레이션",
      "ECB",
      "연준",
      "Fed",
    ],
  },
  {
    label: "증시·주가",
    keywords: [
      "증시",
      "주가",
      "코스피",
      "코스닥",
      "나스닥",
      "S&P",
      "다우",
      "상승",
      "하락",
    ],
  },
  {
    label: "부동산·전세",
    keywords: ["부동산", "아파트", "전세", "매매", "재건축", "분양"],
  },
  {
    label: "정치·국회",
    keywords: ["대통령", "국회", "정부", "장관", "정당", "선거", "의원"],
  },
  {
    label: "사회·사건",
    keywords: ["사고", "화재", "수사", "경찰", "검찰", "재판", "피해"],
  },
  {
    label: "교통·파업",
    keywords: ["파업", "노조", "교통", "지하철", "버스", "철도", "항공"],
  },
  {
    label: "기후·재난",
    keywords: ["폭염", "기후", "비상", "태풍", "호우", "산불", "재난"],
  },
  {
    label: "의료·교육",
    keywords: ["의료", "병원", "의대", "교육", "학교", "학생"],
  },
  {
    label: "지역 이슈",
    keywords: [
      "서울",
      "경기도",
      "경기",
      "부산",
      "파주",
      "운정",
      "대저1동",
      "대저동",
    ],
  },
  {
    label: "국제·안보",
    keywords: [
      "미국",
      "중국",
      "러시아",
      "우크라이나",
      "이스라엘",
      "이란",
      "전쟁",
      "협상",
    ],
  },
];

const DETAIL_VIEW_OPTIONS: DetailView[] = [
  "속보",
  "핵심 이슈",
  "국제 뉴스",
  "지역 이슈",
  "보관함",
];

export default function Home() {
  const [breakingNews, setBreakingNews] = useState<Article[]>([]);
  const [internationalNews, setInternationalNews] = useState<Article[]>([]);
  const [cartoons, setCartoons] = useState<Cartoon[]>([]);
  const [communityIssues, setCommunityIssues] = useState<CommunityIssue[]>([]);
  const [expandedCommunityId, setExpandedCommunityId] = useState<string | null>(
    null,
  );
  const [selectedRegion, setSelectedRegion] = useState<RegionFilter>("전체");
  const [selectedRegionKeyword, setSelectedRegionKeyword] = useState<
    string | null
  >(null);
  const [selectedDetailView, setSelectedDetailView] =
    useState<DetailView | null>(null);
  const [savedArticles, setSavedArticles] = useState<SavedArticle[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const saved = window.localStorage.getItem(SAVED_ARTICLES_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error("보관 기사 불러오기 에러:", err);
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [communityLoading, setCommunityLoading] = useState(true);
  const [internationalLoading, setInternationalLoading] = useState(true);
  const [marketData, setMarketData] = useState<MarketItem[]>([]);
  const [marketFetchedAt, setMarketFetchedAt] = useState<string | null>(null);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchMarketData() {
    try {
      setMarketError(null);

      const marketResponse = await fetch("/api/market", {
        cache: "no-store",
      });

      if (!marketResponse.ok) {
        throw new Error("경제 지표를 불러오는데 실패했습니다.");
      }

      const marketResponseData = await marketResponse.json();
      setMarketData(
        Array.isArray(marketResponseData.markets)
          ? marketResponseData.markets
          : [],
      );
      setMarketFetchedAt(marketResponseData.fetchedAt || null);
    } catch (err) {
      console.error("경제 지표 로딩 에러:", err);
      setMarketData([]);
      setMarketFetchedAt(null);
      setMarketError("경제 지표 연동 지연");
    }
  }

  async function fetchBreakingNews() {
    const breakingResponse = await fetch("/api/breaking", {
      cache: "no-store",
    });

    if (!breakingResponse.ok) {
      throw new Error("주요 속보를 불러오는데 실패했습니다.");
    }

    const breakingData = await breakingResponse.json();
    setBreakingNews(breakingData.articles || []);
  }

  async function fetchInternationalNews() {
    try {
      setInternationalLoading(true);

      const internationalResponse = await fetch("/api/international", {
        cache: "no-store",
      });

      if (!internationalResponse.ok) {
        return;
      }

      const internationalData = await internationalResponse.json();
      setInternationalNews(internationalData.articles || []);
    } catch (err) {
      console.error("국제 뉴스 로딩 에러:", err);
      setInternationalNews([]);
    } finally {
      setInternationalLoading(false);
    }
  }

  async function fetchCartoons() {
    const cartoonsResponse = await fetch("/api/cartoons", {
      cache: "no-store",
    });

    if (!cartoonsResponse.ok) {
      return;
    }

    const cartoonsData = await cartoonsResponse.json();
    setCartoons(cartoonsData.cartoons || []);
  }

  async function fetchCommunityIssues() {
    try {
      setCommunityLoading(true);

      const communityResponse = await fetch("/api/community", {
        cache: "no-store",
      });

      if (!communityResponse.ok) {
        return;
      }

      const communityData = await communityResponse.json();
      setCommunityIssues(communityData.issues || []);
    } catch (err) {
      console.error("커뮤니티 반응 로딩 에러:", err);
      setCommunityIssues([]);
    } finally {
      setCommunityLoading(false);
    }
  }

  useEffect(() => {
    async function fetchInitialData() {
      try {
        await Promise.all([
          fetchBreakingNews(),
          fetchCartoons(),
          fetchInternationalNews(),
          fetchMarketData(),
        ]);
      } catch (err) {
        console.error("뉴스 로딩 에러:", err);
        setError(
          err instanceof Error
            ? err.message
            : "알 수 없는 오류가 발생했습니다.",
        );
      } finally {
        setLoading(false);
      }
    }

    fetchInitialData();
    fetchCommunityIssues();

    const breakingInterval = setInterval(
      fetchBreakingNews,
      BREAKING_REFRESH_MS,
    );
    const cartoonInterval = setInterval(fetchCartoons, CARTOON_REFRESH_MS);
    const communityInterval = setInterval(
      fetchCommunityIssues,
      COMMUNITY_REFRESH_MS,
    );
    const internationalInterval = setInterval(
      fetchInternationalNews,
      INTERNATIONAL_REFRESH_MS,
    );
    const marketInterval = setInterval(fetchMarketData, MARKET_REFRESH_MS);

    return () => {
      clearInterval(breakingInterval);
      clearInterval(cartoonInterval);
      clearInterval(communityInterval);
      clearInterval(internationalInterval);
      clearInterval(marketInterval);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SAVED_ARTICLES_STORAGE_KEY,
        JSON.stringify(savedArticles),
      );
    } catch (err) {
      console.error("보관 기사 저장 에러:", err);
    }
  }, [savedArticles]);

  const todayText = useMemo(() => {
    return new Date().toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  }, []);

  const economyIndicators = useMemo<EconomyIndicator[]>(() => {
    return ECONOMY_INDICATORS.map((indicator) => {
      const marketItem = marketData.find(
        (item) => item.key === indicator.key && item.status === "ok",
      );

      if (!marketItem) {
        return indicator;
      }

      const changeText = `${marketItem.change} (${marketItem.changeRate})`;

      return {
        ...indicator,
        value: marketItem.value,
        change: changeText,
        status: marketItem.status,
      };
    });
  }, [marketData]);

  const koreanMarketCards = useMemo<CompactMarketCard[]>(() => {
    return ["kospi", "kosdaq"].map((key) => {
      const indicator = economyIndicators.find((item) => item.key === key);

      return {
        label: indicator?.label || key.toUpperCase(),
        value: indicator?.value || "준비 중",
        change: indicator?.change || "-",
        changeTone: (indicator?.change || "").startsWith("-")
          ? "down"
          : (indicator?.change || "") === "-"
            ? "neutral"
            : "up",
      };
    });
  }, [economyIndicators]);

  const usMarketCards = useMemo<CompactMarketCard[]>(() => {
    const marketItem = marketData.find(
      (item) => item.key === "us-market" && item.status === "ok",
    );

    if (!marketItem) {
      return ["DOW", "NASDAQ", "S&P500"].map((label) => ({
        label,
        value: "준비 중",
        change: "-",
        changeTone: "neutral",
      }));
    }

    const valueEntries = [marketItem.value, ...marketItem.change.split(" · ")];
    const changeEntries = marketItem.changeRate.split(" · ");
    const valueMap = new Map<string, string>();
    const changeMap = new Map<string, string>();

    valueEntries.forEach((entry) => {
      const trimmed = entry.trim();
      const firstSpaceIndex = trimmed.indexOf(" ");

      if (firstSpaceIndex > 0) {
        valueMap.set(
          trimmed.slice(0, firstSpaceIndex),
          trimmed.slice(firstSpaceIndex + 1),
        );
      }
    });

    changeEntries.forEach((entry) => {
      const trimmed = entry.trim();
      const firstSpaceIndex = trimmed.indexOf(" ");

      if (firstSpaceIndex > 0) {
        changeMap.set(
          trimmed.slice(0, firstSpaceIndex),
          trimmed.slice(firstSpaceIndex + 1),
        );
      }
    });

    return ["DOW", "NASDAQ", "S&P500"].map((label) => {
      const changeText = changeMap.get(label) || "-";

      return {
        label,
        value: valueMap.get(label) || "준비 중",
        change: changeText,
        changeTone: changeText.startsWith("-")
          ? "down"
          : changeText === "-"
            ? "neutral"
            : "up",
      };
    });
  }, [marketData]);

  const fxRateCard = useMemo<CompactMarketCard>(() => {
    const indicator = economyIndicators.find((item) => item.key === "usdkrw");

    return {
      label: indicator?.label || "USD/KRW",
      value: indicator?.value || "준비 중",
      change: indicator?.change || "-",
      changeTone: (indicator?.change || "").startsWith("-")
        ? "down"
        : (indicator?.change || "") === "-"
          ? "neutral"
          : "up",
    };
  }, [economyIndicators]);

  const rateCards = useMemo<CompactMarketCard[]>(() => {
    const marketItem = marketData.find(
      (item) => item.key === "rates" && item.status === "ok",
    );

    if (!marketItem) {
      return [
        { label: "미국 기준금리", value: "준비 중", change: "-", changeTone: "neutral" },
        { label: "한국 기준금리", value: "준비 중", change: "-", changeTone: "neutral" },
        { label: "미국 10년물", value: "준비 중", change: "-", changeTone: "neutral" },
      ];
    }

    const secondaryEntries = marketItem.change.split(" · ").map((entry) => entry.trim());

    return [
      {
        label: "미국 기준금리",
        value: marketItem.value.replace("미국 ", ""),
        change: "정책금리",
        changeTone: "neutral",
      },
      {
        label: "한국 기준금리",
        value: (secondaryEntries.find((entry) => entry.startsWith("한국 ")) || "한국 준비 중").replace("한국 ", ""),
        change: "정책금리",
        changeTone: "neutral",
      },
      {
        label: "미국 10년물",
        value: (secondaryEntries.find((entry) => entry.startsWith("미국 10년물 ")) || "미국 10년물 준비 중").replace("미국 10년물 ", ""),
        change: marketItem.changeRate || "-",
        changeTone: "up",
      },
    ];
  }, [marketData]);

  const topIssues = useMemo<IssueGroup[]>(() => {
    const articles = [...breakingNews, ...internationalNews];
    const groups = new Map<string, Article[]>();

    articles.forEach((article) => {
      const text = `${article.title} ${article.description}`;
      const matchedRule = ISSUE_GROUP_RULES.find((rule) =>
        rule.keywords.some((keyword) =>
          text.toLowerCase().includes(keyword.toLowerCase()),
        ),
      );

      const normalizedTitleKey = article.title
        .replace(/[\s\[\]\(\)"'“”‘’·,./:!?-]/g, "")
        .toLowerCase()
        .slice(0, 28);

      const groupKey = matchedRule
        ? matchedRule.label
        : `주요 이슈-${normalizedTitleKey}`;
      const currentGroup = groups.get(groupKey) || [];

      if (
        !currentGroup.some(
          (item) => item.link === article.link || item.title === article.title,
        )
      ) {
        currentGroup.push(article);
      }

      groups.set(groupKey, currentGroup);
    });

    return Array.from(groups.entries())
      .map(([issueKeyword, relatedArticles]) => {
        const representativeArticle = relatedArticles[0];

        return {
          ...representativeArticle,
          issueKeyword,
          relatedCount: relatedArticles.length,
          relatedSources: Array.from(
            new Set(relatedArticles.map((article) => article.source)),
          ).slice(0, 4),
          relatedArticles: relatedArticles.slice(0, 4),
        };
      })
      .sort((a, b) => b.relatedCount - a.relatedCount)
      .slice(0, 10);
  }, [breakingNews, internationalNews]);

  const economicNews = useMemo(() => {
    const economyKeywords = [
      "경제",
      "금리",
      "환율",
      "증시",
      "주가",
      "코스피",
      "코스닥",
      "물가",
      "부동산",
    ];

    return [...breakingNews, ...internationalNews]
      .filter((article) => {
        const text = `${article.title} ${article.description}`;
        return economyKeywords.some((keyword) => text.includes(keyword));
      })
      .slice(0, 6);
  }, [breakingNews, internationalNews]);

  const regionArticles = useMemo(() => {
    const matchesKeyword = (article: Article, keyword: string) => {
      const text = `${article.title} ${article.description}`;
      return text.includes(keyword);
    };

    if (selectedRegionKeyword) {
      return breakingNews.filter((article) =>
        matchesKeyword(article, selectedRegionKeyword),
      );
    }

    if (selectedRegion === "전체") {
      return breakingNews.filter((article) => {
        return Object.values(REGION_KEYWORDS).some((keywords) =>
          keywords.some((keyword) => matchesKeyword(article, keyword)),
        );
      });
    }

    const keywords = REGION_KEYWORDS[selectedRegion];

    return breakingNews.filter((article) => {
      return keywords.some((keyword) => matchesKeyword(article, keyword));
    });
  }, [breakingNews, selectedRegion, selectedRegionKeyword]);

  const activeRegionKeywords = useMemo(() => {
    if (selectedRegion === "전체") {
      return Array.from(new Set(Object.values(REGION_KEYWORDS).flat()));
    }

    return REGION_KEYWORDS[selectedRegion];
  }, [selectedRegion]);

  const getMatchedRegionKeywords = (article: Article) => {
    const text = `${article.title} ${article.description}`;

    return activeRegionKeywords
      .filter((keyword) => text.includes(keyword))
      .slice(0, 5);
  };

  const clienDealIssues = useMemo(() => {
    return communityIssues
      .filter(
        (issue) => issue.source === "클리앙" && issue.category.includes("알뜰"),
      )
      .slice(0, 5);
  }, [communityIssues]);

  const clienForumIssues = useMemo(() => {
    return communityIssues
      .filter(
        (issue) =>
          issue.source === "클리앙" &&
          (issue.category.includes("모두") ||
            issue.category.includes("공원") ||
            issue.category.includes("광장")),
      )
      .slice(0, 5);
  }, [communityIssues]);

  const ppomppuFreeIssues = useMemo(() => {
    return communityIssues
      .filter(
        (issue) => issue.source === "뽐뿌" && issue.category.includes("자유"),
      )
      .slice(0, 5);
  }, [communityIssues]);

  const getSourceEmoji = (source: string) => {
    switch (source) {
      case "SBS":
      case "SBS 주요뉴스":
        return "📺";
      case "MBC":
        return "📡";
      case "연합뉴스":
      case "연합뉴스TV":
        return "📰";
      case "JTBC":
        return "📡";
      case "경향신문":
        return "📰";
      case "한겨레":
        return "📰";
      case "BBC News":
      case "New York Times":
      case "Al Jazeera":
      case "The Guardian":
        return "🌍";
      case "클리앙":
        return "💬";
      case "뽐뿌":
        return "🔥";
      default:
        return "📄";
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case "SBS":
      case "SBS 주요뉴스":
        return "text-blue-600";
      case "MBC":
        return "text-purple-600";
      case "연합뉴스":
      case "연합뉴스TV":
        return "text-green-600";
      case "JTBC":
        return "text-red-600";
      case "경향신문":
        return "text-purple-600";
      case "한겨레":
        return "text-indigo-600";
      case "BBC News":
      case "New York Times":
      case "Al Jazeera":
      case "The Guardian":
        return "text-sky-700";
      case "클리앙":
        return "text-orange-600";
      case "뽐뿌":
        return "text-pink-600";
      default:
        return "text-gray-600";
    }
  };

  const getRelativeTime = (dateString: string): string => {
    const now = new Date();
    const past = new Date(dateString);

    if (Number.isNaN(past.getTime())) {
      return "시간 정보 없음";
    }

    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return "방금 전";
    }

    if (diffMins < 60) {
      return `${diffMins}분 전`;
    }

    if (diffHours < 24) {
      return `${diffHours}시간 전`;
    }

    if (diffDays < 7) {
      return `${diffDays}일 전`;
    }

    return past.toLocaleDateString("ko-KR");
  };

  const getFormattedTime = (dateString: string) => {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "시간 정보 없음";
    }

    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isKoreanText = (text: string) => {
    return /[가-힣]/.test(text);
  };

  const needsTranslation = (article: Article) => {
    const text = `${article.title} ${article.description}`;
    return !isKoreanText(text);
  };

  const toggleCommunityDetail = (issueId: string) => {
    setExpandedCommunityId((currentId) =>
      currentId === issueId ? null : issueId,
    );
  };

  const renderArticleMeta = (article: Article) => {
    return (
      <div className="flex items-center gap-2 mb-2">
        <span className={`font-bold text-sm ${getSourceColor(article.source)}`}>
          {getSourceEmoji(article.source)} {article.source}
        </span>
        <span className="text-gray-400 text-sm">
          {getRelativeTime(article.pubDate)}
        </span>
      </div>
    );
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isArticleSaved = (article: Article) => {
    return savedArticles.some(
      (savedArticle) => savedArticle.link === article.link,
    );
  };

  const toggleSaveArticle = (article: Article) => {
    setSavedArticles((currentArticles) => {
      const alreadySaved = currentArticles.some(
        (savedArticle) => savedArticle.link === article.link,
      );

      if (alreadySaved) {
        return currentArticles.filter(
          (savedArticle) => savedArticle.link !== article.link,
        );
      }

      return [
        {
          ...article,
          savedAt: new Date().toISOString(),
        },
        ...currentArticles,
      ].slice(0, 100);
    });
  };

  const renderSaveButton = (article: Article) => {
    const saved = isArticleSaved(article);

    return (
      <button
        type="button"
        onClick={() => toggleSaveArticle(article)}
        className={`ml-2 inline-flex flex-shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${
          saved
            ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        }`}
        title={saved ? "보관함에서 제거합니다." : "보관함에 저장합니다."}
      >
        {saved ? "보관됨" : "보관"}
      </button>
    );
  };

  const renderLinkedArticleTitle = (
    article: Article,
    className = "font-bold text-gray-900 line-clamp-2",
  ) => {
    return (
      <div className="flex items-start gap-2">
        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          className={`${className} hover:text-blue-600`}
          title="제목을 누르면 원문으로 이동합니다."
        >
          {article.title}
        </a>
        {renderSaveButton(article)}
      </div>
    );
  };

  const getArticleSearchUrl = (article: Article) => {
    return `https://www.google.com/search?q=${encodeURIComponent(article.title)}`;
  };

  const renderIssueGroupBadge = (issue: IssueGroup) => {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
          이슈 묶음
        </span>
        <span className="text-sm text-gray-600">
          {issue.issueKeyword}
          {issue.relatedCount > 1 ? ` · 관련 기사 ${issue.relatedCount}건` : ""}
        </span>
      </div>
    );
  };

  const renderNewsList = (
    articles: Article[],
    emptyMessage: string,
    limit = 6,
  ) => {
    if (articles.length === 0) {
      return (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl shadow-md overflow-hidden">
        {articles.slice(0, limit).map((article, index) => (
          <article
            key={`${article.source}-${article.link}-${index}`}
            className="border-b border-gray-100 p-4 last:border-b-0"
          >
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-20 h-20 md:w-24 md:h-24 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                {article.imageUrl ? (
                  <img
                    src={article.imageUrl}
                    alt={article.title}
                    className="w-full h-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="text-3xl md:text-4xl">
                    {getSourceEmoji(article.source)}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                {renderArticleMeta(article)}

                {renderLinkedArticleTitle(
                  article,
                  "text-base font-bold text-gray-900 mb-2 line-clamp-2 leading-snug",
                )}

                <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                  {article.description}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    );
  };

  const renderCommunityGroup = (
    title: string,
    issues: CommunityIssue[],
    emptyMessage: string,
  ) => {
    return (
      <div className="bg-white rounded-xl shadow-md p-5">
        <h3 className="font-bold text-gray-900 mb-4">{title}</h3>

        {issues.length > 0 ? (
          <div className="space-y-4">
            {issues.map((issue) => {
              const isExpanded = expandedCommunityId === issue.id;

              return (
                <article
                  key={issue.id}
                  className="border-b border-gray-100 pb-4 last:border-b-0"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-xs font-semibold ${getSourceColor(issue.source)}`}
                    >
                      {getSourceEmoji(issue.source)} {issue.source}
                    </span>
                    <span className="text-gray-300 text-xs">·</span>
                    <span className="text-gray-500 text-xs">
                      {issue.category}
                    </span>
                    <span className="text-gray-300 text-xs">·</span>
                    <span className="text-gray-400 text-xs">
                      {getFormattedTime(issue.pubDate)}
                    </span>
                  </div>

                  <a
                    href={issue.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block font-semibold text-gray-800 line-clamp-2 mb-2 hover:text-blue-600"
                    title="제목을 누르면 원문으로 이동합니다."
                  >
                    {issue.title}
                  </a>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {issue.summary}
                  </p>

                  {isExpanded && (
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mt-3">
                      <p className="text-xs font-semibold text-amber-700 mb-1">
                        세부내용
                      </p>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {issue.detail}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-3">
                    <button
                      type="button"
                      onClick={() => toggleCommunityDetail(issue.id)}
                      className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                    >
                      {isExpanded ? "접기" : "내용 확인"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">{emptyMessage}</p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">뉴스를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-xl mb-4">⚠️ {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-3xl">📰</span>
                <h1 className="text-3xl font-bold text-gray-800">NewsFlash</h1>
              </div>
              <p className="text-gray-600 mt-2">
                뉴스·경제·커뮤니티·지역 이슈 확인
              </p>
            </div>

            <div className="text-sm text-gray-500 md:text-right">
              <p>{todayText}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-2 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                새로고침
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <section className="mb-8">
          <div className="bg-white rounded-2xl shadow-md p-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              {[
                "경제 현황판",
                "TOP 3",
                "주요 속보",
                "경제 뉴스",
                "커뮤니티 반응",
                "시사만평",
              ].map((label) => (
                <div
                  key={label}
                  className="flex items-center justify-center rounded-xl bg-gray-50 px-3 py-3 text-center text-sm font-bold text-gray-800"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="bg-white rounded-2xl shadow-md p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🗂️</span>
                  <h2 className="text-3xl font-bold text-gray-800">전체보기</h2>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  속보·핵심 이슈·국제 뉴스·지역 이슈·보관함을 선택해서
                  조회합니다.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {DETAIL_VIEW_OPTIONS.map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setSelectedDetailView(view)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      selectedDetailView === view
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {view}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {selectedDetailView && (
          <section className="mb-12">
            {selectedDetailView === "속보" && (
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-3xl">🚨</span>
                  <div>
                    <h2 className="text-3xl font-bold text-gray-800">
                      속보 전체보기
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      국내·국제·신문사 등 주요 속보를 모아 확인합니다.
                    </p>
                  </div>
                </div>
                {renderNewsList(breakingNews, "주요 속보를 불러오는 중...", 20)}
              </div>
            )}

            {selectedDetailView === "핵심 이슈" && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">⭐</span>
                    <div>
                      <h2 className="text-3xl font-bold text-gray-800">
                        오늘의 핵심 이슈 TOP 10
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        키워드 기반으로 유사 이슈를 묶어 관련 기사 수를 함께
                        표시합니다.
                      </p>
                    </div>
                  </div>
                </div>
                {topIssues.length > 0 ? (
                  <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                    {topIssues.map((issue, index) => (
                      <article
                        key={`${issue.link}-${index}`}
                        className="border-b border-gray-100 p-4 last:border-b-0"
                      >
                        <div className="flex gap-4">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            {renderArticleMeta(issue)}
                            {renderLinkedArticleTitle(issue)}
                            {renderIssueGroupBadge(issue)}
                            {issue.relatedSources.length > 1 && (
                              <p className="text-xs text-gray-400 mt-1">
                                관련 출처: {issue.relatedSources.join(" · ")}
                              </p>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-md p-8 text-center">
                    <p className="text-gray-500">
                      오늘의 핵심 이슈를 불러오는 중...
                    </p>
                  </div>
                )}
              </div>
            )}

            {selectedDetailView === "국제 뉴스" && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🌍</span>
                    <div>
                      <h2 className="text-3xl font-bold text-gray-800">
                        국제 뉴스
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        영문 외신은 필요 시 번역하고, 원문이 열리지 않으면 제목
                        검색으로 확인합니다.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/international"
                    className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                  >
                    더보기 →
                  </Link>
                </div>

                {internationalLoading ? (
                  <div className="bg-white rounded-xl shadow-md p-8 text-center">
                    <p className="text-gray-500">국제 뉴스를 불러오는 중...</p>
                  </div>
                ) : internationalNews.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {internationalNews.slice(0, 8).map((article, index) => (
                      <article
                        key={`${article.source}-${article.link}-${index}`}
                        className="bg-white rounded-xl shadow-md p-5"
                      >
                        {renderArticleMeta(article)}
                        {renderLinkedArticleTitle(
                          article,
                          "font-bold text-gray-900 line-clamp-2 mb-2",
                        )}
                        <p className="text-sm text-gray-600 line-clamp-3">
                          {article.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-4">
                          {needsTranslation(article) && (
                            <>
                              <button
                                type="button"
                                className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
                                title="번역 API는 다음 단계에서 연결합니다."
                              >
                                번역하기
                              </button>
                              <a
                                href={getArticleSearchUrl(article)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                                title="원문 사이트가 차단될 때 기사 제목으로 검색합니다."
                              >
                                제목 검색
                              </a>
                            </>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-md p-8 text-center">
                    <p className="text-gray-500">
                      국제 뉴스를 불러오지 못했습니다.
                    </p>
                  </div>
                )}
              </div>
            )}

            {selectedDetailView === "지역 이슈" && (
              <div>
                <div className="flex flex-col gap-4 mb-5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">📍</span>
                      <h2 className="text-3xl font-bold text-gray-800">
                        지역 이슈
                      </h2>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      기사 제목과 요약의 지역 키워드를 기준으로 분류합니다.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(["전체", "서울", "경기도", "부산"] as RegionFilter[]).map(
                      (region) => (
                        <button
                          key={region}
                          type="button"
                          onClick={() => {
                            setSelectedRegion(region);
                            setSelectedRegionKeyword(null);
                          }}
                          className={`rounded-full px-4 py-2 text-sm font-semibold ${
                            selectedRegion === region
                              ? "bg-blue-600 text-white"
                              : "bg-white text-gray-700 shadow-sm hover:bg-gray-50"
                          }`}
                        >
                          {region}
                        </button>
                      ),
                    )}
                  </div>
                </div>
                <div className="mb-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-gray-800">
                      현재 필터:
                    </span>
                    <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">
                      {selectedRegion}
                    </span>
                    <span className="text-sm font-bold text-gray-800">
                      선택 키워드:
                    </span>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
                      {selectedRegionKeyword || "전체 키워드"}
                    </span>
                  </div>
                  <p className="mb-3 text-xs text-gray-500">
                    아래 판별 키워드를 누르면 해당 키워드가 포함된 기사만
                    조회합니다.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRegionKeyword(null)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        selectedRegionKeyword === null
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      전체 키워드
                    </button>
                    {activeRegionKeywords.map((keyword) => (
                      <button
                        key={`${selectedRegion}-${keyword}`}
                        type="button"
                        onClick={() => setSelectedRegionKeyword(keyword)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          selectedRegionKeyword === keyword
                            ? "bg-blue-600 text-white"
                            : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                        }`}
                      >
                        {keyword}
                      </button>
                    ))}
                  </div>
                </div>

                {regionArticles.length > 0 ? (
                  <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                    {regionArticles.slice(0, 10).map((article, index) => {
                      const matchedKeywords = getMatchedRegionKeywords(article);

                      return (
                        <article
                          key={`${article.source}-${article.link}-region-${index}`}
                          className="border-b border-gray-100 p-4 last:border-b-0"
                        >
                          <div className="flex gap-4">
                            <div className="flex-shrink-0 w-20 h-20 md:w-24 md:h-24 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                              {article.imageUrl ? (
                                <img
                                  src={article.imageUrl}
                                  alt={article.title}
                                  className="w-full h-full object-cover"
                                  onError={(event) => {
                                    event.currentTarget.style.display = "none";
                                  }}
                                />
                              ) : (
                                <div className="text-3xl md:text-4xl">
                                  {getSourceEmoji(article.source)}
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              {renderArticleMeta(article)}
                              {renderLinkedArticleTitle(
                                article,
                                "text-base font-bold text-gray-900 mb-2 line-clamp-2 leading-snug",
                              )}

                              {matchedKeywords.length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-2">
                                  <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
                                    지역 키워드
                                  </span>
                                  {matchedKeywords.map((keyword) => (
                                    <span
                                      key={`${article.link}-${keyword}`}
                                      className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700"
                                    >
                                      {keyword}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                                {article.description}
                              </p>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-md p-8 text-center">
                    <p className="text-gray-500">
                      선택한 지역 이슈가 아직 없습니다.
                    </p>
                    <p className="mt-2 text-sm text-gray-400">
                      현재 선택한 지역 또는 세부 키워드와 일치하는 기사 제목
                      또는 요약이 없을 때 표시됩니다.
                    </p>
                  </div>
                )}
              </div>
            )}

            {selectedDetailView === "보관함" && (
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-3xl">📌</span>
                  <div>
                    <h2 className="text-3xl font-bold text-gray-800">
                      주요 기사 보관함
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      보관한 기사를 다시 확인하고 필요 없는 기사는 해제할 수
                      있습니다.
                    </p>
                  </div>
                </div>

                {savedArticles.length > 0 ? (
                  <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                    {savedArticles.map((article, index) => (
                      <article
                        key={`${article.link}-saved-${index}`}
                        className="border-b border-gray-100 p-4 last:border-b-0"
                      >
                        <div className="flex gap-4">
                          <div className="flex-shrink-0 w-20 h-20 md:w-24 md:h-24 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                            {article.imageUrl ? (
                              <img
                                src={article.imageUrl}
                                alt={article.title}
                                className="w-full h-full object-cover"
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="text-3xl md:text-4xl">
                                {getSourceEmoji(article.source)}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            {renderArticleMeta(article)}
                            {renderLinkedArticleTitle(
                              article,
                              "text-base font-bold text-gray-900 mb-2 line-clamp-2 leading-snug",
                            )}
                            <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                              {article.description}
                            </p>
                            <p className="mt-2 text-xs text-gray-400">
                              보관일:{" "}
                              {new Date(article.savedAt).toLocaleString(
                                "ko-KR",
                              )}
                            </p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-md p-8 text-center">
                    <p className="text-gray-600 font-semibold">
                      아직 보관한 기사가 없습니다.
                    </p>
                    <p className="mt-2 text-sm text-gray-400">
                      기사 제목 옆의 보관 버튼을 누르면 이곳에 저장됩니다.
                    </p>
                  </div>
                )}

                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
                  현재 보관함은 브라우저 저장 방식입니다. 같은 PC와
                  브라우저에서는 새로고침 후에도 유지되며, 추후 Supabase와
                  Notion 내보내기로 확장할 수 있습니다.
                </div>
              </div>
            )}
          </section>
        )}

        <section className="mb-12">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-3xl">📊</span>
                <h2 className="text-3xl font-bold text-gray-800">
                  경제 현황판
                </h2>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                경제 지표는 제공 시점에 따라 실제 수치와 차이가 있을 수
                있습니다.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {marketFetchedAt
                  ? `업데이트: ${new Date(marketFetchedAt).toLocaleString("ko-KR")}`
                  : marketError || "KOSPI · KOSDAQ · USD/KRW 우선 연동 준비 중"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-slate-200/70 bg-white/60 p-5 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-gray-800">🇰🇷 한국 증시</h3>
              <div className="space-y-3">
                {koreanMarketCards.map((item) => (
                  <article
                    key={item.label}
                    className="grid grid-cols-[1fr_96px] gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-md"
                  >
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{item.label}</p>
                      <p className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">{item.value}</p>
                      <p className={`mt-1 text-sm ${
                        item.changeTone === "down"
                          ? "text-blue-500"
                          : item.changeTone === "up"
                            ? "text-red-500"
                            : "text-gray-500"
                      }`}>
                        {item.change}
                      </p>
                    </div>
                    <MiniTrend tone={item.changeTone} />
                  </article>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/70 bg-white/60 p-5 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-gray-800">🇺🇸 미국 증시</h3>
              <div className="space-y-3">
                {usMarketCards.map((item) => (
                  <article
                    key={item.label}
                    className="grid grid-cols-[1fr_96px] gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-md"
                  >
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{item.label}</p>
                      <p className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">{item.value}</p>
                      <p className={`mt-1 text-sm ${
                        item.changeTone === "down"
                          ? "text-blue-500"
                          : item.changeTone === "up"
                            ? "text-red-500"
                            : "text-gray-500"
                      }`}>
                        {item.change}
                      </p>
                    </div>
                    <MiniTrend tone={item.changeTone} />
                  </article>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/70 bg-white/60 p-5 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-gray-800">💱 환율 / 금리</h3>
              <div className="space-y-3">
                <article className="grid grid-cols-[1fr_96px] gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-md">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{fxRateCard.label}</p>
                    <p className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">{fxRateCard.value}</p>
                    <p className={`mt-1 text-sm ${
                      fxRateCard.changeTone === "down"
                        ? "text-blue-500"
                        : fxRateCard.changeTone === "up"
                          ? "text-red-500"
                          : "text-gray-500"
                    }`}>
                      {fxRateCard.change}
                    </p>
                  </div>
                  <MiniTrend tone={fxRateCard.changeTone} />
                </article>

                {rateCards.map((item) => (
                  <article
                    key={item.label}
                    className="grid grid-cols-[1fr_96px] gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-md"
                  >
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{item.label}</p>
                      <p className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">{item.value}</p>
                      <p className="mt-1 text-sm text-gray-500">{item.change}</p>
                    </div>
                    <MiniTrend tone={item.changeTone} />
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⭐</span>
              <div>
                <h2 className="text-3xl font-bold text-gray-800">
                  오늘의 핵심 이슈 TOP 3
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  나머지 핵심 이슈는 상단 전체보기에서 확인합니다.
                </p>
              </div>
            </div>
          </div>

          {topIssues.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-md overflow-hidden">
              {topIssues.slice(0, 3).map((issue, index) => (
                <article
                  key={`${issue.link}-top3-${index}`}
                  className="border-b border-gray-100 p-4 last:border-b-0"
                >
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      {renderArticleMeta(issue)}
                      {renderLinkedArticleTitle(issue)}
                      {renderIssueGroupBadge(issue)}
                      {issue.relatedSources.length > 1 && (
                        <p className="text-xs text-gray-400 mt-1">
                          관련 출처: {issue.relatedSources.join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <p className="text-gray-500">오늘의 핵심 이슈를 불러오는 중...</p>
            </div>
          )}
        </section>

        <section className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🚨</span>
              <div>
                <h2 className="text-3xl font-bold text-gray-800">주요 속보</h2>
                <p className="text-sm text-gray-500 mt-1">
                  5분마다 자동 갱신됩니다.
                </p>
              </div>
            </div>
            <Link
              href="/breaking"
              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
            >
              더보기 →
            </Link>
          </div>

          {renderNewsList(breakingNews, "주요 속보를 불러오는 중...", 8)}
        </section>

        <section className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <span className="text-3xl">💰</span>
              <div>
                <h2 className="text-3xl font-bold text-gray-800">경제 뉴스</h2>
                <p className="text-sm text-gray-500 mt-1">
                  국내 경제·미국 증시·금리 관련 뉴스를 우선 표시합니다.
                </p>
              </div>
            </div>
          </div>

          {renderNewsList(
            economicNews,
            "경제 뉴스는 다음 단계에서 전용 API와 함께 보강 예정입니다.",
            6,
          )}
        </section>

        <section className="mb-12">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">💬</span>
                <h2 className="text-3xl font-bold text-gray-800">
                  커뮤니티 반응
                </h2>
              </div>
              <p className="text-sm text-gray-600">
                커뮤니티 게시글은 이용자 의견이며, 사실 확인이 필요합니다.
              </p>
            </div>

            <Link
              href="/community"
              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 whitespace-nowrap pt-2"
            >
              더보기 →
            </Link>
          </div>

          {communityLoading ? (
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <p className="text-gray-500">커뮤니티 반응을 불러오는 중...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {renderCommunityGroup(
                "클리앙 알뜰구매 5개",
                clienDealIssues,
                "클리앙 알뜰구매 수집은 커뮤니티 API 확장 단계에서 연결 예정입니다.",
              )}
              {renderCommunityGroup(
                "클리앙 모두의 광장 5개",
                clienForumIssues,
                "클리앙 모두의 광장 게시글을 불러오지 못했습니다.",
              )}
              {renderCommunityGroup(
                "뽐뿌 자유게시판 5개",
                ppomppuFreeIssues,
                "뽐뿌 자유게시판 게시글을 불러오지 못했습니다.",
              )}
            </div>
          )}
        </section>

        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎨</span>
              <div>
                <h2 className="text-3xl font-bold text-gray-800">
                  오늘의 시사만평
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  1시간마다 자동 갱신됩니다.
                </p>
              </div>
            </div>
            <Link
              href="/cartoons"
              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
            >
              더보기 →
            </Link>
          </div>

          {cartoons.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {cartoons.slice(0, 3).map((cartoon, index) => (
                <a
                  key={index}
                  href={cartoon.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group"
                >
                  <div className="relative w-full h-64 overflow-hidden bg-gray-100">
                    <Image
                      src={cartoon.imageUrl}
                      alt={cartoon.title}
                      fill
                      className="object-contain group-hover:scale-105 transition-transform duration-300"
                      unoptimized
                    />
                  </div>

                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-xs font-semibold ${getSourceColor(cartoon.source)}`}
                      >
                        {getSourceEmoji(cartoon.source)} {cartoon.source}
                      </span>
                      <span className="text-gray-400 text-xs">
                        {new Date(cartoon.pubDate).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-800 group-hover:text-blue-600 line-clamp-2">
                      {cartoon.title}
                    </h3>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <p className="text-gray-500">오늘의 시사만평을 불러오는 중...</p>
            </div>
          )}
        </section>

        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 rounded-full bg-gray-900 px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-blue-700"
          title="화면 맨 위로 이동"
        >
          맨 위로 ↑
        </button>
      </main>
    </div>
  );
}