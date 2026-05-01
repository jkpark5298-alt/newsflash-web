'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Article {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  imageUrl?: string;
}

export default function BreakingPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string>('전체');

  const sources = ['전체', 'SBS', '연합뉴스', 'JTBC'];

  useEffect(() => {
    async function fetchNews() {
      try {
        const response = await fetch('/api/breaking');
        
        if (!response.ok) {
          throw new Error('속보를 불러오는데 실패했습니다.');
        }

        const data = await response.json();
        setArticles(data.articles || []);
        setFilteredArticles(data.articles || []);
      } catch (err) {
        console.error('속보 로딩 에러:', err);
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    fetchNews();
  }, []);

  useEffect(() => {
    if (selectedSource === '전체') {
      setFilteredArticles(articles);
    } else {
      setFilteredArticles(articles.filter(article => article.source === selectedSource));
    }
  }, [selectedSource, articles]);

  // 상대 시간 계산
  const getRelativeTime = (dateString: string): string => {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return past.toLocaleDateString('ko-KR');
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'SBS':
        return 'text-blue-600';
      case '연합뉴스':
        return 'text-green-600';
      case 'JTBC':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getSourceEmoji = (source: string) => {
    switch (source) {
      case 'SBS':
        return '📺';
      case '연합뉴스':
        return '📰';
      case 'JTBC':
        return '📡';
      default:
        return '📄';
    }
  };

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

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
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
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <Link 
              href="/"
              className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
            >
              <span>←</span>
              <span>홈으로</span>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">속보</h1>
            <div className="w-16"></div> {/* 중앙 정렬용 */}
          </div>

          {/* 필터 버튼 */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {sources.map((source) => (
              <button
                key={source}
                onClick={() => setSelectedSource(source)}
                className={`px-6 py-2 rounded-full font-medium whitespace-nowrap transition-all ${
                  selectedSource === source
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {source}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 뉴스 목록 */}
      <div className="max-w-4xl mx-auto">
        {filteredArticles.map((article, index) => (
          <a
            key={index}
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <div className="flex gap-4 p-4">
              {/* 이미지 영역 - 왼쪽 */}
              <div className="flex-shrink-0 w-28 h-28 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                {article.imageUrl ? (
                  <img
                    src={article.imageUrl}
                    alt={article.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `<div class="text-4xl">${getSourceEmoji(article.source)}</div>`;
                      }
                    }}
                  />
                ) : (
                  <div className="text-4xl">
                    {getSourceEmoji(article.source)}
                  </div>
                )}
              </div>

              {/* 텍스트 영역 - 오른쪽 */}
              <div className="flex-1 min-w-0">
                {/* 출처 + 시간 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`font-bold text-sm ${getSourceColor(article.source)}`}>
                    {article.source}
                  </span>
                  <span className="text-gray-400 text-sm">
                    {getRelativeTime(article.pubDate)}
                  </span>
                </div>

                {/* 제목 */}
                <h2 className="text-base font-bold text-gray-900 mb-2 line-clamp-2 leading-snug">
                  {article.title}
                </h2>

                {/* 설명 */}
                <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                  {article.description}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* 결과 없음 */}
      {filteredArticles.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">해당 출처의 뉴스가 없습니다.</p>
        </div>
      )}
    </div>
  );
}
