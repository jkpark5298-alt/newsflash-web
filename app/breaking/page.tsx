'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

const BREAKING_REFRESH_MS = 5 * 60 * 1000;

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

export default function BreakingPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('전체');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  async function fetchNews(isManualRefresh = false) {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      } else if (articles.length === 0) {
        setLoading(true);
      }

      setError(null);

      const response = await fetch('/api/breaking', {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('속보를 불러오는데 실패했습니다.');
      }

      const data: BreakingResponse = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setArticles(data.articles || []);
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
    fetchNews();

    const interval = setInterval(() => {
      fetchNews();
    }, BREAKING_REFRESH_MS);

    return () => clearInterval(interval);
  }, []);

  function getArticleCategory(article: Article): NewsCategory {
    if (article.category) {
      return article.category;
    }

    const internationalSources = ['BBC News', 'New York Times', 'Al Jazeera', 'The Guardian'];

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

  const filters = useMemo(() => {
    const uniqueSources = Array.from(
      new Set(articles.map((article) => getFilterSourceName(article.source)))
    );

    return ['전체', '국내', '국제', ...uniqueSources];
  }, [articles]);

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => isArticleMatchedWithSelectedFilter(article));
  }, [articles, selectedFilter]);

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
      minute: '2-digit'
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
        return '🚨';
      case 'BBC News':
        return '🇬🇧';
      case 'New York Times':
        return '🇺🇸';
      case 'Al Jazeera':
        return '🌍';
      case 'The Guardian':
        return '🇬🇧';
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">속보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error && articles.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-xl mb-4">⚠️ {error}</p>
          <button
            onClick={() => fetchNews(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            즉시 갱신
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
            >
              <span>←</span>
              <span>홈으로</span>
            </Link>

            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">속보</h1>
              <p className="text-xs text-gray-500 mt-1">
                최근 12시간 이내 국내·국제 뉴스 · 5분마다 자동 갱신
                {getFormattedUpdateTime() && ` · 마지막 업데이트 ${getFormattedUpdateTime()}`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => fetchNews(true)}
              disabled={refreshing}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 text-sm font-semibold whitespace-nowrap"
            >
              {refreshing ? '갱신 중...' : '즉시 갱신'}
            </button>
          </div>

          {error && (
            <div className="mb-3 rounded-lg bg-red-50 border border-red-100 px-4 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`px-6 py-2 rounded-full font-medium whitespace-nowrap transition-all ${
                  selectedFilter === filter
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {filteredArticles.map((article, index) => {
          const category = getArticleCategory(article);

          return (
            <a
              key={`${article.source}-${article.link}-${index}`}
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <div className="flex gap-4 p-4">
                <div className="flex-shrink-0 w-28 h-28 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                  {article.imageUrl ? (
                    <img
                      src={article.imageUrl}
                      alt={article.title}
                      className="w-full h-full object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="text-4xl">{getSourceEmoji(article.source)}</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`font-bold text-sm ${getSourceColor(article.source)}`}>
                      {article.source}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getCategoryBadgeClass(
                        category
                      )}`}
                    >
                      {category}
                    </span>
                    <span className="text-gray-400 text-sm">
                      {getRelativeTime(article.pubDate)}
                    </span>
                  </div>

                  <h2 className="text-base font-bold text-gray-900 mb-2 line-clamp-2 leading-snug">
                    {article.title}
                  </h2>

                  <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                    {article.description}
                  </p>
                </div>
              </div>
            </a>
          );
        })}

        {filteredArticles.length === 0 && (
          <div className="p-8 text-center text-gray-500">표시할 속보가 없습니다.</div>
        )}
      </div>
    </div>
  );
}