'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Cartoon {
  title: string;
  imageUrl: string;
  link: string;
  pubDate: string;
  source: string;
}

export default function CartoonsPage() {
  const [cartoons, setCartoons] = useState<Cartoon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchCartoons = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      
      console.log('🎨 만평 가져오는 중...');
      
      const response = await fetch('/api/cartoons');
      
      if (!response.ok) {
        throw new Error('만평을 불러오는데 실패했습니다.');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setCartoons(data.cartoons);
        setLastUpdate(new Date());
        console.log(`✅ 만평 ${data.cartoons.length}개 로드 완료`);
      } else {
        throw new Error(data.error || '알 수 없는 오류');
      }
    } catch (error) {
      console.error('만평 로딩 에러:', error);
      if (!silent) {
        setError(error instanceof Error ? error.message : '만평을 불러오는데 실패했습니다.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchCartoons();
    
    // 1분마다 자동 새로고침 (만평은 덜 자주 업데이트)
    const interval = setInterval(() => {
      console.log('🔄 만평 자동 업데이트 중...');
      fetchCartoons(true);
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">만평을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <span className="text-6xl mb-4 block">⚠️</span>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">오류 발생</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => fetchCartoons()}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
          >
            🔄 다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100">
      {/* 헤더 */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Link href="/" className="inline-flex items-center text-purple-600 hover:text-purple-800 mb-4">
            ← 홈으로
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-4xl">🎨</span>
              <h1 className="text-3xl font-bold text-gray-800">오늘의 만평</h1>
            </div>
            <div className="text-sm text-gray-500">
              마지막 업데이트: {lastUpdate.toLocaleTimeString('ko-KR')}
            </div>
          </div>
          <p className="text-gray-600 mt-2">시사만평 모음 • 총 {cartoons.length}개</p>
        </div>
      </header>

      {/* 만평 그리드 */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {cartoons.map((cartoon, index) => (
            <a
              key={index}
              href={cartoon.link}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow overflow-hidden"
            >
              <div className="aspect-square relative bg-gray-100">
                <img
                  src={cartoon.imageUrl}
                  alt={cartoon.title}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2">
                  {cartoon.title}
                </h3>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{cartoon.source}</span>
                  <span>{new Date(cartoon.pubDate).toLocaleDateString('ko-KR')}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}
