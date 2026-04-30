'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface Cartoon {
  title: string;
  imageUrl: string;
  link: string;
  source: string;
}

export default function CartoonsPage() {
  const [cartoons, setCartoons] = useState<Cartoon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCartoons();
  }, []);

  const fetchCartoons = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/cartoons');
      const data = await response.json();
      
      if (data.success) {
        setCartoons(data.cartoons);
      } else {
        setError(data.error || '만평을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg font-medium">만평을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">오류 발생</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={fetchCartoons}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎨 오늘의 시사만평
          </h1>
          <p className="text-lg text-gray-600">
            한겨레 그림판 - 총 {cartoons.length}개
          </p>
        </div>

        {/* 만평 그리드 */}
        {cartoons.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">표시할 만평이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cartoons.map((cartoon, index) => (
              <div
                key={index}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300"
              >
                {/* 이미지 */}
                <div className="relative h-64 bg-gray-100">
                  {cartoon.imageUrl ? (
                    <Image
                      src={cartoon.imageUrl}
                      alt={cartoon.title}
                      fill
                      className="object-contain p-4"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      priority={index < 3}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* 내용 */}
                <div className="p-5">
                  <h2 className="text-lg font-bold text-gray-800 mb-4 line-clamp-2 min-h-[3.5rem] hover:text-blue-600 transition-colors">
                    {cartoon.title}
                  </h2>

                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      📰 {cartoon.source}
                    </span>

                    <a
                      href={cartoon.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-blue-600 hover:text-white transition-all duration-200"
                    >
                      원문 보기
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 새로고침 버튼 */}
        <div className="text-center mt-12">
          <button
            onClick={fetchCartoons}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            🔄 새로고침
          </button>
        </div>
      </div>
    </div>
  );
}
