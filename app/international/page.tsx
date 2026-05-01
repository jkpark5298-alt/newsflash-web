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

export default function InternationalPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceStats, setSourceStats] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    async function fetchNews() {
      try {
        console.log('🌍 국제 뉴스 로딩 시작...');
        
        const response = await fetch('/api/international', {
          cache: 'no-store'
        });
        
        const data = await response.json();
        
        console.log('📊 받은 데이터:', {
          총개수: data.articles?.length || 0,
          출처별: data.sourceStats,
          에러: data.error,
          경고: data.errors
        });
        
        if (data.articles && data.articles.length > 0) {
          setArticles(data.articles);
          setSourceStats(data.sourceStats || {});
          setError(null);
        } else if (data.error) {
          setError(data.error);
        } else {
          setError('국제 뉴스를 불러올 수 없습니다.');
        }
        
      } catch (err) {
        console.error('❌ 국제 뉴스 로딩 에러:', err);
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
      // 외국 언론
      case 'BBC News':
        return '🇬🇧';
      case 'New York Times':
        return '🇺🇸';
      case 'Al Jazeera':
        return '🌍';
      case 'The Guardian':
        return '🇬🇧';
      
      // 국내 일간지
      case '동아일보':
        return '📰';
      case '조선일보':
        return '📰';
      case '한겨레':
        return '📰';
      case '경향신문':
        return '📰';
      
      // 방송사
      case '연합뉴스TV':
        return '📺';
      case 'MBC':
        return '📺';
      
      default:
        return '🌐';
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      // 외국 언론
      case 'BBC News':
        return 'text-red-600';
      case 'New York Times':
        return 'text-blue-700';
      case 'Al Jazeera':
        return 'text-green-600';
      case 'The Guardian':
        return 'text-blue-500';
      
      // 국내 일간지
      case '동아일보':
        return 'text-blue-600';
      case '조선일보':
        return 'text-indigo-600';
      case '한겨레':
        return 'text-teal-600';
      case '경향신문':
        return 'text-purple-600';
      
      // 방송사
      case '연합뉴스TV':
        return 'text-green-700';
      case 'MBC':
        return 'text-blue-600';
      
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <header className="bg-white shadow-md sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-2xl hover:opacity-70">←</Link>
              <span className="text-3xl">🌍</span>
              <h1 className="text-3xl font-bold text-gray-800">국제 뉴스</h1>
            </div>
          </div>
        </header>
        
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">국제 뉴스를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <header className="bg-white shadow-md sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-2xl hover:opacity-70">←</Link>
              <span className="text-3xl">🌍</span>
              <h1 className="text-3xl font-bold text-gray-800">국제 뉴스</h1>
            </div>
          </div>
        </header>
        
        <div className="flex items-center justify-center min-h-[60vh]">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-2xl hover:opacity-70 transition-opacity">←</Link>
            <span className="text-3xl">🌍</span>
            <h1 className="text-3xl font-bold text-gray-800">국제 뉴스</h1>
          </div>
          <p className="text-gray-600 mt-2">전 세계 주요 뉴스 · {articles.length}개 기사</p>
          
          {/* 출처별 통계 */}
          {Object.keys(sourceStats).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(sourceStats).map(([source, count]) => (
                <span 
                  key={source}
                  className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-700"
                >
                  {getSourceEmoji(source)} {source}: {count}개
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {articles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article, index) => (
              <a
                key={index}
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group"
              >
                {article.imageUrl && (
                  <div className="relative w-full h-48 overflow-hidden bg-gray-100">
                    <Image
                      src={article.imageUrl}
                      alt={article.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      unoptimized
                      loading={index < 6 ? "eager" : "lazy"}
                    />
                  </div>
                )}
                
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-semibold ${getSourceColor(article.source)}`}>
                      {getSourceEmoji(article.source)} {article.source}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {new Date(article.pubDate).toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-800 group-hover:text-blue-600 line-clamp-2 mb-2">
                    {article.title}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-3">
                    {article.description}
                  </p>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <p className="text-gray-500">표시할 국제 뉴스가 없습니다.</p>
          </div>
        )}
      </main>
    </div>
  );
}
