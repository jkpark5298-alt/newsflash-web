'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface Cartoon {
  title: string;
  imageUrl: string;
  link: string;
  source: string;
}

interface NewsItem {
  id: string;
  title: string;
  description: string;
  link: string;
  source: string;
  pubDate: string;
  timeAgo: string;
}

export default function Home() {
  const [cartoons, setCartoons] = useState<Cartoon[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loadingCartoons, setLoadingCartoons] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);

  useEffect(() => {
    fetchCartoons();
    fetchNews();
  }, []);

  const fetchCartoons = async () => {
    try {
      setLoadingCartoons(true);
      const response = await fetch('/api/cartoons');
      const data = await response.json();
      
      if (data.success) {
        setCartoons(data.cartoons.slice(0, 3));
      }
    } catch (err) {
      console.error('Fetch cartoons error:', err);
    } finally {
      setLoadingCartoons(false);
    }
  };

  const fetchNews = async () => {
    try {
      setLoadingNews(true);
      const response = await fetch('/api/breaking');
      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        setNews(data.data.slice(0, 5));
      }
    } catch (err) {
      console.error('Fetch news error:', err);
    } finally {
      setLoadingNews(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* 헤더 */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">
              📰 NewsFlash
            </h1>
            <nav className="flex gap-4">
              <Link 
                href="/breaking"
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-medium"
              >
                ⚡ 속보
              </Link>
              <Link 
                href="/cartoons"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
              >
                🎨 만평
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 환영 섹션 */}
        <section className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-4">
            오늘의 뉴스를 한눈에
          </h2>
          <p className="text-xl text-gray-600">
            속보와 시사만평으로 보는 세상 이야기
          </p>
        </section>

        {/* 속보 섹션 */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              ⚡ 최신 속보
            </h3>
            <Link 
              href="/breaking"
              className="text-red-600 hover:text-red-700 font-semibold flex items-center gap-2 group"
            >
              전체보기
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {loadingNews ? (
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-4">
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : news.length > 0 ? (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="divide-y divide-gray-100">
                {news.map((item, index) => (
                  <a
                    key={item.id}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-4 p-5 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-semibold text-gray-900 group-hover:text-red-600 transition-colors mb-2 line-clamp-2">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="font-medium">{item.source}</span>
                        <span>•</span>
                        <span>{item.timeAgo}</span>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-red-600 group-hover:translate-x-1 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow-md">
              <p className="text-gray-500 text-lg">표시할 속보가 없습니다.</p>
            </div>
          )}
        </section>

        {/* 오늘의 만평 미리보기 */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-3xl font-bold text-gray-900">
              🎨 오늘의 시사만평
            </h3>
            <Link 
              href="/cartoons"
              className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-2 group"
            >
              전체보기
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {loadingCartoons ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
                  <div className="h-64 bg-gray-200"></div>
                  <div className="p-5">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : cartoons.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {cartoons.map((cartoon, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  <div className="relative h-64 bg-gray-100">
                    {cartoon.imageUrl ? (
                      <Image
                        src={cartoon.imageUrl}
                        alt={cartoon.title}
                        fill
                        className="object-contain p-4"
                        sizes="(max-width: 768px) 100vw, 33vw"
                        priority={index === 0}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <h4 className="text-lg font-bold text-gray-800 mb-3 line-clamp-2 min-h-[3.5rem]">
                      {cartoon.title}
                    </h4>

                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        📰 {cartoon.source}
                      </span>

                      <a
                        href={cartoon.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1"
                      >
                        원문
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow-md">
              <p className="text-gray-500 text-lg">표시할 만평이 없습니다.</p>
            </div>
          )}
        </section>

        {/* 추가 기능 안내 */}
        <section className="bg-white rounded-lg shadow-md p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            더 많은 기능이 곧 추가됩니다!
          </h3>
          <p className="text-gray-600 mb-6">
            날씨, 환율 등 다양한 정보를 한곳에서 확인하세요.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <div className="px-6 py-3 bg-gray-100 rounded-lg">
              <span className="text-2xl">🌤️</span>
              <p className="text-sm text-gray-600 mt-1">날씨</p>
            </div>
            <div className="px-6 py-3 bg-gray-100 rounded-lg">
              <span className="text-2xl">💱</span>
              <p className="text-sm text-gray-600 mt-1">환율</p>
            </div>
            <div className="px-6 py-3 bg-gray-100 rounded-lg">
              <span className="text-2xl">📈</span>
              <p className="text-sm text-gray-600 mt-1">주식</p>
            </div>
          </div>
        </section>
      </main>

      {/* 푸터 */}
      <footer className="bg-white mt-16 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-gray-600">
          <p>© 2024 NewsFlash. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
