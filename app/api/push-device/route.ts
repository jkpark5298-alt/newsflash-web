import { NextResponse } from "next/server";
import {
  findOwnedSubscription,
  getDeliveryStatus,
} from "@/lib/push-storage";
import { normalizeScheduledNewsHours } from "@/lib/alert-schedule";

export const dynamic = "force-dynamic";

/**
 * 이 기기(호출한 브라우저의 구독)가 서버에 등록돼 있는지와,
 * 서버에 저장된 이 기기의 설정·마지막 발송 결과를 돌려준다.
 * endpoint + keys로 본인 구독임을 증명해야 한다.
 */
export async function POST(request: Request) {
  try {
    const { endpoint, keys } = await request.json();
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
        { registered: false },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }

    const status = await getDeliveryStatus(endpoint);

    return NextResponse.json(
      {
        registered: true,
        settings: {
          alertEnabled: owned.alertEnabled === true,
          scheduledAlertEnabled: owned.scheduledAlertEnabled !== false,
          scheduledNewsHours: normalizeScheduledNewsHours(owned.scheduledNewsHours),
          alertKeywords: Array.isArray(owned.alertKeywords) ? owned.alertKeywords : [],
        },
        updatedAt: owned.updatedAt ?? null,
        status: status ?? null,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error: unknown) {
    console.error("기기 구독 확인 API 에러:", error);
    return NextResponse.json(
      { error: "서버 처리 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
