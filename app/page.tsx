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

export default function Home() {
  const [breakingNews, setBreakingNews] = useState<Article[]>([]);
  const [cartoons, setCartoons] = useState<Cartoon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNews() {
      try {
        // 속보 가져오기
        const breakingResponse = await fetch('/api/breaking');
        if (!breakingResponse.ok) {
          throw new Error('뉴스를 불러오는데 실패했습니다.');
        }
        const breakingData = await breakingResponse.json();
        setBreakingNews(breakingData.articles || []);

        // 시사만평 가져오기
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

    fetchNews();
    const interval = setInterval(fetchNews, 300000); // 5분마다 갱신

    return () => clearInterval(interval);
  }, []);

  const getSourceEmoji = (source: string) => {
    switch (source) {
      case 'SBS':
        return '📺';
      case '연합뉴스':
        return '📰';
      case 'JTBC':
        return '📡';
      case '경향신문':
        return '📰';
      case '한겨레':
        return '📰';
      default:
        return '📄';
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'SBS':
        return 'text-blue-600';
      case '연합뉴스':
        return 'text-green-600';
      case 'JTBC':
        return 'text-red-600';
      case '경향신문':
        return 'text-purple-600';
      case '한겨레':
        return 'text-indigo-600';
      default:
        return 'text-gray-600';
    }
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
                        {new Date(article.pubDate).toLocaleTimeString('ko-KR', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-800 group-hover:text-blue-600 line-clamp-2 mb-2">
                      {article.title}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {article.description}
                    </p>
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
