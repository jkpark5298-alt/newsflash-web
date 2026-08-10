import { NextResponse } from "next/server";
import {
  getKstTimeParts,
  getPushStorageInfo,
  getSentSlots,
  getSubscriptions,
  getVapidPublicKey,
  hasSentSlot,
  isCronAuthorized,
} from "@/lib/push-storage";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { hours, timeStr, dateStr } = getKstTimeParts();
  const subscriptions = await getSubscriptions();
  const sentSlots = await getSentSlots();

  const storage = getPushStorageInfo();
  const subscriberCount = subscriptions.length;

  return NextResponse.json({
    kstTime: timeStr,
    kstDate: dateStr,
    storage,
    subscriberCount,
    scheduledEnabledCount: subscriptions.filter(
      (sub) => sub.scheduledAlertEnabled !== false,
    ).length,
    keywordEnabledCount: subscriptions.filter(
      (sub) => sub.alertEnabled && (sub.alertKeywords?.length ?? 0) > 0,
    ).length,
    vapidConfigured: Boolean(
      (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
        process.env.VAPID_PUBLIC_KEY) &&
        process.env.VAPID_PRIVATE_KEY,
    ),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET),
    currentHourSlot: `${String(hours).padStart(2, "0")}:00`,
    isNewsHour: [
      "07:00",
      "08:00",
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00",
      "21:00",
      "22:00",
      "23:00",
    ].includes(`${String(hours).padStart(2, "0")}:00`),
    isStockHour: ["07:00", "12:00", "16:00"].includes(
      `${String(hours).padStart(2, "0")}:00`,
    ),
    recentSentSlots: Object.entries(sentSlots).slice(-5),
    pushReady:
      subscriberCount >= 1 &&
      (storage.postgresConfigured || storage.blobConfigured),
    hint:
      subscriberCount === 0
        ? "등록된 푸시 구독자가 없습니다. iPhone 홈 화면 PWA에서 'iPhone 푸시 연결 + 테스트 발송'을 실행하세요."
        : undefined,
  });
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { timeStr, dateStr } = getKstTimeParts();
  const slotKey = `${dateStr}-${timeStr.slice(0, 2)}:00-news`;
  const alreadySent = await hasSentSlot(slotKey);

  return NextResponse.json({
    slotKey,
    alreadySent,
    vapidPublicKeyPrefix: getVapidPublicKey().slice(0, 12),
  });
}
