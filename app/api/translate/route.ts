import { NextResponse } from 'next/server';

type TranslateRequest = {
  title?: string;
  description?: string;
  source?: string;
};

type LibreTranslateResponse = {
  translatedText?: string;
  error?: string;
};

type MyMemoryResponse = {
  responseData?: {
    translatedText?: string;
  };
  responseStatus?: number;
  responseDetails?: string;
};

const LIBRETRANSLATE_BASE_URL =
  process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com';
const LIBRETRANSLATE_API_KEY = process.env.LIBRETRANSLATE_API_KEY || '';
const TRANSLATE_SOURCE_LANG = process.env.TRANSLATE_SOURCE_LANG || 'en';
const TRANSLATE_TARGET_LANG = process.env.TRANSLATE_TARGET_LANG || 'ko';
const TRANSLATE_TIMEOUT_MS = 15000;
const MAX_TRANSLATE_CHARS = 1200;

function cleanText(value?: string) {
  return (value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function limitText(value: string) {
  if (value.length <= MAX_TRANSLATE_CHARS) {
    return value;
  }

  return `${value.slice(0, MAX_TRANSLATE_CHARS).trim()}...`;
}

function getBaseUrl(url: string) {
  return url.replace(/\/+$/, '');
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = TRANSLATE_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function translateWithLibreTranslate(text: string) {
  const payload: Record<string, string> = {
    q: limitText(text),
    source: TRANSLATE_SOURCE_LANG,
    target: TRANSLATE_TARGET_LANG,
    format: 'text',
  };

  if (LIBRETRANSLATE_API_KEY) {
    payload.api_key = LIBRETRANSLATE_API_KEY;
  }

  const response = await fetchWithTimeout(
    `${getBaseUrl(LIBRETRANSLATE_BASE_URL)}/translate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    throw new Error(`LibreTranslate 응답 오류: ${response.status}`);
  }

  const data = (await response.json()) as LibreTranslateResponse;

  if (!data.translatedText) {
    throw new Error(data.error || 'LibreTranslate 번역 결과가 없습니다.');
  }

  return data.translatedText.trim();
}

async function translateWithMyMemory(text: string) {
  const query = new URLSearchParams({
    q: limitText(text).slice(0, 900),
    langpair: `${TRANSLATE_SOURCE_LANG}|${TRANSLATE_TARGET_LANG}`,
  });

  const response = await fetchWithTimeout(
    `https://api.mymemory.translated.net/get?${query.toString()}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    },
    12000,
  );

  if (!response.ok) {
    throw new Error(`MyMemory 응답 오류: ${response.status}`);
  }

  const data = (await response.json()) as MyMemoryResponse;
  const translatedText = data.responseData?.translatedText;

  if (!translatedText) {
    throw new Error(data.responseDetails || 'MyMemory 번역 결과가 없습니다.');
  }

  return translatedText.trim();
}

async function translateText(text: string) {
  if (!text) {
    return {
      translatedText: '',
      provider: 'none',
    };
  }

  try {
    return {
      translatedText: await translateWithLibreTranslate(text),
      provider: 'LibreTranslate',
    };
  } catch (libreError) {
    console.warn('LibreTranslate 번역 실패, MyMemory로 재시도:', libreError);

    try {
      return {
        translatedText: await translateWithMyMemory(text),
        provider: 'MyMemory',
      };
    } catch (myMemoryError) {
      console.error('MyMemory 번역 실패:', myMemoryError);
      throw libreError;
    }
  }
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

    const [titleResult, summaryResult] = await Promise.all([
      translateText(title),
      translateText(description),
    ]);

    const provider =
      titleResult.provider !== 'none'
        ? titleResult.provider
        : summaryResult.provider;

    return NextResponse.json({
      success: true,
      titleKo: titleResult.translatedText || title,
      summaryKo: summaryResult.translatedText || description,
      provider,
      notice:
        provider === 'LibreTranslate'
          ? 'LibreTranslate 무료/오픈소스 번역 API로 번역했습니다.'
          : 'LibreTranslate 연결이 불안정해 MyMemory 무료 번역 API로 대신 번역했습니다.',
    });
  } catch (error) {
    console.error('번역 API 오류:', error);

    return NextResponse.json(
      {
        error:
          '번역을 처리하지 못했습니다. 무료 번역 서버가 일시적으로 느리거나 응답하지 않을 수 있습니다.',
      },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';