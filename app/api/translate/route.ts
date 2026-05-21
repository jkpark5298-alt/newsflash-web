import { NextResponse } from 'next/server';

type TranslateRequest = {
  title?: string;
  description?: string;
  source?: string;
};

function cleanText(value?: string) {
  return (value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTemporaryTranslation(title: string, description: string, source?: string) {
  const sourceText = source ? `${source} 기사` : '외신 기사';

  return {
    titleKo: `[번역 연결 준비] ${title}`,
    summaryKo:
      description ||
      `${sourceText}의 원문 요약이 비어 있습니다. 실제 번역 엔진 연결 후 한국어 요약이 표시됩니다.`,
    notice:
      '현재 단계는 번역 UI와 API 연결 확인용입니다. 실제 번역 엔진은 다음 단계에서 연결합니다.',
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TranslateRequest;
    const title = cleanText(body.title);
    const description = cleanText(body.description);

    if (!title && !description) {
      return NextResponse.json(
        {
          error: '번역할 제목 또는 요약이 없습니다.',
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      ...buildTemporaryTranslation(title, description, body.source),
    });
  } catch (error) {
    console.error('번역 API 에러:', error);

    return NextResponse.json(
      {
        error: '번역을 처리하지 못했습니다.',
      },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
