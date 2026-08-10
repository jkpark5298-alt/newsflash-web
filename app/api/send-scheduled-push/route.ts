import { NextResponse } from "next/server";
import {
  getKstTimeParts,
  getPushStorageInfo,
  getSubscriptions,
  getVapidKeys,
  hasSentSlot,
  isCronAuthorized,
  markSentSlot,
  matchesKeyword,
  saveSubscriptions,
  type PushSubscriptionRecord,
} from "@/lib/push-storage";
import { NEWS_HOURS, STOCK_HOURS } from "@/lib/alert-schedule";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type NotificationPayload = {
  title: string;
  body: string;
  tag: string;
  url?: string;
  slotKey?: string;
  view?: "alerts";
  focus?: "news" | "stock" | "keyword";
  articles?: Array<{ title?: string; link?: string; description?: string; source?: string }>;
};

const ALERT_BOARD_NEWS_URL = "/?view=alerts&focus=news#recent-scheduled-alerts";
const ALERT_BOARD_STOCK_URL = "/?view=alerts&focus=stock#recent-scheduled-alerts";
const ALERT_BOARD_URL = "/?view=alerts#recent-scheduled-alerts";

async function buildScheduledNotifications(
  force: boolean,
  test: boolean,
  hours: number,
  minutes: number,
  dateStr: string,
  breakingNews: Array<{
    title?: string;
    link?: string;
    description?: string;
    source?: string;
  }>,
  marketData: Array<{ key?: string; value?: string; change?: string }>,
): Promise<NotificationPayload[]> {
  const notifications: NotificationPayload[] = [];
  const hourSlot = `${String(hours).padStart(2, "0")}:00`;
  const isNewsTime = NEWS_HOURS.includes(hourSlot);
  const isStockTime = STOCK_HOURS.includes(hourSlot);

  if (force || test || isNewsTime) {
    const slotKey = `${dateStr}-${hourSlot}-news`;
    const alreadySent = !force && !test && (await hasSentSlot(slotKey));

    if (!alreadySent) {
      const top5 = breakingNews.slice(0, 5);
      if (top5.length > 0) {
        notifications.push({
          title: `📰 [정기 뉴스 알림] ${hours}시 최신 뉴스 5선`,
          body: top5
            .map((art, idx) => `${idx + 1}. ${art.title || "제목 없음"}`)
            .join("\n"),
          tag: `scheduled-news-${hours}`,
          url: ALERT_BOARD_NEWS_URL,
          view: "alerts",
          focus: "news",
          articles: top5.map((art) => ({
            title: art.title,
            link: art.link,
            description: art.description,
            source: art.source,
          })),
          slotKey,
        });
      }
    }
  }

  if (force || test || isStockTime) {
    const slotKey = `${dateStr}-${hourSlot}-stock`;
    const alreadySent = !force && !test && (await hasSentSlot(slotKey));

    if (!alreadySent) {
      const kospi = marketData.find((m) => m.key === "kospi");
      const kosdaq = marketData.find((m) => m.key === "kosdaq");
      const usMarket = marketData.find((m) => m.key === "us-market");

      if (hours === 7 || force || test) {
        notifications.push({
          title: "📊 [아침 증시 알림] 전일 KOSPI 및 미 증시 현황",
          body: [
            `· KOSPI: ${kospi?.value || "-"} (${kospi?.change || "-"})`,
            `· 미 증시 (DOW/NASDAQ/S&P500): ${usMarket?.value || "로딩 실패"}`,
          ].join("\n"),
          tag: `scheduled-stock-${hours}`,
          url: ALERT_BOARD_STOCK_URL,
          view: "alerts",
          focus: "stock",
          slotKey,
        });
      } else {
        notifications.push({
          title: `📊 [${hours}시 증시 알림] KOSPI · KOSDAQ 현황`,
          body: [
            `· KOSPI: ${kospi?.value || "-"} (${kospi?.change || "-"})`,
            `· KOSDAQ: ${kosdaq?.value || "-"} (${kosdaq?.change || "-"})`,
          ].join("\n"),
          tag: `scheduled-stock-${hours}`,
          url: ALERT_BOARD_STOCK_URL,
          view: "alerts",
          focus: "stock",
          slotKey,
        });
      }
    }
  }

  return notifications;
}

function buildKeywordNotifications(
  subscription: PushSubscriptionRecord,
  breakingNews: Array<{
    title?: string;
    description?: string;
    link?: string;
  }>,
): { notifications: NotificationPayload[]; seenLinks: string[] } {
  if (!subscription.alertEnabled || !subscription.alertKeywords?.length) {
    return {
      notifications: [],
      seenLinks: subscription.seenArticleLinks || [],
    };
  }

  const seenLinks = new Set(subscription.seenArticleLinks || []);
  const notifications: NotificationPayload[] = [];

  for (const article of breakingNews) {
    const link = article.link || article.title || "";
    if (!link || seenLinks.has(link)) continue;

    const textToSearch = `${article.title || ""} ${article.description || ""}`;
    const matchedKeyword = subscription.alertKeywords.find((keyword) =>
      matchesKeyword(textToSearch, keyword),
    );

    if (!matchedKeyword) continue;

    seenLinks.add(link);
    notifications.push({
      title: `🚨 [속보 알림: ${matchedKeyword}] ${article.title || "새 속보"}`,
      body: article.description || "자세한 내용은 클릭하여 확인하세요.",
      tag: link,
      url: article.link || ALERT_BOARD_URL,
    });
  }

  return {
    notifications,
    seenLinks: Array.from(seenLinks).slice(-200),
  };
}

export async function GET(request: Request) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";
    const test = searchParams.get("test") === "true";

    const { hours, minutes, timeStr, dateStr } = getKstTimeParts();
    const hourSlot = `${String(hours).padStart(2, "0")}:00`;
    const isNewsTime = NEWS_HOURS.includes(hourSlot);
    const isStockTime = STOCK_HOURS.includes(hourSlot);
    const shouldSendScheduled = force || test || isNewsTime || isStockTime;

    const subscriptions = await getSubscriptions();
    if (subscriptions.length === 0) {
      return NextResponse.json({
        message:
          "등록된 푸시 구독자가 없습니다. iPhone 홈 화면 PWA에서 알림을 다시 켜 주세요.",
        kstTime: timeStr,
        storage: getPushStorageInfo(),
      });
    }

    const hasKeywordSubscribers = subscriptions.some(
      (sub) => sub.alertEnabled && (sub.alertKeywords?.length ?? 0) > 0,
    );

    if (!shouldSendScheduled && !hasKeywordSubscribers) {
      return NextResponse.json({
        message: `스케줄 시간이 아니며 키워드 구독자도 없습니다. 현재 KST: ${timeStr}`,
        kstTime: timeStr,
        hourSlot,
      });
    }

    const host = request.headers.get("host") || "localhost:3000";
    const protocol = host.startsWith("localhost") ? "http" : "https";

    let breakingNews: Array<{
      title?: string;
      description?: string;
      link?: string;
    }> = [];

    if (shouldSendScheduled || hasKeywordSubscribers) {
      try {
        const newsRes = await fetch(`${protocol}://${host}/api/breaking`, {
          cache: "no-store",
        });
        if (newsRes.ok) {
          const newsData = await newsRes.json();
          breakingNews = Array.isArray(newsData.articles) ? newsData.articles : [];
        }
      } catch (error) {
        console.error("속보 데이터 조회 실패:", error);
      }
    }

    let marketData: Array<{ key?: string; value?: string; change?: string }> = [];
    if (shouldSendScheduled) {
      try {
        const marketRes = await fetch(`${protocol}://${host}/api/market`, {
          cache: "no-store",
        });
        if (marketRes.ok) {
          const marketResponseData = await marketRes.json();
          marketData = Array.isArray(marketResponseData.markets)
            ? marketResponseData.markets
            : [];
        }
      } catch (error) {
        console.error("시장 지표 데이터 조회 실패:", error);
      }
    }

    const scheduledNotifications = shouldSendScheduled
      ? await buildScheduledNotifications(
          force,
          test,
          hours,
          minutes,
          dateStr,
          breakingNews,
          marketData,
        )
      : [];

    const perSubscriptionNotifications: Array<{
      sub: PushSubscriptionRecord;
      notifications: NotificationPayload[];
      seenLinks?: string[];
    }> = [];

    for (const sub of subscriptions) {
      const notifications: NotificationPayload[] = [];

      if (sub.scheduledAlertEnabled !== false) {
        notifications.push(...scheduledNotifications);
      }

      const keywordResult = buildKeywordNotifications(sub, breakingNews);
      notifications.push(...keywordResult.notifications);

      if (notifications.length > 0) {
        perSubscriptionNotifications.push({
          sub,
          notifications,
          seenLinks: keywordResult.seenLinks,
        });
      }
    }

    if (perSubscriptionNotifications.length === 0) {
      return NextResponse.json({
        message: "발송할 알림 데이터가 없습니다.",
        kstTime: timeStr,
        hourSlot,
        breakingNewsCount: breakingNews.length,
      });
    }

    let sentCount = 0;
    const failedEndpoints: string[] = [];
    const errorsList: Array<{
      endpoint: string;
      statusCode?: number;
      message?: string;
    }> = [];
    const updatedSubscriptions = [...subscriptions];
    const sentSlotKeys = new Set<string>();

    const webpush = require("web-push");
    const vapid = getVapidKeys();
    webpush.setVapidDetails(
      "mailto:admin@example.com",
      vapid.publicKey,
      vapid.privateKey,
    );

    for (const item of perSubscriptionNotifications) {
      for (const alert of item.notifications) {
        try {
          await webpush.sendNotification(
            {
              endpoint: item.sub.endpoint,
              keys: item.sub.keys,
            },
            JSON.stringify({
              title: alert.title,
              body: alert.body,
              url: alert.url || ALERT_BOARD_URL,
              view: alert.view || "alerts",
              focus: alert.focus,
              articles: alert.articles,
            }),
          );
          sentCount++;
          if (alert.slotKey) {
            sentSlotKeys.add(alert.slotKey);
          }
        } catch (error: unknown) {
          const pushError = error as { statusCode?: number; message?: string };
          console.error(`푸시 전송 실패 (${item.sub.endpoint}):`, pushError);
          errorsList.push({
            endpoint: `${item.sub.endpoint.substring(0, 40)}...`,
            statusCode: pushError.statusCode,
            message: pushError.message,
          });
          if (pushError.statusCode === 410 || pushError.statusCode === 404) {
            failedEndpoints.push(item.sub.endpoint);
          }
        }
      }

      if (item.seenLinks) {
        const index = updatedSubscriptions.findIndex(
          (sub) => sub.endpoint === item.sub.endpoint,
        );
        if (index > -1) {
          updatedSubscriptions[index] = {
            ...updatedSubscriptions[index],
            seenArticleLinks: item.seenLinks,
          };
        }
      }
    }

    for (const slotKey of sentSlotKeys) {
      await markSentSlot(slotKey);
    }

    if (failedEndpoints.length > 0) {
      await saveSubscriptions(
        updatedSubscriptions.filter(
          (sub) => !failedEndpoints.includes(sub.endpoint),
        ),
      );
    } else {
      await saveSubscriptions(updatedSubscriptions);
    }

    return NextResponse.json({
      success: true,
      sentCount,
      failedCleanedCount: failedEndpoints.length,
      subscriberCount: subscriptions.length,
      kstTime: timeStr,
      hourSlot,
      storage: getPushStorageInfo(),
      notificationsSent: [
        ...new Set(
          perSubscriptionNotifications.flatMap((item) =>
            item.notifications.map((notification) => notification.title),
          ),
        ),
      ],
      errors: errorsList.length > 0 ? errorsList : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("정기 푸시 API 글로벌 에러:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
