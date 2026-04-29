'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface News {
  id: string;
  title: string;
  description: string;
  link: string;
  source: string;
  pubDate: string;
  timeAgo: string;
  imageUrl?: string;
}

export default function BreakingPage() {
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string>('전체');

  useEffect(() => {
    async function fetchNews() {
      try {
        setLoading(true);
        const response = await fetch('/api/breaking');
        const result = await response.json();
        
        console.log('API 응답:', result);
        
        if (result.success && Array.isArray(result.data)) {
          console.log('받은 뉴스 개수:', result.data.length);
          console.log('출처별:', result.data.reduce((acc: any, n: News) => {
            acc[n.source] = (acc[n.source] || 0) + 1;
            return acc;
          }, {}));
          setNews(result.data);
        } else {
          setError('속보 데이터를 불러올 수 없습니다.');
          setNews([]);
        }
      } catch (err) {
        console.error('속보 로딩 에러:', err);
        setError('속보를 불러오는 중 오류가 발생했습니다.');
        setNews([]);
      } finally {
        setLoading(false);
      }
    }

    fetchNews();
  }, []);

  const sources = ['전체', ...Array.from(new Set(news.map(n => n.source)))];
  const filteredNews = selectedSource === '전체' 
    ? news 
    : news.filter(n => n.source === selectedSource);

  console.log('현재 출처:', sources);
  console.log('선택된 출처:', selectedSource);
  console.log('필터된 뉴스:', filteredNews.length);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <Link 
              href="/" 
              className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              홈으로
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">속보</h1>
            <div className="w-20"></div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {sources.map(source => (
              <button
                key={source}
                onClick={() => setSelectedSource(source)}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                  selectedSource === source
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {source}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-xl text-gray-600">로딩 중...</div>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-xl text-red-600">{error}</div>
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-xl text-gray-600">표시할 속보가 없습니다.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNews.map((item) => (
              <a
                key={item.id}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4"
              >
                <div className="flex gap-4">
                  {item.imageUrl && (
                    <div className="flex-shrink-0 w-32 h-24 bg-gray-200 rounded overflow-hidden">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-sm font-semibold ${
                        item.source === 'MBC' && item.title.includes('[테스트]')
                          ? 'text-orange-600'
                          : 'text-blue-600'
                      }`}>
                        {item.source}
                      </span>
                      <span className="text-sm text-gray-500">
                        {item.timeAgo}
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                      {item.title}
                    </h2>
                    {item.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
