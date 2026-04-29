'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Cartoon {
  id: string;
  title: string;
  imageUrl: string;
  link: string;
  source: string;
  pubDate: string;
}

export default function CartoonsPage() {
  const [cartoons, setCartoons] = useState<Cartoon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCartoons() {
      try {
        setLoading(true);
        const response = await fetch('/api/cartoons');
        const result = await response.json();
        
        console.log('API 응답:', result);
        
        if (result.success && Array.isArray(result.data)) {
          setCartoons(result.data);
        } else {
          setError('만평 데이터를 불러올 수 없습니다.');
          setCartoons([]);
        }
      } catch (err) {
        console.error('만평 로딩 에러:', err);
        setError('만평을 불러오는 중 오류가 발생했습니다.');
        setCartoons([]);
      } finally {
        setLoading(false);
      }
    }

    fetchCartoons();
  }, []);

  // 날짜 포맷팅 함수
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}.${month}.${day}`;
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link 
            href="/" 
            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            홈으로
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">오늘의 시사만평</h1>
          <div className="w-20"></div> {/* 중앙 정렬을 위한 빈 공간 */}
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-xl text-gray-600">로딩 중...</div>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-xl text-red-600">{error}</div>
          </div>
        ) : cartoons.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-xl text-gray-600">표시할 만평이 없습니다.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cartoons.map((cartoon, index) => (
              <div key={cartoon.id || index} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <a href={cartoon.link} target="_blank" rel="noopener noreferrer">
                  <div className="relative h-64 bg-gray-200">
                    <img
                      src={cartoon.imageUrl}
                      alt={cartoon.title}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/placeholder.png';
                      }}
                    />
                  </div>
                  <div className="p-4">
                    <h2 className="text-lg font-semibold mb-2 text-gray-800 line-clamp-2">
                      {cartoon.title}
                    </h2>
                    <div className="flex justify-between items-center text-sm text-gray-600">
                      <span className="font-medium">{cartoon.source}</span>
                      <span>{formatDate(cartoon.pubDate)}</span>
                    </div>
                  </div>
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
