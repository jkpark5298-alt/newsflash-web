import { NextResponse } from "next/server";
import {
  getSubscriptions,
  getVapidPublicKey,
  removeSubscription,
  upsertSubscription,
} from "@/lib/push-storage";

export async function GET() {
  const subs = await getSubscriptions();

  return NextResponse.json({
    count: subs.length,
    vapidPublicKey: getVapidPublicKey(),
  });
}

export async function POST(request: Request) {
  try {
    const {
      subscription,
      userAgent,
      alertEnabled,
      scheduledAlertEnabled,
      alertKeywords,
    } = await request.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: "올바르지 않은 구독 정보입니다." },
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
      alertKeywords: Array.isArray(alertKeywords) ? alertKeywords : undefined,
    });

    return NextResponse.json({ success: true, count: subscriptions.length });
  } catch (error: unknown) {
    console.error("구독 등록 API 에러:", error);
    return NextResponse.json(
      { error: "서버 처리 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json(
        { error: "endpoint가 존재하지 않습니다." },
        { status: 400 },
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
