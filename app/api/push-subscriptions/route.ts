import { NextResponse } from "next/server";
import {
  findOwnedSubscription,
  getPushStorageInfo,
  getSubscriptions,
  getVapidPublicKey,
  removeSubscription,
  upsertSubscription,
} from "@/lib/push-storage";
import { normalizeScheduledNewsHours } from "@/lib/alert-schedule";

export async function GET() {
  const subs = await getSubscriptions();
  const storage = getPushStorageInfo();

  let vapidPublicKey = "";
  try {
    vapidPublicKey = getVapidPublicKey();
  } catch (error) {
    console.error("VAPID public key unavailable:", error);
  }

  return NextResponse.json(
    {
      count: subs.length,
      vapidPublicKey,
      storage,
      cronSecretConfigured: Boolean(process.env.CRON_SECRET),
      pushReady:
        subs.length >= 1 &&
        (storage.postgresConfigured || storage.blobConfigured),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}

export async function POST(request: Request) {
  try {
    const {
      subscription,
      userAgent,
      alertEnabled,
      scheduledAlertEnabled,
      scheduledNewsHours,
      alertKeywords,
    } = await request.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: "올바르지 않은 구독 정보입니다." },
        { status: 400 },
      );
    }

    const p256dh = subscription.keys?.p256dh;
    const auth = subscription.keys?.auth;
    if (!p256dh || !auth || typeof p256dh !== "string" || typeof auth !== "string") {
      return NextResponse.json(
        {
          error:
            "구독 키(p256dh/auth)가 없습니다. iPhone PWA에서 다시 구독해 주세요.",
        },
        { status: 400 },
      );
    }

    const subscriptions = await upsertSubscription({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userAgent: userAgent || "",
      updatedAt: new Date().toISOString(),
      alertEnabled: alertEnabled ?? undefined,
      scheduledAlertEnabled: scheduledAlertEnabled ?? undefined,
      scheduledNewsHours: Array.isArray(scheduledNewsHours)
        ? normalizeScheduledNewsHours(scheduledNewsHours)
        : undefined,
      alertKeywords: Array.isArray(alertKeywords) ? alertKeywords : undefined,
    });

    return NextResponse.json({
      success: true,
      count: subscriptions.length,
      storage: getPushStorageInfo(),
    });
  } catch (error: unknown) {
    console.error("구독 등록 API 에러:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const suspended =
      /store has been suspended/i.test(message) ||
      /store is blocked/i.test(message) ||
      /BlobStoreSuspended/i.test(message);

    return NextResponse.json(
      {
        error: suspended
          ? "Vercel Blob 스토어가 정지되어 구독을 저장할 수 없습니다. Neon(DATABASE_URL) 연결 여부를 확인하세요."
          : "서버 처리 중 오류가 발생했습니다.",
        detail: message,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { endpoint, keys } = await request.json();

    if (!endpoint) {
      return NextResponse.json(
        { error: "endpoint가 존재하지 않습니다." },
        { status: 400 },
      );
    }

    if (!keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: "구독 keys(p256dh/auth)가 필요합니다." },
        { status: 400 },
      );
    }

    const owned = await findOwnedSubscription(endpoint, {
      p256dh: keys.p256dh,
      auth: keys.auth,
    });

    if (!owned) {
      return NextResponse.json(
        { error: "구독 소유권을 확인할 수 없습니다." },
        { status: 403 },
      );
    }

    const subscriptions = await removeSubscription(endpoint);

    return NextResponse.json({ success: true, count: subscriptions.length });
  } catch (error: unknown) {
    console.error("구독 삭제 API 에러:", error);
    return NextResponse.json(
      { error: "서버 처리 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
