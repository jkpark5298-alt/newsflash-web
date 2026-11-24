import { NextResponse } from "next/server";
import {
  findOwnedSubscription,
  updateSubscriptionSettings,
} from "@/lib/push-storage";
import { normalizeScheduledNewsHours } from "@/lib/alert-schedule";

export async function POST(request: Request) {
  try {
    const {
      endpoint,
      keys,
      alertEnabled,
      scheduledAlertEnabled,
      scheduledNewsHours,
      alertKeywords,
    } = await request.json();

    if (!endpoint) {
      return NextResponse.json(
        { error: "endpoint가 필요합니다." },
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
        {
          error:
            "구독 소유권을 확인할 수 없습니다. 알림을 다시 켜 주세요.",
        },
        { status: 403 },
      );
    }

    // 이 기기의 칸만 바꾼다. (다른 기기·크론 기록은 건드리지 않음)
    const updated = await updateSubscriptionSettings(endpoint, {
      alertEnabled: typeof alertEnabled === "boolean" ? alertEnabled : undefined,
      scheduledAlertEnabled:
        typeof scheduledAlertEnabled === "boolean" ? scheduledAlertEnabled : undefined,
      scheduledNewsHours: Array.isArray(scheduledNewsHours)
        ? normalizeScheduledNewsHours(scheduledNewsHours)
        : undefined,
      alertKeywords: Array.isArray(alertKeywords) ? alertKeywords : undefined,
    });

    if (!updated) {
      return NextResponse.json(
        {
          error:
            "등록된 푸시 구독을 찾을 수 없습니다. 알림을 다시 켜 주세요.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("알림 설정 동기화 API 에러:", error);
    return NextResponse.json(
      { error: "서버 처리 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
