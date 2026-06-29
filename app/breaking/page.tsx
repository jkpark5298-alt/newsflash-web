'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';

const BREAKING_REFRESH_MS = 5 * 60 * 1000;
const ALERT_KEYWORDS_STORAGE_KEY = 'newsflash.alertKeywords.v1';
const ALERT_ENABLED_STORAGE_KEY = 'newsflash.alertEnabled.v1';

type NewsCategory = '국내' | '국제';

interface Article {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  category?: NewsCategory;
  imageUrl?: string;
}

interface BreakingResponse {
  articles?: Article[];
  lastUpdated?: string;
  totalCount?: number;
  sources?: string[];
  sourceStats?: Record<string, number>;
  categoryStats?: Record<NewsCategory, number>;
  error?: string;
}

type TranslationResult = {
  titleKo: string;
  summaryKo: string;
  notice?: string;
};

type TranslationState = {
  loading?: boolean;
  error?: string;
  result?: TranslationResult;
};

export default function BreakingPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, TranslationState>>({});

  // --- Notification & Keyword Alert Settings State & Logic ---
  const [alertKeywords, setAlertKeywords] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }
    try {
      const saved = window.localStorage.getItem(ALERT_KEYWORDS_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('알림 키워드 불러오기 에러:', err);
      return [];
    }
  });

  const [alertEnabled, setAlertEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    try {
      const saved = window.localStorage.getItem(ALERT_ENABLED_STORAGE_KEY);
      return saved !== null ? JSON.parse(saved) : true;
    } catch (err) {
      console.error('알림 상태 불러오기 에러:', err);
      return true;
    }
  });

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [keywordInput, setKeywordInput] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const seenArticlesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const sendArticleNotification = (article: Article) => {
    if (typeof window === 'undefined') return;

    if (!('Notification' in window)) {
      alert('이 브라우저는 알림 기능을 지원하지 않습니다.');
      return;
    }

    const translation = translations[getTranslationKey(article)]?.result;
    const displayTitle = translation ? translation.titleKo : article.title;
    const displayBody = translation ? translation.summaryKo : article.description;

    const showNotification = () => {
      try {
        const options: NotificationOptions = {
          body: displayBody || '자세한 내용은 클릭하여 확인하세요.',
          icon: article.imageUrl || '/icons/icon-192.png',
          tag: article.link || article.title,
          data: {
            url: article.link
          }
        };

        const notification = new Notification(displayTitle, options);
        notification.onclick = () => {
          window.focus();
          window.open(article.link, '_blank');
        };
      } catch (e) {
        console.error('알림 발송 실패:', e);
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(displayTitle, {
              body: displayBody || '자세한 내용은 클릭하여 확인하세요.',
              icon: article.imageUrl || '/icons/icon-192.png',
              tag: article.link || article.title,
              data: {
                url: article.link
              }
            });
          }).catch(err => console.error('서비스 워커 알림 실패:', err));
        }
      }
    };

    if (Notification.permission === 'granted') {
      showNotification();
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        setNotificationPermission(permission);
        if (permission === 'granted') {
          showNotification();
        }
      });
    } else {
      alert('알림 권한이 거부되어 있습니다. 브라우저 설정에서 알림 권한을 허용해주세요.');
    }
  };

  const checkNewArticlesForKeywords = (newsArticles: Article[]) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (!alertEnabled || alertKeywords.length === 0 || Notification.permission !== 'granted') return;

    const newArticles = newsArticles.filter(art => !seenArticlesRef.current.has(art.link));
    if (newArticles.length === 0) return;

    newArticles.forEach(article => {
      const textToSearch = `${article.title} ${article.description}`.toLowerCase();
      
      const matchedKeyword = alertKeywords.find(kw => {
        if (kw.includes('+')) {
          const subKeywords = kw.split('+').map(s => s.trim().toLowerCase()).filter(Boolean);
          return subKeywords.length > 0 && subKeywords.every(sub => textToSearch.includes(sub));
        }
        return textToSearch.includes(kw.trim().toLowerCase());
      });

      if (matchedKeyword) {
        try {
          const displayTitle = `🚨 [속보 알림: ${matchedKeyword}] ${article.title}`;
          const options: NotificationOptions = {
            body: article.description || '자세한 내용은 클릭하여 확인하세요.',
            icon: article.imageUrl || '/icons/icon-192.png',
            tag: article.link || article.title,
            data: {
              url: article.link
            }
          };

          const notification = new Notification(displayTitle, options);
          notification.onclick = () => {
            window.focus();
            window.open(article.link, '_blank');
          };
        } catch (e) {
          console.error('자동 속보 알림 전송 실패:', e);
        }
      }
    });
  };

  const handleAddOrEditKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = keywordInput.trim();
    if (!trimmed) return;

    if (editingIndex !== null) {
      setAlertKeywords((current) => {
        const updated = [...current];
        updated[editingIndex] = trimmed;
        return updated;
      });
      setEditingIndex(null);
    } else {
      if (alertKeywords.includes(trimmed)) {
        alert('이미 등록된 키워드입니다.');
        return;
      }
      setAlertKeywords((current) => [...current, trimmed]);
    }
    setKeywordInput('');
  };

  const startEditingKeyword = (index: number) => {
    setKeywordInput(alertKeywords[index]);
    setEditingIndex(index);
  };

  const cancelEditing = () => {
    setKeywordInput('');
    setEditingIndex(null);
  };

  const deleteKeyword = (index: number) => {
    setAlertKeywords((current) => current.filter((_, idx) => idx !== index));
    if (editingIndex === index) {
      setKeywordInput('');
      setEditingIndex(null);
    }
  };

  const saveKeywordSettings = () => {
    try {
      window.localStorage.setItem(ALERT_KEYWORDS_STORAGE_KEY, JSON.stringify(alertKeywords));
      window.localStorage.setItem(ALERT_ENABLED_STORAGE_KEY, JSON.stringify(alertEnabled));

      if (alertEnabled && Notification.permission !== 'granted') {
        Notification.requestPermission().then((permission) => {
          setNotificationPermission(permission);
          if (permission === 'granted') {
            alert('키워드 알림 설정이 저장되었으며 알림 권한이 허용되었습니다.');
          } else {
            alert('키워드 알림 설정이 저장되었으나, 알림 권한이 허용되지 않았습니다. 브라우저 설정에서 확인바랍니다.');
          }
        });
      } else {
        alert('알림 설정이 정상적으로 저장되었습니다.');
      }
    } catch (err) {
      console.error('알림 설정 저장 오류:', err);
      alert('설정을 저장하는데 오류가 발생했습니다.');
    }
  };

  const toggleAlertEnabled = () => {
    const nextState = !alertEnabled;
    setAlertEnabled(nextState);

    if (nextState && Notification.permission !== 'granted') {
      Notification.requestPermission().then((permission) => {
        setNotificationPermission(permission);
      });
    }
  };

  async function fetchNews(isManualRefresh = false) {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      } else if (articles.length === 0) {
        setLoading(true);
      }

      setError(null);

      const response = await fetch('/api/breaking', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('속보를 불러오지 못했습니다.');
      }

      const data: BreakingResponse = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const dataArticles = data.articles || [];

      if (seenArticlesRef.current.size === 0) {
        dataArticles.forEach((art: Article) => seenArticlesRef.current.add(art.link));
      } else {
        checkNewArticlesForKeywords(dataArticles);
        dataArticles.forEach((art: Article) => seenArticlesRef.current.add(art.link));
      }

      setArticles(dataArticles);
      setLastUpdated(data.lastUpdated || new Date().toISOString());
    } catch (err) {
      console.error('속보 로딩 에러:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void fetchNews();

    const interval = setInterval(() => {
      void fetchNews();
    }, BREAKING_REFRESH_MS);

    return () => clearInterval(interval);
  }, []);

  function getArticleCategory(article: Article): NewsCategory {
    if (article.category) {
      return article.category;
    }

    const internationalSources = [
      'BBC News',
      'New York Times',
      'Al Jazeera',
      'The Guardian',
    ];

    if (internationalSources.includes(article.source)) {
      return '국제';
    }

    return '국내';
  }

  function getFilterSourceName(source: string): string {
    if (source.startsWith('MBC')) {
      return 'MBC';
    }

    return source;
  }

  function isArticleMatchedWithSelectedFilter(article: Article): boolean {
    if (selectedFilter === '전체') {
      return true;
    }

    if (selectedFilter === '국내' || selectedFilter === '국제') {
      return getArticleCategory(article) === selectedFilter;
    }

    if (selectedFilter === 'MBC') {
      return article.source.startsWith('MBC');
    }

    return article.source === selectedFilter;
  }

  function isArticleMatchedWithSearch(article: Article): boolean {
    const keyword = searchQuery.trim().toLowerCase();

    if (!keyword) {
      return true;
    }

    return [article.title, article.description, article.source, getArticleCategory(article)]
      .join(' ')
      .toLowerCase()
      .includes(keyword);
  }

  function resetSearchOptions() {
    setSelectedFilter('전체');
    setSearchQuery('');
  }

  const filters = useMemo(() => {
    const uniqueSources = Array.from(
      new Set(articles.map((article) => getFilterSourceName(article.source))),
    );

    return ['전체', '국내', '국제', ...uniqueSources];
  }, [articles]);

  const filteredArticles = useMemo(() => {
    return articles.filter(
      (article) =>
        isArticleMatchedWithSelectedFilter(article) &&
        isArticleMatchedWithSearch(article),
    );
  }, [articles, selectedFilter, searchQuery]);

  function getRelativeTime(dateString: string): string {
    const now = new Date();
    const past = new Date(dateString);

    if (Number.isNaN(past.getTime())) {
      return '시간 정보 없음';
    }

    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) {
      return '방금 전';
    }

    if (diffMins < 60) {
      return `${diffMins}분 전`;
    }

    if (diffHours < 24) {
      return `${diffHours}시간 전`;
    }

    return past.toLocaleDateString('ko-KR');
  }

  function getFormattedUpdateTime() {
    if (!lastUpdated) {
      return '';
    }

    const date = new Date(lastUpdated);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getSourceColor(source: string) {
    switch (source) {
      case 'SBS':
      case 'SBS 주요뉴스':
        return 'text-blue-600';
      case 'MBC':
        return 'text-purple-600';
      case '연합뉴스':
      case '연합뉴스TV':
        return 'text-green-600';
      case 'YTN 최신뉴스':
        return 'text-indigo-600';
      case '매일경제':
        return 'text-gray-700';
      case '경향신문':
        return 'text-purple-600';
      case '뉴스':
        return 'text-gray-700';
      case 'BBC News':
        return 'text-red-600';
      case 'New York Times':
        return 'text-blue-700';
      case 'Al Jazeera':
        return 'text-green-700';
      case 'The Guardian':
        return 'text-sky-600';
      default:
        return 'text-gray-600';
    }
  }

  function getSourceEmoji(source: string) {
    switch (source) {
      case 'SBS':
      case 'SBS 주요뉴스':
        return '📺';
      case 'MBC':
        return '📡';
      case '연합뉴스':
      case '연합뉴스TV':
        return '📰';
      case 'YTN 최신뉴스':
        return '📡';
      case '매일경제':
      case '경향신문':
      case '뉴스':
        return '📄';
      case 'BBC News':
      case 'New York Times':
      case 'Al Jazeera':
      case 'The Guardian':
        return '🌍';
      default:
        return '📄';
    }
  }

  function getCategoryBadgeClass(category: NewsCategory) {
    if (category === '국제') {
      return 'bg-indigo-50 text-indigo-700';
    }

    return 'bg-emerald-50 text-emerald-700';
  }

  function isKoreanText(text: string) {
    return /[가-힣]/.test(text);
  }

  function needsTranslation(article: Article) {
    const text = `${article.title} ${article.description}`;
    return !isKoreanText(text);
  }

  function getTranslationKey(article: Article) {
    return article.link || article.title;
  }

  function getArticleSearchUrl(article: Article) {
    return `https://www.google.com/search?q=${encodeURIComponent(article.title)}`;
  }

  async function requestArticleTranslation(article: Article) {
    const key = getTranslationKey(article);

    setTranslations((current) => ({
      ...current,
      [key]: { loading: true },
    }));

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: article.title,
          description: article.description,
          source: article.source,
        }),
      });

      if (!response.ok) {
        throw new Error('번역 요청에 실패했습니다.');
      }

      const data = await response.json();

      setTranslations((current) => ({
        ...current,
        [key]: {
          loading: false,
          result: {
            titleKo: data.titleKo || '번역 제목을 불러오지 못했습니다.',
            summaryKo: data.summaryKo || '번역 요약을 불러오지 못했습니다.',
            notice: data.notice,
          },
        },
      }));
    } catch (err) {
      setTranslations((current) => ({
        ...current,
        [key]: {
          loading: false,
          error: err instanceof Error ? err.message : '번역을 불러오지 못했습니다.',
        },
      }));
    }
  }

  function renderTranslationPanel(article: Article) {
    const translation = translations[getTranslationKey(article)];

    if (!translation) {
      return null;
    }

    if (translation.loading) {
      return (
        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
          번역을 불러오는 중입니다...
        </div>
      );
    }

    if (translation.error) {
      return (
        <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
          {translation.error}
        </div>
      );
    }

    if (!translation.result) {
      return null;
    }

    return (
      <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3">
        <p className="mb-1 text-xs font-bold text-blue-700">번역 결과</p>
        <p className="text-sm font-semibold text-gray-900">
          {translation.result.titleKo}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-gray-700">
          {translation.result.summaryKo}
        </p>
        {translation.result.notice && (
          <p className="mt-2 text-xs text-gray-500">{translation.result.notice}</p>
        )}
      </div>
    );
  }

  function renderArticleActions(article: Article) {
    const translation = translations[getTranslationKey(article)];

    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
          title="원문 기사로 이동합니다."
        >
          원문보기
        </a>

        {needsTranslation(article) && (
          <button
            type="button"
            onClick={() => requestArticleTranslation(article)}
            disabled={translation?.loading}
            className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
            title="기사 제목과 요약을 한국어로 확인합니다."
          >
            {translation?.loading ? '번역 중...' : '번역하기'}
          </button>
        )}

        <a
          href={getArticleSearchUrl(article)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
          title="원문 사이트가 차단될 때 기사 제목으로 검색합니다."
        >
          제목 검색
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600">속보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error && articles.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <p className="mb-4 text-xl text-red-600">⚠️ {error}</p>
          <button
            type="button"
            onClick={() => fetchNews(true)}
            className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
          >
            즉시 갱신
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <span>←</span>
              <span>홈으로</span>
            </Link>

            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">속보</h1>
              <p className="mt-1 text-xs text-gray-500">
                최근 12시간 이내 국내·국제 뉴스 · 5분마다 자동 갱신
                {getFormattedUpdateTime() &&
                  ` · 마지막 업데이트 ${getFormattedUpdateTime()}`}
              </p>
            </div>

            <div className="flex gap-2 whitespace-nowrap">
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold border transition cursor-pointer ${
                  showSettings
                    ? 'bg-amber-500 text-white border-amber-600'
                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                }`}
              >
                🔔 알림 안내판
              </button>
              <button
                type="button"
                onClick={() => fetchNews(true)}
                disabled={refreshing}
                className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
              >
                {refreshing ? '갱신 중...' : '즉시 갱신'}
              </button>
            </div>
          </div>

          {showSettings && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 pb-4 border-b border-gray-100 gap-4">
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">실시간 속보 키워드 알림 상태</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {notificationPermission === 'granted'
                      ? '알림 권한이 허용되었습니다.'
                      : notificationPermission === 'denied'
                      ? '알림 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.'
                      : '알림 권한 요청이 필요합니다.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleAlertEnabled}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    alertEnabled && notificationPermission === 'granted'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {alertEnabled && notificationPermission === 'granted' ? '알림 ON' : '알림 OFF'}
                </button>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 text-sm mb-1">알림 키워드 관리 (속보 알림 안내판)</h3>
                <p className="text-xs text-gray-500 mb-2">
                  💡 단일(영화, 친구) 또는 동시 포함(영화+액션) 형태로 입력 가능합니다.
                </p>
                <form onSubmit={handleAddOrEditKeyword} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    placeholder="알림 단어 입력 (예: 영화, 친구, 영화+액션)"
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition"
                  >
                    {editingIndex !== null ? '수정' : '추가'}
                  </button>
                  {editingIndex !== null && (
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 font-semibold text-xs hover:bg-gray-200 transition"
                    >
                      취소
                    </button>
                  )}
                </form>

                {alertKeywords.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {alertKeywords.map((word, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-semibold border border-blue-100"
                      >
                        <span>{word}</span>
                        <button
                          type="button"
                          onClick={() => startEditingKeyword(idx)}
                          className="hover:text-blue-900 ml-1 font-bold text-[10px] text-blue-500"
                          title="수정"
                        >
                          수정
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          type="button"
                          onClick={() => deleteKeyword(idx)}
                          className="hover:text-red-600 font-bold text-[10px] text-blue-500"
                          title="삭제"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-xs mb-4">등록된 알림 키워드가 없습니다.</p>
                )}

                <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={saveKeywordSettings}
                    className="px-4 py-2 rounded-xl bg-gray-900 text-white font-bold text-xs hover:bg-gray-800 transition"
                  >
                    설정 저장
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <section className="mb-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">기사 조회</p>
                <p className="mt-1 text-xs text-gray-500">
                  제목·요약·출처를 검색하고 국내·국제·출처별로 확인합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={resetSearchOptions}
                className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700"
              >
                초기화
              </button>
            </div>

            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="제목·요약·출처 검색"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-500">
              <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700">
                조회 결과 {filteredArticles.length}건
              </span>
              <span>전체 {articles.length}건 중 조건에 맞는 기사입니다.</span>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-gray-500">
                분류·출처 필터
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {filters.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setSelectedFilter(filter)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
                      selectedFilter === filter
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="mx-auto max-w-4xl">
        {filteredArticles.map((article, index) => {
          const category = getArticleCategory(article);

          return (
            <article
              key={`${article.source}-${article.link}-${index}`}
              className="border-b border-gray-100 transition-colors hover:bg-gray-50"
            >
              <div className="flex gap-4 p-4">
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-28 w-28 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100"
                  title="원문 기사로 이동합니다."
                >
                  {article.imageUrl ? (
                    <img
                      src={article.imageUrl}
                      alt={article.title}
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="text-4xl">{getSourceEmoji(article.source)}</div>
                  )}
                </a>

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-bold ${getSourceColor(article.source)}`}>
                      {article.source}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getCategoryBadgeClass(
                        category,
                      )}`}
                    >
                      {category}
                    </span>
                    <span className="text-sm text-gray-400">
                      {getRelativeTime(article.pubDate)}
                    </span>
                  </div>

                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-2 block text-base font-bold leading-snug text-gray-900 line-clamp-2 hover:text-blue-600"
                    title="원문 기사로 이동합니다."
                  >
                    {article.title}
                  </a>

                  <p className="text-sm leading-relaxed text-gray-600 line-clamp-2">
                    {article.description}
                  </p>

                  {renderArticleActions(article)}
                  {renderTranslationPanel(article)}
                </div>
              </div>
            </article>
          );
        })}

        {filteredArticles.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            조회 조건에 맞는 속보가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
