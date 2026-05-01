'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

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
  source: '클리앙' | '뽐뿌';
  pubDate: string;
  summary: string;
  detail: string;
  category: string;
}

export default function Home() {
  const [breakingNews, setBreakingNews] = useState<Article[]>([]);
  const [cartoons, setCartoons] = useState<Cartoon[]>([]);
  const [communityIssues, setCommunityIssues] = useState<CommunityIssue[]>([]);
  const [expandedCommunityId, setExpandedCommunityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [communityLoading, setCommunityLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNews() {
      try {
        const breakingResponse = await fetch('/api/breaking');

        if (!breakingResponse.ok) {
          throw new Error('뉴스를 불러오는데 실패했습니다.');
        }

        const breakingData = await breakingResponse.json();
        setBreakingNews(breakingData.articles || []);

        const cartoonsResponse = await fetch('/api/cartoons');

        if (cartoonsResponse.ok) {
          const cartoonsData = await cartoonsResponse.json();
          setCartoons(cartoonsData.cartoons || []);
        }
      } catch (err) {
        console.error('뉴스 로딩 에러:', err);
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    async function fetchCommunityIssues() {
      try {
        setCommunityLoading(true);

        const communityResponse = await fetch('/api/community');

        if (!communityResponse.ok) {
          return;
        }

        const communityData = await communityResponse.json();
        setCommunityIssues(communityData.issues || []);
      } catch (err) {
        console.error('커뮤니티 이슈 로딩 에러:', err);
        setCommunityIssues([]);
      } finally {
        setCommunityLoading(false);
      }
    }

    fetchNews();
    fetchCommunityIssues();

    const newsInterval = setInterval(fetchNews, 300000);
    const communityInterval = setInterval(fetchCommunityIssues, 300000);

    return () => {
      clearInterval(newsInterval);
      clearInterval(communityInterval);
    };
  }, []);

  const getSourceEmoji = (source: string) => {
    switch (source) {
      case 'SBS':
      case 'SBS 주요뉴스':
        return '📺';
      case 'MBC':
        return '📡';
      case '연합뉴스':
      case '연합뉴스TV':
        return '📰';
      case 'JTBC':
        return '📡';
      case '경향신문':
        return '📰';
      case '한겨레':
        return '📰';
      case '클리앙':
        return '💬';
      case '뽐뿌':
        return '🔥';
      default:
        return '📄';
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'SBS':
      case 'SBS 주요뉴스':
        return 'text-blue-600';
      case 'MBC':
        return 'text-purple-600';
      case '연합뉴스':
      case '연합뉴스TV':
        return 'text-green-600';
      case 'JTBC':
        return 'text-red-600';
      case '경향신문':
        return 'text-purple-600';
      case '한겨레':
        return 'text-indigo-600';
      case '클리앙':
        return 'text-orange-600';
      case '뽐뿌':
        return 'text-pink-600';
      default:
        return 'text-gray-600';
    }
  };

  const getFormattedTime = (dateString: string) => {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return '시간 정보 없음';
    }

    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleCommunityDetail = (issueId: string) => {
    setExpandedCommunityId((currentId) => (currentId === issueId ? null : issueId));
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
      {/* 헤더 */}
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📰</span>
            <h1 className="text-3xl font-bold text-gray-800">뉴스플래시</h1>
          </div>
          <p className="text-gray-600 mt-2">실시간 뉴스를 한눈에</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* 속보 섹션 */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🚨</span>
              <h2 className="text-3xl font-bold text-gray-800">속보</h2>
            </div>
            <Link
              href="/breaking"
              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
            >
              전체보기 →
            </Link>
          </div>

          {breakingNews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {breakingNews.slice(0, 12).map((article, index) => (
                <a
                  key={index}
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group"
                >
                  {/* 이미지 */}
                  {article.imageUrl && (
                    <div className="relative w-full h-48 overflow-hidden bg-gray-100">
                      <Image
                        src={article.imageUrl}
                        alt={article.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        unoptimized
                      />
                    </div>
                  )}

                  {/* 콘텐츠 */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-semibold ${getSourceColor(article.source)}`}>
                        {getSourceEmoji(article.source)} {article.source}
                      </span>
                      <span className="text-gray-400 text-xs">
                        {getFormattedTime(article.pubDate)}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-800 group-hover:text-blue-600 line-clamp-2 mb-2">
                      {article.title}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{article.description}</p>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <p className="text-gray-500">속보를 불러오는 중...</p>
            </div>
          )}
        </section>

        {/* 커뮤니티 이슈 섹션 */}
        <section className="mb-12">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">💬</span>
                <h2 className="text-3xl font-bold text-gray-800">커뮤니티 이슈</h2>
              </div>
              <p className="text-sm text-gray-600">
                클리앙과 뽐뿌에서 올라오는 이용자 반응 기반 이슈입니다.
              </p>
              <p className="text-xs text-amber-700 mt-1">
                커뮤니티 이슈는 검증된 뉴스가 아니므로 원문에서 맥락을 확인하세요.
              </p>
            </div>
          </div>

          {communityLoading ? (
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <p className="text-gray-500">커뮤니티 이슈를 불러오는 중...</p>
            </div>
          ) : communityIssues.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {communityIssues.slice(0, 6).map((issue) => {
                const isExpanded = expandedCommunityId === issue.id;

                return (
                  <article
                    key={issue.id}
                    className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 p-5"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-xs font-semibold ${getSourceColor(issue.source)}`}>
                        {getSourceEmoji(issue.source)} {issue.source}
                      </span>
                      <span className="text-gray-300 text-xs">·</span>
                      <span className="text-gray-500 text-xs">{issue.category}</span>
                      <span className="text-gray-300 text-xs">·</span>
                      <span className="text-gray-400 text-xs">
                        {getFormattedTime(issue.pubDate)}
                      </span>
                    </div>

                    <h3 className="font-semibold text-gray-800 line-clamp-2 mb-2">
                      {issue.title}
                    </h3>

                    <p className="text-sm text-gray-600 line-clamp-2 mb-4">{issue.summary}</p>

                    {isExpanded && (
                      <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 mb-4">
                        <p className="text-xs font-semibold text-amber-700 mb-2">세부내용</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{issue.detail}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => toggleCommunityDetail(issue.id)}
                        className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                      >
                        {isExpanded ? '접기' : '자세히 보기'}
                      </button>

                      <a
                        href={issue.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-gray-600 hover:text-gray-900"
                      >
                        원문보기 →
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <p className="text-gray-500">커뮤니티 이슈를 불러오지 못했습니다.</p>
              <p className="text-xs text-gray-400 mt-2">
                커뮤니티 사이트 구조 변경 또는 접근 제한이 있을 수 있습니다.
              </p>
            </div>
          )}
        </section>

        {/* 시사만평 섹션 */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎨</span>
              <h2 className="text-3xl font-bold text-gray-800">시사만평</h2>
            </div>
            <Link
              href="/cartoons"
              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
            >
              전체보기 →
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
                  {/* 만평 이미지 */}
                  <div className="relative w-full h-64 overflow-hidden bg-gray-100">
                    <Image
                      src={cartoon.imageUrl}
                      alt={cartoon.title}
                      fill
                      className="object-contain group-hover:scale-105 transition-transform duration-300"
                      unoptimized
                    />
                  </div>

                  {/* 콘텐츠 */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-semibold ${getSourceColor(cartoon.source)}`}>
                        {getSourceEmoji(cartoon.source)} {cartoon.source}
                      </span>
                      <span className="text-gray-400 text-xs">
                        {new Date(cartoon.pubDate).toLocaleDateString('ko-KR')}
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
              <p className="text-gray-500">시사만평을 불러오는 중...</p>
            </div>
          )}
        </section>

        {/* 카테고리 링크 */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">카테고리별 뉴스</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href="/breaking"
              className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-xl transition-all duration-300 group"
            >
              <div className="text-4xl mb-2">🚨</div>
              <h3 className="font-bold text-gray-800 group-hover:text-blue-600">속보</h3>
            </Link>

            <Link
              href="/international"
              className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-xl transition-all duration-300 group"
            >
              <div className="text-4xl mb-2">🌍</div>
              <h3 className="font-bold text-gray-800 group-hover:text-blue-600">국제</h3>
            </Link>

            <Link
              href="/cartoons"
              className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-xl transition-all duration-300 group"
            >
              <div className="text-4xl mb-2">🎨</div>
              <h3 className="font-bold text-gray-800 group-hover:text-blue-600">시사만평</h3>
            </Link>

            <div className="bg-white rounded-xl shadow-md p-6 text-center opacity-50 cursor-not-allowed">
              <div className="text-4xl mb-2">📊</div>
              <h3 className="font-bold text-gray-400">준비중</h3>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}