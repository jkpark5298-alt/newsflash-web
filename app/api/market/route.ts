import { NextResponse } from 'next/server';

type MarketKey = 'kospi' | 'kosdaq' | 'usdkrw' | 'us-market' | 'rates';
type MarketStatus = 'ok' | 'delay' | 'error';

type MarketDetail = {
  label: string;
  value: string;
  changeRate: string;
  trend: number[];
};

type MarketItem = {
  key: MarketKey;
  label: string;
  symbol: string;
  value: string;
  change: string;
  changeRate: string;
  status: MarketStatus;
  description: string;
  trend: number[];
  details?: MarketDetail[];
};

type MarketTarget = {
  key: MarketKey;
  label: string;
  symbol: string;
  description: string;
};

type YahooChartResult = {
  meta?: {
    regularMarketPrice?: number;
    chartPreviousClose?: number;
    regularMarketPreviousClose?: number;
    currency?: string;
  };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      close?: Array<number | null>;
    }>;
  };
};

const PRIMARY_MARKET_TARGETS: MarketTarget[] = [
  {
    key: 'kospi',
    label: 'KOSPI',
    symbol: '^KS11',
    description: '코스피 지수',
  },
  {
    key: 'kosdaq',
    label: 'KOSDAQ',
    symbol: '^KQ11',
    description: '코스닥 지수',
  },
  {
    key: 'usdkrw',
    label: 'USD/KRW',
    symbol: 'KRW=X',
    description: '원/달러 환율',
  },
];

const US_MARKET_TARGETS = [
  {
    label: 'DOW',
    symbol: '^DJI',
  },
  {
    label: 'NASDAQ',
    symbol: '^IXIC',
  },
  {
    label: 'S&P500',
    symbol: '^GSPC',
  },
];

function formatNumber(value: number, fractionDigits = 2) {
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function getLatestClose(result: YahooChartResult) {
  const closeList = result.indicators?.quote?.[0]?.close ?? [];
  const validCloses = closeList.filter((value): value is number => typeof value === 'number');
  return validCloses.at(-1);
}

function getTrendValues(result?: YahooChartResult) {
  const closeList = result?.indicators?.quote?.[0]?.close ?? [];
  const validCloses = closeList.filter((value): value is number => typeof value === 'number');

  if (validCloses.length < 2) {
    return [];
  }

  return validCloses.slice(-18).map((value) => Number(value.toFixed(4)));
}

function buildDelayItem(target: MarketTarget): MarketItem {
  return {
    key: target.key,
    label: target.label,
    symbol: target.symbol,
    value: '준비 중',
    change: '-',
    changeRate: '-',
    status: 'delay',
    description: target.description,
    trend: [],
  };
}

function buildMarketItem(target: MarketTarget, result?: YahooChartResult): MarketItem {
  const current = result?.meta?.regularMarketPrice ?? getLatestClose(result ?? {});
  const previous = result?.meta?.regularMarketPreviousClose ?? result?.meta?.chartPreviousClose;

  if (typeof current !== 'number' || typeof previous !== 'number' || previous === 0) {
    return buildDelayItem(target);
  }

  const change = current - previous;
  const changeRate = (change / previous) * 100;
  const sign = change > 0 ? '+' : '';

  return {
    key: target.key,
    label: target.label,
    symbol: target.symbol,
    value: formatNumber(current),
    change: `${sign}${formatNumber(change)}`,
    changeRate: `${sign}${formatNumber(changeRate)}%`,
    status: 'ok',
    description: target.description,
    trend: getTrendValues(result),
  };
}

async function fetchYahooChart(symbol: string) {
  const encodedSymbol = encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?range=1d&interval=5m`;

  const response = await fetch(url, {
    next: { revalidate: 60 },
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 NewsFlash Market Monitor',
    },
  });

  if (!response.ok) {
    throw new Error(`Market fetch failed: ${symbol} ${response.status}`);
  }

  const data = await response.json();
  return data?.chart?.result?.[0] as YahooChartResult | undefined;
}

async function fetchPrimaryMarkets() {
  const results = await Promise.allSettled(
    PRIMARY_MARKET_TARGETS.map(async (target) => {
      const result = await fetchYahooChart(target.symbol);
      return buildMarketItem(target, result);
    }),
  );

  return results.map((result, index) => {
    const target = PRIMARY_MARKET_TARGETS[index];

    if (result.status === 'fulfilled') {
      return result.value;
    }

    return buildDelayItem(target);
  });
}

async function fetchUsMarketSummary(): Promise<MarketItem> {
  const results = await Promise.allSettled(
    US_MARKET_TARGETS.map(async (target) => {
      const result = await fetchYahooChart(target.symbol);
      const current = result?.meta?.regularMarketPrice ?? getLatestClose(result ?? {});
      const previous = result?.meta?.regularMarketPreviousClose ?? result?.meta?.chartPreviousClose;

      if (typeof current !== 'number' || typeof previous !== 'number' || previous === 0) {
        return null;
      }

      const changeRate = ((current - previous) / previous) * 100;
      const sign = changeRate > 0 ? '+' : '';

      return {
        label: target.label,
        symbol: target.symbol,
        value: formatNumber(current),
        changeRate: `${sign}${formatNumber(changeRate)}%`,
        trend: getTrendValues(result),
      };
    }),
  );

  const usMarkets = results
    .map((result) => (result.status === 'fulfilled' ? result.value : null))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (usMarkets.length === 0) {
    return {
      key: 'us-market',
      label: '미국 증시',
      symbol: '^DJI,^IXIC,^GSPC',
      value: '준비 중',
      change: '-',
      changeRate: '-',
      status: 'delay',
      description: 'DOW · NASDAQ · S&P500',
      trend: [],
      details: [],
    };
  }

  const dow = usMarkets.find((item) => item.label === 'DOW');
  const nasdaq = usMarkets.find((item) => item.label === 'NASDAQ');
  const sp500 = usMarkets.find((item) => item.label === 'S&P500');

  return {
    key: 'us-market',
    label: '미국 증시',
    symbol: '^DJI,^IXIC,^GSPC',
    value: dow ? `DOW ${dow.value}` : 'DOW 확인 중',
    change: [
      nasdaq ? `NASDAQ ${nasdaq.value}` : null,
      sp500 ? `S&P500 ${sp500.value}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || '-',
    changeRate: [
      dow ? `DOW ${dow.changeRate}` : null,
      nasdaq ? `NASDAQ ${nasdaq.changeRate}` : null,
      sp500 ? `S&P500 ${sp500.changeRate}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || '-',
    status: 'ok',
    description: 'DOW · NASDAQ · S&P500',
    trend: dow?.trend ?? [],
    details: usMarkets.map((item) => ({
      label: item.label,
      value: item.value,
      changeRate: item.changeRate,
      trend: item.trend,
    })),
  };
}

function buildRatesItem(): MarketItem {
  return {
    key: 'rates',
    label: '금리',
    symbol: 'FED/BOK/DGS10',
    value: '미국 3.50~3.75%',
    change: '한국 2.50% · 미국 10년물 4.42%',
    changeRate: '1차 고정값',
    status: 'ok',
    description: '미국 기준금리 · 한국 기준금리 · 미국 10년물',
    trend: [],
    details: [
      {
        label: '미국 기준금리',
        value: '3.50~3.75%',
        changeRate: '정책금리',
        trend: [],
      },
      {
        label: '한국 기준금리',
        value: '2.50%',
        changeRate: '정책금리',
        trend: [],
      },
      {
        label: '미국 10년물',
        value: '4.42%',
        changeRate: '1차 고정값',
        trend: [],
      },
    ],
  };
}

export async function GET() {
  const fetchedAt = new Date().toISOString();
  const primaryMarkets = await fetchPrimaryMarkets();
  const usMarket = await fetchUsMarketSummary();
  const rates = buildRatesItem();

  return NextResponse.json({
    success: true,
    fetchedAt,
    source: 'Yahoo Finance chart endpoint',
    note: '시장 데이터는 지연되거나 일시적으로 제공되지 않을 수 있습니다.',
    markets: [...primaryMarkets, usMarket, rates],
  });
}