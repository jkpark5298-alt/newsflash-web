import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, "subscriptions.json");

// 로컬 파일 DB 안전 조회/생성 헬퍼
function getSubscriptions(): any[] {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SUBSCRIPTIONS_FILE)) {
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify([]));
    return [];
  }
  try {
    const content = fs.readFileSync(SUBSCRIPTIONS_FILE, "utf-8");
    return JSON.parse(content || "[]");
  } catch (e) {
    console.error("구독 정보 파싱 에러:", e);
    return [];
  }
}

// 로컬 파일 DB 저장 헬퍼
function saveSubscriptions(subscriptions: any[]) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2), "utf-8");
}

export async function GET() {
  const subs = getSubscriptions();
  
  const keysPath = path.join(DATA_DIR, "vapid-keys.json");
  let vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "";
  
  if (!vapidPublicKey && fs.existsSync(keysPath)) {
    try {
      const keys = JSON.parse(fs.readFileSync(keysPath, "utf-8"));
      vapidPublicKey = keys.publicKey;
    } catch (e) {}
  }

  return NextResponse.json({
    count: subs.length,
    vapidPublicKey: vapidPublicKey || "BEl62vD7sO-p_U7t-hR9x_JmO7z8v9q4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1"
  });
}

export async function POST(request: Request) {
  try {
    const { subscription, userAgent } = await request.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: "올바르지 않은 구독 정보입니다." }, { status: 400 });
    }

    const subscriptions = getSubscriptions();
    const existingIndex = subscriptions.findIndex((sub) => sub.endpoint === subscription.endpoint);

    const record = {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userAgent: userAgent || "",
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex > -1) {
      subscriptions[existingIndex] = record;
    } else {
      subscriptions.push(record);
    }

    saveSubscriptions(subscriptions);

    return NextResponse.json({ success: true, count: subscriptions.length });
  } catch (error: any) {
    console.error("구독 등록 API 에러:", error);
    return NextResponse.json({ error: "서버 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json({ error: "endpoint가 존재하지 않습니다." }, { status: 400 });
    }

    let subscriptions = getSubscriptions();
    const originalLength = subscriptions.length;
    subscriptions = subscriptions.filter((sub) => sub.endpoint !== endpoint);

    if (subscriptions.length !== originalLength) {
      saveSubscriptions(subscriptions);
    }

    return NextResponse.json({ success: true, count: subscriptions.length });
  } catch (error: any) {
    console.error("구독 삭제 API 에러:", error);
    return NextResponse.json({ error: "서버 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
