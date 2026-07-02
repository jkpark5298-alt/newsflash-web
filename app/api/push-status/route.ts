import { NextResponse } from "next/server";
import {
  getKstTimeParts,
  getPushStorageInfo,
  getSentSlots,
  getSubscriptions,
  getVapidPublicKey,
  hasSentSlot,
} from "@/lib/push-storage";

export async function GET() {
  const { hours, minutes, timeStr, dateStr } = getKstTimeParts();
  const subscriptions = await getSubscriptions();
  const sentSlots = await getSentSlots();

  return NextResponse.json({
    kstTime: timeStr,
    kstDate: dateStr,
    storage: getPushStorageInfo(),
    subscriberCount: subscriptions.length,
    scheduledEnabledCount: subscriptions.filter(
      (sub) => sub.scheduledAlertEnabled !== false,
    ).length,
    keywordEnabledCount: subscriptions.filter(
      (sub) => sub.alertEnabled && (sub.alertKeywords?.length ?? 0) > 0,
    ).length,
    vapidConfigured: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET),
    currentHourSlot: `${String(hours).padStart(2, "0")}:00`,
    isNewsHour: ["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00"].includes(`${String(hours).padStart(2, "0")}:00`),
    isStockHour: ["07:00","12:00","16:00"].includes(`${String(hours).padStart(2, "0")}:00`),
    recentSentSlots: Object.entries(sentSlots).slice(-5),
  });
}

export async function POST() {
  const { timeStr, dateStr } = getKstTimeParts();
  const slotKey = `${dateStr}-${timeStr.slice(0, 2)}:00-news`;
  const alreadySent = await hasSentSlot(slotKey);

  return NextResponse.json({
    slotKey,
    alreadySent,
    vapidPublicKeyPrefix: getVapidPublicKey().slice(0, 12),
  });
}
