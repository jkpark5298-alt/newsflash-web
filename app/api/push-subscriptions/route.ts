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

// 로컬 파일 DB 안전 조회/생성 헬퍼
function getSubscriptions(): any[] {
  if (!fs.existsSync(paths.dir)) {
    fs.mkdirSync(paths.dir, { recursive: true });
  }
  if (!fs.existsSync(paths.subscriptions)) {
    try {
      fs.writeFileSync(paths.subscriptions, JSON.stringify([]));
    } catch (e) {
      console.error("구독 파일 초기화 실패:", e);
    }
    return [];
  }
  try {
    const content = fs.readFileSync(paths.subscriptions, "utf-8");
    return JSON.parse(content || "[]");
  } catch (e) {
    console.error("구독 정보 파싱 에러:", e);
    return [];
  }
}

// 로컬 파일 DB 저장 헬퍼
function saveSubscriptions(subscriptions: any[]) {
  if (!fs.existsSync(paths.dir)) {
    fs.mkdirSync(paths.dir, { recursive: true });
  }
  fs.writeFileSync(paths.subscriptions, JSON.stringify(subscriptions, null, 2), "utf-8");
}

export async function GET() {
  const subs = getSubscriptions();
  
  const keysPath = paths.vapidKeys;
  let vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "";
  
  if (!vapidPublicKey && fs.existsSync(keysPath)) {
    try {
      const keys = JSON.parse(fs.readFileSync(keysPath, "utf-8"));
      vapidPublicKey = keys.publicKey;
    } catch (e) {}
  }

  return NextResponse.json({
    count: subs.length,
    vapidPublicKey: vapidPublicKey || "BEz2zU5aC4Y9I3db36cbfDTs9NIGU-MO519Z1uZ9otB6iVASbye7t2DRoAtyxDr_RboLiCafBwvhuJE16VuZRyA"
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
