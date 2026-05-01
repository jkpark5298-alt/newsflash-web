'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type CommunitySourceFilter = '전체' | '클리앙' | '뽐뿌';

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

interface CommunityResponse {
  issues?: CommunityIssue[];
  totalCount?: number;
  sourceStats?: Record<string, number>;
  lastUpdated?: string;
  notice?: string;
  error?: string;
}

export default function CommunityPage() {
  const [issues, setIssues] = useState<CommunityIssue[]>([]);
  const [selectedSource, setSelectedSource] = useState<CommunitySourceFilter>('전체');
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [sourceStats, setSourceStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchCommunityIssues(isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const response = await fetch('/api/community', {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('커뮤니티 이슈를 불러오는데 실패했습니다.');
      }

      const data: CommunityResponse = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setIssues(data.issues || []);
      setLastUpdated(data.lastUpdated || new Date().toISOString());
      setSourceStats(data.sourceStats || {});
    } catch (err) {
      console.error('커뮤니티 이슈 로딩 에러:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchCommunityIssues();
  }, []);

  const filteredIssues = useMemo(() => {
    if (selectedSource === '전체') {
      return issues;
    }

    return issues.filter((issue) => issue.source === selectedSource);
  }, [issues, selectedSource]);

  const sourceButtons: CommunitySourceFilter[] = ['전체', '클리앙', '뽐뿌'];

  function getFormattedTime(dateString: string): string {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return '시간 정보 없음';
    }

    return date.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getSourceEmoji(source: string): string {
    if (source === '클리앙') {
      return '💬';
    }

    if (source === '뽐뿌') {
      return '🔥';
    }

    return '📄';
  }

  function getSourceBadgeClass(source: string): string {
    if (source === '클리앙') {
      return 'bg-orange-50 text-orange-700 border-orange-100';
    }

    if (source === '뽐뿌') {
      return 'bg-pink-50 text-pink-700 border-pink-100';
    }

    return 'bg-gray-50 text-gray-700 border-gray-100';
  }

  function toggleIssueDetail(issueId: string) {
    setExpandedIssueId((currentId) => (currentId === issueId ? null : issueId));
  }

  function getLastUpdatedText(): string {
    if (!lastUpdated) {
      return '';
    }

    const date = new Date(lastUpdated);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getFilterCount(source: CommunitySourceFilter): number {
    if (source === '전체') {
      return issues.length;
    }

    return sourceStats[source] || issues.filter((issue) => issue.source === source).length;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">커뮤니티 이슈를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full text-center">
          <p className="text-red-600 text-xl font-bold mb-3">⚠️ 커뮤니티 이슈 로딩 실패</p>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => fetchCommunityIssues(true)}
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
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
            >
              ← 홈으로
            </Link>

            <button
              onClick={() => fetchCommunityIssues(true)}
              disabled={refreshing}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-60 transition-colors text-sm font-medium"
            >
              {refreshing ? '새로고침 중...' : '새로고침'}
            </button>
          </div>

          <div className="mb-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">💬</span>
              <h1 className="text-3xl font-bold text-gray-800">커뮤니티 이슈 전체보기</h1>
            </div>
            <p className="text-sm text-gray-600">
              클리앙과 뽐뿌의 공개 게시글 기반 이슈입니다.
            </p>
            <p className="text-xs text-amber-700 mt-1">
              커뮤니티 이슈는 검증된 뉴스가 아니므로 원문에서 맥락을 확인하세요.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 mb-3 text-sm text-gray-500">
            <span>
              표시 중 <strong className="text-gray-900">{filteredIssues.length}</strong>개 /
              전체 <strong className="text-gray-900">{issues.length}</strong>개
            </span>
            {getLastUpdatedText() && <span>마지막 업데이트 {getLastUpdatedText()}</span>}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {sourceButtons.map((source) => (
              <button
                key={source}
                onClick={() => {
                  setSelectedSource(source);
                  setExpandedIssueId(null);
                }}
                className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all text-sm ${
                  selectedSource === source
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {source} {getFilterCount(source)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {filteredIssues.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredIssues.map((issue) => {
              const isExpanded = expandedIssueId === issue.id;

              return (
                <article
                  key={issue.id}
                  className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getSourceBadgeClass(
                        issue.source
                      )}`}
                    >
                      {getSourceEmoji(issue.source)} {issue.source}
                    </span>
                    <span className="text-gray-500 text-xs">{issue.category}</span>
                    <span className="text-gray-300 text-xs">·</span>
                    <span className="text-gray-400 text-xs">
                      {getFormattedTime(issue.pubDate)}
                    </span>
                  </div>

                  <h2 className="text-base md:text-lg font-bold text-gray-900 leading-snug mb-2">
                    {issue.title}
                  </h2>

                  <p className="text-sm text-gray-600 leading-relaxed mb-4">{issue.summary}</p>

                  {isExpanded && (
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 mb-4">
                      <p className="text-xs font-semibold text-amber-700 mb-2">세부내용</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{issue.detail}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggleIssueDetail(issue.id)}
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
          <div className="bg-white rounded-xl shadow-md p-10 text-center">
            <p className="text-gray-500">선택한 출처의 커뮤니티 이슈가 없습니다.</p>
          </div>
        )}
      </main>
    </div>
  );
}