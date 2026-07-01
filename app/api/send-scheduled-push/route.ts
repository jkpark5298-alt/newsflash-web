import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

import os from "os";

// 환경에 따른 동적 경로 탐색 (Vercel Serverless 등 읽기 전용 대응)
function getStoragePaths() {
  const localDir = path.join(process.cwd(), "data");
  try {
    // 1. 로컬 디렉토리 테스트
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const testFile = path.join(localDir, ".write-test");
    fs.writeFileSync(testFile, "test");
    fs.unlinkSync(testFile);
    return {
      dir: localDir,
      subscriptions: path.join(localDir, "subscriptions.json"),
      vapidKeys: path.join(localDir, "vapid-keys.json"),
    };
  } catch (e) {
    // 2. 읽기 전용인 경우 OS 임시 디렉토리(/tmp 등)로 폴백
    const tmpDir = os.tmpdir();
    return {
      dir: tmpDir,
      subscriptions: path.join(tmpDir, "subscriptions.json"),
      vapidKeys: path.join(tmpDir, "vapid-keys.json"),
    };
  }
}

const paths = getStoragePaths();

// 동적으로 임메모리 VAPID 키 유지 헬퍼
let cachedVapidKeys: { publicKey: string; privateKey: string } | null = null;

function getVapidKeys() {
  if (cachedVapidKeys) return cachedVapidKeys;

  const envPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const envPrivate = process.env.VAPID_PRIVATE_KEY;

  if (envPublic && envPrivate) {
    cachedVapidKeys = { publicKey: envPublic, privateKey: envPrivate };
    return cachedVapidKeys;
  }

  const keysPath = paths.vapidKeys;
  if (fs.existsSync(keysPath)) {
    try {
      cachedVapidKeys = JSON.parse(fs.readFileSync(keysPath, "utf-8"));
      return cachedVapidKeys!;
    } catch (e) {}
  }

  // 100% 규격 검증된 최종 폴백 VAPID 키 지정 (Vercel Serverless Read-only 대응)
  cachedVapidKeys = {
    publicKey: "BEz2zU5aC4Y9I3db36cbfDTs9NIGU-MO519Z1uZ9otB6iVASbye7t2DRoAtyxDr_RboLiCafBwvhuJE16VuZRyA",
    privateKey: "CywyVvP9ZCWyqIqvYeR8UPmWTTwjh5YlihITsSTadq4"
  };

  try {
    if (!fs.existsSync(paths.dir)) {
      fs.mkdirSync(paths.dir, { recursive: true });
    }
    fs.writeFileSync(keysPath, JSON.stringify(cachedVapidKeys, null, 2), "utf-8");
  } catch (err) {}

  return cachedVapidKeys;
}

function getSubscriptions(): any[] {
  if (!fs.existsSync(paths.subscriptions)) return [];
  try {
    return JSON.parse(fs.readFileSync(paths.subscriptions, "utf-8") || "[]");
  } catch (e) {
    return [];
  }
}

function saveSubscriptions(subscriptions: any[]) {
  try {
    if (!fs.existsSync(paths.dir)) {
      fs.mkdirSync(paths.dir, { recursive: true });
    }
    fs.writeFileSync(paths.subscriptions, JSON.stringify(subscriptions, null, 2), "utf-8");
  } catch (e) {
    console.error("구독 파일 갱신 에러:", e);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";
    const test = searchParams.get("test") === "true";

    const now = new Date();
    // KST 시간 변환 (UTC + 9)
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(now.getTime() + kstOffset);
    const hours = kstDate.getUTCHours();
    const minutes = kstDate.getUTCMinutes();
    const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

    const newsHours = ["07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"];
    const stockHours = ["07:00", "12:00", "16:00"];

    const isNewsTime = newsHours.some(h => h.startsWith(String(hours).padStart(2, "0"))) && minutes === 0;
    const isStockTime = stockHours.some(h => h.startsWith(String(hours).padStart(2, "0"))) && minutes === 0;

    // 강제 발송 파라미터가 없거나 정시가 아니면 패스
    if (!force && !test && !isNewsTime && !isStockTime) {
      return NextResponse.json({
        message: `스케줄 시간이 아닙니다. 현재 KST: ${timeStr}`,
        kstTime: timeStr,
      });
    }

    const host = request.headers.get("host") || "localhost:3000";
    const protocol = host.startsWith("localhost") ? "http" : "https";

    // 1. 속보 데이터 조회
    let breakingNews: any[] = [];
    try {
      const newsRes = await fetch(`${protocol}://${host}/api/breaking`, { cache: "no-store" });
      if (newsRes.ok) {
        const newsData = await newsRes.json();
        breakingNews = Array.isArray(newsData.articles) ? newsData.articles : [];
      }
    } catch (e) {
      console.error("속보 데이터 조회 실패:", e);
    }

    // 2. 시장 데이터 조회
    let marketData: any[] = [];
    try {
      const marketRes = await fetch(`${protocol}://${host}/api/market`, { cache: "no-store" });
      if (marketRes.ok) {
        const marketResponseData = await marketRes.json();
        marketData = Array.isArray(marketResponseData.markets) ? marketResponseData.markets : [];
      }
    } catch (e) {
      console.error("시장 지표 데이터 조회 실패:", e);
    }

    // 발송할 알림 항목 취합
    const notificationsToSend: Array<{ title: string; body: string; tag: string }> = [];

    // 뉴스 알림 구성
    if (force || test || isNewsTime) {
      const top5 = breakingNews.slice(0, 5);
      if (top5.length > 0) {
        const title = `📰 [정기 뉴스 알림] ${hours}시 최신 뉴스 5선`;
        const body = top5.map((art, idx) => `${idx + 1}. ${art.title}`).join("\n");
        notificationsToSend.push({
          title,
          body,
          tag: `scheduled-news-${hours}`,
        });
      }
    }

    // 주가지수 알림 구성
    if (force || test || isStockTime) {
      let title = "";
      let body = "";

      const kospi = marketData.find(m => m.key === "kospi");
      const kosdaq = marketData.find(m => m.key === "kosdaq");

      if (hours === 7 || force || test) {
        // 아침 7시에는 전날 KOSPI & 미 증시
        title = `📊 [아침 증시 알림] 전일 KOSPI 및 미 증시 현황`;
        const usMarket = marketData.find(m => m.key === "us-market");
        body = [
          `· KOSPI: ${kospi?.value || "-"} (${kospi?.change || "-"})`,
          `· 미 증시 (DOW/NASDAQ/S&P500): ${usMarket?.value || "로딩 실패"}`
        ].join("\n");
      } else {
        // 12시, 16시 국내 증시
        title = `📊 [${hours}시 증시 알림] KOSPI · KOSDAQ 현황`;
        body = [
          `· KOSPI: ${kospi?.value || "-"} (${kospi?.change || "-"})`,
          `· KOSDAQ: ${kosdaq?.value || "-"} (${kosdaq?.change || "-"})`
        ].join("\n");
      }

      notificationsToSend.push({
        title,
        body,
        tag: `scheduled-stock-${hours}`,
      });
    }

    if (notificationsToSend.length === 0) {
      return NextResponse.json({ message: "발송할 알림 데이터가 없습니다." });
    }

    // web-push 라이브러리를 동적으로 로드 및 VAPID 설정
    const webpush = require("web-push");
    const vapid = getVapidKeys();

    webpush.setVapidDetails(
      "mailto:admin@example.com",
      vapid.publicKey,
      vapid.privateKey
    );

    const subscriptions = getSubscriptions();
    let failedEndpoints: string[] = [];

    // 전송 루프 실행
    for (const sub of subscriptions) {
      for (const alert of notificationsToSend) {
        try {
          const payload = JSON.stringify({
            title: alert.title,
            body: alert.body,
            url: "/#detail-view-section",
          });

          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys,
            },
            payload
          );
        } catch (error: any) {
          console.error(`푸시 전송 실패 (${sub.endpoint}):`, error);
          // 410 Gone / 404 Not Found 는 만료된 구독이므로 삭제 리스트에 누적
          if (error.statusCode === 410 || error.statusCode === 404) {
            failedEndpoints.push(sub.endpoint);
          }
        }
      }
    }

    // 만료된 구독 DB 정리
    if (failedEndpoints.length > 0) {
      const updated = subscriptions.filter(s => !failedEndpoints.includes(s.endpoint));
      saveSubscriptions(updated);
    }

    return NextResponse.json({
      success: true,
      sentCount: subscriptions.length - failedEndpoints.length,
      failedCleanedCount: failedEndpoints.length,
      notificationsSent: notificationsToSend.map(n => n.title),
    });
  } catch (error: any) {
    console.error("정기 푸시 API 글로벌 에러:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
