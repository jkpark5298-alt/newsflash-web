import fs from "fs";
import os from "os";
import path from "path";
import { get, list, put } from "@vercel/blob";

export type PushSubscriptionRecord = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
  updatedAt?: string;
  alertEnabled?: boolean;
  scheduledAlertEnabled?: boolean;
  alertKeywords?: string[];
  seenArticleLinks?: string[];
};

type VapidKeys = { publicKey: string; privateKey: string };

const SUBSCRIPTIONS_BLOB_PATH = "push/subscriptions.json";
const SENT_SLOTS_BLOB_PATH = "push/sent-slots.json";

let cachedVapidKeys: VapidKeys | null = null;

function getStoragePaths() {
  const localDir = path.join(process.cwd(), "data");
  try {
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
      sentSlots: path.join(localDir, "sent-slots.json"),
    };
  } catch {
    const tmpDir = os.tmpdir();
    return {
      dir: tmpDir,
      subscriptions: path.join(tmpDir, "subscriptions.json"),
      vapidKeys: path.join(tmpDir, "vapid-keys.json"),
      sentSlots: path.join(tmpDir, "sent-slots.json"),
    };
  }
}

const paths = getStoragePaths();

const FALLBACK_VAPID: VapidKeys = {
  publicKey:
    "BEz2zU5aC4Y9I3db36cbfDTs9NIGU-MO519Z1uZ9otB6iVASbye7t2DRoAtyxDr_RboLiCafBwvhuJE16VuZRyA",
  privateKey: "CywyVvP9ZCWyqIqvYeR8UPmWTTwjh5YlihITsSTadq4",
};

function getBlobToken(): string | undefined {
  return (
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN ||
    undefined
  );
}

function useBlobStorage() {
  return Boolean(getBlobToken());
}

function isVercelRuntime() {
  return process.env.VERCEL === "1";
}

function getBlobClientOptions() {
  const token = getBlobToken();
  return token ? { token } : undefined;
}

async function readBlobJson<T>(blobPath: string, fallback: T): Promise<T> {
  if (!useBlobStorage()) return fallback;

  const options = getBlobClientOptions();

  try {
    const result = await get(blobPath, {
      access: "private",
      ...options,
    });

    if (result?.statusCode === 200 && result.stream) {
      const text = await new Response(result.stream).text();
      if (text.trim()) {
        return JSON.parse(text) as T;
      }
    }
  } catch (error) {
    console.error(`Blob get 실패 (${blobPath}):`, error);
  }

  try {
    const folderPrefix = blobPath.includes("/")
      ? `${blobPath.slice(0, blobPath.lastIndexOf("/") + 1)}`
      : "";

    const listResults = await Promise.all([
      list({ prefix: blobPath, limit: 5, ...options }),
      folderPrefix
        ? list({ prefix: folderPrefix, limit: 20, ...options })
        : Promise.resolve({ blobs: [] as Awaited<ReturnType<typeof list>>["blobs"] }),
    ]);

    const blob =
      listResults
        .flatMap((result) => result.blobs)
        .find((item) => item.pathname === blobPath) ??
      listResults[0].blobs[0];

    if (!blob?.url) return fallback;

    const response = await fetch(blob.url, { cache: "no-store" });
    if (!response.ok) return fallback;
    return (await response.json()) as T;
  } catch (error) {
    console.error(`Blob 읽기 실패 (${blobPath}):`, error);
    return fallback;
  }
}

async function writeBlobJson(blobPath: string, data: unknown) {
  if (!useBlobStorage()) {
    if (isVercelRuntime()) {
      throw new Error(
        "Vercel Blob이 연결되지 않았습니다. BLOB_READ_WRITE_TOKEN 환경 변수를 확인하고 Redeploy하세요.",
      );
    }
    return;
  }

  const token = getBlobToken();
  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN이 없습니다. Vercel Storage에서 Blob을 프로젝트에 연결하세요.",
    );
  }

  try {
    await put(blobPath, JSON.stringify(data, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      token,
    });
  } catch (error) {
    console.error(`Blob 쓰기 실패 (${blobPath}):`, error);
    throw error;
  }
}

function readFileJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8") || JSON.stringify(fallback)) as T;
  } catch {
    return fallback;
  }
}

function writeFileJson(filePath: string, data: unknown) {
  if (!fs.existsSync(paths.dir)) {
    fs.mkdirSync(paths.dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export function getVapidKeys(): VapidKeys {
  if (cachedVapidKeys) return cachedVapidKeys;

  const envPublic =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const envPrivate = process.env.VAPID_PRIVATE_KEY;

  if (envPublic && envPrivate) {
    cachedVapidKeys = { publicKey: envPublic, privateKey: envPrivate };
    return cachedVapidKeys;
  }

  if (fs.existsSync(paths.vapidKeys)) {
    try {
      cachedVapidKeys = JSON.parse(fs.readFileSync(paths.vapidKeys, "utf-8"));
      return cachedVapidKeys!;
    } catch {
      /* fall through */
    }
  }

  cachedVapidKeys = FALLBACK_VAPID;
  try {
    if (!fs.existsSync(paths.dir)) {
      fs.mkdirSync(paths.dir, { recursive: true });
    }
    fs.writeFileSync(
      paths.vapidKeys,
      JSON.stringify(cachedVapidKeys, null, 2),
      "utf-8",
    );
  } catch {
    /* read-only env */
  }

  return cachedVapidKeys;
}

export function getVapidPublicKey(): string {
  return getVapidKeys().publicKey;
}

export async function getSubscriptions(): Promise<PushSubscriptionRecord[]> {
  if (useBlobStorage()) {
    return readBlobJson<PushSubscriptionRecord[]>(SUBSCRIPTIONS_BLOB_PATH, []);
  }
  if (isVercelRuntime()) {
    console.warn(
      "Vercel에서 Blob 없이 구독을 조회했습니다. BLOB_READ_WRITE_TOKEN 연결 후 Redeploy하세요.",
    );
    return [];
  }
  return readFileJson<PushSubscriptionRecord[]>(paths.subscriptions, []);
}

export async function saveSubscriptions(
  subscriptions: PushSubscriptionRecord[],
) {
  if (useBlobStorage()) {
    await writeBlobJson(SUBSCRIPTIONS_BLOB_PATH, subscriptions);
    return;
  }

  try {
    writeFileJson(paths.subscriptions, subscriptions);
  } catch (error) {
    console.error("구독 파일 갱신 에러:", error);
  }
}

export async function upsertSubscription(
  record: PushSubscriptionRecord,
): Promise<PushSubscriptionRecord[]> {
  const subscriptions = await getSubscriptions();
  const existingIndex = subscriptions.findIndex(
    (sub) => sub.endpoint === record.endpoint,
  );

  const merged: PushSubscriptionRecord = {
    ...(existingIndex > -1 ? subscriptions[existingIndex] : {}),
    ...record,
    seenArticleLinks:
      record.seenArticleLinks ??
      (existingIndex > -1
        ? subscriptions[existingIndex].seenArticleLinks
        : []) ??
      [],
  };

  if (existingIndex > -1) {
    subscriptions[existingIndex] = merged;
  } else {
    subscriptions.push(merged);
  }

  await saveSubscriptions(subscriptions);

  if (useBlobStorage()) {
    const verified = await getSubscriptions();
    if (verified.length !== subscriptions.length) {
      console.warn(
        `Blob 구독 count 불일치: 저장 ${subscriptions.length}, 조회 ${verified.length}`,
      );
    }
  }

  return subscriptions;
}

export async function removeSubscription(
  endpoint: string,
): Promise<PushSubscriptionRecord[]> {
  const subscriptions = (await getSubscriptions()).filter(
    (sub) => sub.endpoint !== endpoint,
  );
  await saveSubscriptions(subscriptions);
  return subscriptions;
}

export async function getSentSlots(): Promise<Record<string, string>> {
  if (useBlobStorage()) {
    return readBlobJson<Record<string, string>>(SENT_SLOTS_BLOB_PATH, {});
  }
  return readFileJson<Record<string, string>>(paths.sentSlots, {});
}

export async function markSentSlot(slotKey: string) {
  const sentSlots = await getSentSlots();
  sentSlots[slotKey] = new Date().toISOString();

  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  for (const [key, value] of Object.entries(sentSlots)) {
    if (new Date(value).getTime() < cutoff) {
      delete sentSlots[key];
    }
  }

  if (useBlobStorage()) {
    await writeBlobJson(SENT_SLOTS_BLOB_PATH, sentSlots);
    return;
  }

  writeFileJson(paths.sentSlots, sentSlots);
}

export async function hasSentSlot(slotKey: string): Promise<boolean> {
  const sentSlots = await getSentSlots();
  return Boolean(sentSlots[slotKey]);
}

export function getKstTimeParts(date = new Date()) {
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(date.getTime() + kstOffset);
  const hours = kstDate.getUTCHours();
  const minutes = kstDate.getUTCMinutes();
  const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const dateStr = `${kstDate.getUTCFullYear()}-${String(kstDate.getUTCMonth() + 1).padStart(2, "0")}-${String(kstDate.getUTCDate()).padStart(2, "0")}`;

  return { hours, minutes, timeStr, dateStr };
}

export function isWithinScheduledWindow(minutes: number, windowSize = 10) {
  return minutes >= 0 && minutes < windowSize;
}

export function matchesKeyword(text: string, keyword: string): boolean {
  const normalized = text.toLowerCase();
  const trimmed = keyword.trim().toLowerCase();
  if (!trimmed) return false;

  if (trimmed.includes("+")) {
    const parts = trimmed
      .split("+")
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length > 0 && parts.every((part) => normalized.includes(part));
  }

  return normalized.includes(trimmed);
}

export function isCronAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;

  const cronHeader = request.headers.get("x-cron-secret");
  if (cronHeader === cronSecret) return true;

  const url = new URL(request.url);
  if (url.searchParams.get("secret") === cronSecret) return true;

  return false;
}

export function getPushStorageInfo() {
  const blobTokenPresent = Boolean(getBlobToken());
  const blobStoreIdPresent = Boolean(process.env.BLOB_STORE_ID);

  return {
    storage:
      blobTokenPresent || (isVercelRuntime() && blobStoreIdPresent)
        ? "vercel-blob"
        : "local-file",
    blobConfigured: blobTokenPresent,
    blobStoreIdPresent,
    isVercel: isVercelRuntime(),
  };
}
