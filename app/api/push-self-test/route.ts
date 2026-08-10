import { NextResponse } from "next/server";
import {
  findOwnedSubscription,
  getVapidKeys,
} from "@/lib/push-storage";

export const dynamic = "force-dynamic";

/**
 * Sends one test push only to the caller's own subscription.
 * Requires endpoint + keys proof so it cannot spam other subscribers.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const subscription = body?.subscription;
    const endpoint = subscription?.endpoint as string | undefined;
    const keys = subscription?.keys as
      | { p256dh?: string; auth?: string }
      | undefined;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: "구독 endpoint와 keys(p256dh/auth)가 필요합니다." },
        { status: 400 },
      );
    }

    const owned = await findOwnedSubscription(endpoint, {
      p256dh: keys.p256dh,
      auth: keys.auth,
    });

    if (!owned) {
      return NextResponse.json(
        {
          error:
            "구독을 확인할 수 없습니다. iPhone 홈 화면 PWA에서 알림을 다시 연결해 주세요.",
        },
        { status: 403 },
      );
    }

    const webpush = require("web-push") as typeof import("web-push");
    const vapid = getVapidKeys();
    webpush.setVapidDetails(
      "mailto:admin@example.com",
      vapid.publicKey,
      vapid.privateKey,
    );

    await webpush.sendNotification(
      {
        endpoint: owned.endpoint,
        keys: owned.keys,
      },
      JSON.stringify({
        title: "NewsFlash 연결 테스트",
        body: "푸시 연결이 정상입니다. 알림을 탭하면 알림 안내판으로 이동합니다.",
        url: "/?view=alerts#recent-scheduled-alerts",
        view: "alerts",
        focus: "news",
      }),
    );

    return NextResponse.json({ success: true, sentCount: 1 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("푸시 자가 테스트 실패:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
