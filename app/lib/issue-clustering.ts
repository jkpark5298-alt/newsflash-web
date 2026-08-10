import type { Article } from "./home-types";

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

const POLITICAL_DETAIL_RULES = [
  {
    label: "외교·정상회담",
    keywords: ["정상회담", "시진핑", "트럼프", "미중", "미국", "중국", "외교", "관세", "무역", "회담", "협상"],
  },
  {
    label: "정치·선거",
    keywords: ["대선", "선거", "출마", "후보", "경선", "공천", "표심", "여론조사", "캠프", "선관위"],
  },
  {
    label: "정치·정당",
    keywords: ["민주당", "국민의힘", "국힘", "정당", "당대표", "비대위", "최고위원", "당원", "원내대표"],
  },
  {
    label: "정치·국회",
    keywords: ["국회", "국회의장", "의장", "국회의원", "의원", "상임위", "청문회", "법안", "본회의", "표결"],
  },
  {
    label: "대통령·정부",
    keywords: ["대통령", "대통령실", "정부", "장관", "국무총리", "총리", "국무회의", "행정부", "내각"],
  },
  {
    label: "정치·수사재판",
    keywords: ["특검", "검찰", "공수처", "수사", "재판", "구속", "기소", "압수수색", "탄핵", "영장"],
  },
];

const POLITICAL_DETAIL_WEIGHTS: Record<string, number> = {
  "외교·정상회담": 10,
  "정치·선거": 9,
  "정치·정당": 8,
  "정치·국회": 8,
  "대통령·정부": 8,
  "정치·수사재판": 7,
};

export function isPoliticalCategory(category: string) {
  return (
    category.startsWith("정치") ||
    category === "대통령·정부" ||
    category === "외교·정상회담"
  );
}

const ISSUE_STOP_WORDS = new Set([
  "속보",
  "단독",
  "종합",
  "영상",
  "사진",
  "오늘",
  "내일",
  "이번",
  "관련",
  "기자",
  "논란",
  "가능성",
  "확인",
  "뉴스",
  "발표",
  "정부",
  "대한",
  "우리",
  "한국",
  "국내",
  "현장",
  "최신",
  "주요",
  "전체",
  "첫",
  "또",
  "더",
  "왜",
  "새",
]);

const ISSUE_CATEGORY_WEIGHTS: Record<string, number> = {
  "환율·외환": 9,
  "금리·물가": 9,
  "증시·주가": 8,
  "국제·안보": 8,
  "외교·정상회담": 9,
  "정치·국회": 7,
  "정치·선거": 9,
  "정치·정당": 8,
  "대통령·정부": 8,
  "정치·수사재판": 7,
  "사회·사건": 7,
  "지역 이슈": 7,
  "기후·재난": 7,
  "교통·파업": 6,
  "부동산·전세": 6,
  "의료·교육": 5,
};

const POLITICAL_GENERIC_TOKENS = new Set([
  "정치",
  "국회",
  "정부",
  "대통령",
  "대통령실",
  "정당",
  "의원",
  "후보",
  "대표",
  "장관",
  "관련",
  "기사",
  "뉴스",
  "주요",
  "국내",
  "한국",
]);

const GENERAL_GENERIC_TOKENS = new Set([
  "관련",
  "기사",
  "뉴스",
  "주요",
  "오늘",
  "이번",
  "한국",
  "국내",
  "전체",
]);

export function getSpecificIssueTokens(tokens: string[], category: string) {
  const blockList = isPoliticalCategory(category)
    ? POLITICAL_GENERIC_TOKENS
    : GENERAL_GENERIC_TOKENS;

  return tokens
    .filter((token) => token.length >= 2 && !blockList.has(token))
    .slice(0, 6);
}

export function buildIssueKeyword(category: string, tokens: string[]) {
  const visibleTokens = getSpecificIssueTokens(tokens, category).slice(0, 3);

  if (visibleTokens.length === 0) {
    return category;
  }

  return `${category} · ${visibleTokens.join(" · ")}`;
}

export function normalizeIssueText(text: string) {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/[\[\]【】()（）{}"'“”‘’·,./:!?\-_=+|\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function extractIssueTokens(article: Article) {
  const text = normalizeIssueText(`${article.title} ${article.description}`);
  const tokens = text.match(/[가-힣a-zA-Z0-9%]+/g) || [];
  const tokenCounts = new Map<string, number>();

  tokens.forEach((token) => {
    const cleanToken = token.trim();

    if (cleanToken.length < 2 || ISSUE_STOP_WORDS.has(cleanToken)) {
      return;
    }

    tokenCounts.set(cleanToken, (tokenCounts.get(cleanToken) || 0) + 1);
  });

  ISSUE_GROUP_RULES.forEach((rule) => {
    rule.keywords.forEach((keyword) => {
      if (text.includes(keyword.toLowerCase())) {
        tokenCounts.set(keyword, (tokenCounts.get(keyword) || 0) + 3);
      }
    });
  });

  POLITICAL_DETAIL_RULES.forEach((rule) => {
    rule.keywords.forEach((keyword) => {
      if (text.includes(keyword.toLowerCase())) {
        tokenCounts.set(keyword, (tokenCounts.get(keyword) || 0) + 4);
      }
    });
  });

  return Array.from(tokenCounts.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([token]) => token)
    .slice(0, 8);
}

export function getIssueCategory(article: Article) {
  const text = `${article.title} ${article.description}`.toLowerCase();

  const politicalDetailMatches = POLITICAL_DETAIL_RULES.map((rule) => ({
    label: rule.label,
    count: rule.keywords.filter((keyword) =>
      text.includes(keyword.toLowerCase()),
    ).length,
  }))
    .filter((match) => match.count > 0)
    .sort((a, b) => {
      const weightDiff =
        (POLITICAL_DETAIL_WEIGHTS[b.label] || 0) -
        (POLITICAL_DETAIL_WEIGHTS[a.label] || 0);

      if (weightDiff !== 0) {
        return weightDiff;
      }

      return b.count - a.count;
    });

  if (politicalDetailMatches.length > 0) {
    return politicalDetailMatches[0].label;
  }

  const matchedRule = ISSUE_GROUP_RULES.find((rule) =>
    rule.keywords.some((keyword) => text.includes(keyword.toLowerCase())),
  );

  return matchedRule?.label || "주요 이슈";
}

export function countTokenOverlap(a: string[], b: string[]) {
  const bSet = new Set(b);
  return a.filter((token) => bSet.has(token)).length;
}

function getRecencyScore(article: Article) {
  const publishedTime = new Date(article.pubDate).getTime();

  if (Number.isNaN(publishedTime)) {
    return 0;
  }

  const diffHours = (Date.now() - publishedTime) / 3600000;

  if (diffHours <= 1) {
    return 8;
  }

  if (diffHours <= 3) {
    return 6;
  }

  if (diffHours <= 6) {
    return 4;
  }

  if (diffHours <= 12) {
    return 2;
  }

  return 0;
}

export function getIssueScore(
  relatedArticles: Article[],
  relatedSources: string[],
  category: string,
) {
  const latestRecencyScore = Math.max(...relatedArticles.map(getRecencyScore), 0);
  const categoryWeight = ISSUE_CATEGORY_WEIGHTS[category] || 4;

  return (
    relatedArticles.length * 10 +
    relatedSources.length * 5 +
    latestRecencyScore +
    categoryWeight
  );
}

export function pickRepresentativeArticle(articles: Article[]) {
  return [...articles].sort((a, b) => {
    const aDescriptionScore = a.description ? 2 : 0;
    const bDescriptionScore = b.description ? 2 : 0;
    const aTitleScore = Math.min(a.title.length, 80) / 20;
    const bTitleScore = Math.min(b.title.length, 80) / 20;
    const aTime = new Date(a.pubDate).getTime() || 0;
    const bTime = new Date(b.pubDate).getTime() || 0;

    return (
      bDescriptionScore + bTitleScore + getRecencyScore(b) + bTime / 1000000000000 -
      (aDescriptionScore + aTitleScore + getRecencyScore(a) + aTime / 1000000000000)
    );
  })[0];
}
