import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { neon } from "@neondatabase/serverless";
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
type BlobAccess = "private" | "public";

const SUBSCRIPTIONS_BLOB_PATH = "push/subscriptions.json";
const SENT_SLOTS_BLOB_PATH = "push/sent-slots.json";
const PG_SUBSCRIPTIONS_KEY = "subscriptions";
const PG_SENT_SLOTS_KEY = "sent-slots";

let cachedVapidKeys: VapidKeys | null = null;
let pgReady: Promise<void> | null = null;
let resolvedBlobAccess: BlobAccess | null = null;

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

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function getDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    undefined
  );
}

function usePostgresStorage() {
  return Boolean(getDatabaseUrl());
}

function getBlobToken(): string | undefined {
  return (
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN ||
    undefined
  );
}

function useBlobStorage() {
  // Blob Hobby 한도(정지) 기간에는 Postgres를 우선 사용한다.
  return !usePostgresStorage() && Boolean(getBlobToken());
}

function isVercelRuntime() {
  return process.env.VERCEL === "1";
}

function getBlobClientOptions() {
  const token = getBlobToken();
  return token ? { token } : undefined;
}

function getSql() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL이 없습니다. Neon을 프로젝트에 연결하세요.");
  }
  return neon(databaseUrl);
}

async function ensurePostgresSchema() {
  if (!pgReady) {
    pgReady = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS push_kv (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
    })().catch((error) => {
      pgReady = null;
      throw error;
    });
  }
  await pgReady;
}

async function readPostgresJson<T>(key: string, fallback: T): Promise<T> {
  await ensurePostgresSchema();
  const sql = getSql();
  const rows = await sql`SELECT value FROM push_kv WHERE key = ${key} LIMIT 1`;
  const raw = rows[0]?.value;
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writePostgresJson(key: string, data: unknown) {
  await ensurePostgresSchema();
  const sql = getSql();
  const payload = JSON.stringify(data);
  await sql`
    INSERT INTO push_kv (key, value, updated_at)
    VALUES (${key}, ${payload}, NOW())
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
}

async function readViaGet<T>(
  blobPath: string,
  access: BlobAccess,
): Promise<T | null> {
  const options = getBlobClientOptions();
  const result = await get(blobPath, {
    access,
    ...options,
  });

  if (result?.statusCode === 200 && result.stream) {
    const text = await new Response(result.stream).text();
    if (text.trim()) {
      return JSON.parse(text) as T;
    }
  }

  return null;
}

async function readBlobJson<T>(blobPath: string, fallback: T): Promise<T> {
  if (!useBlobStorage()) return fallback;

  const accessOrder: BlobAccess[] = resolvedBlobAccess
    ? [resolvedBlobAccess, resolvedBlobAccess === "private" ? "public" : "private"]
    : ["private", "public"];

  for (const access of accessOrder) {
    try {
      const parsed = await readViaGet<T>(blobPath, access);
      if (parsed !== null) {
        resolvedBlobAccess = access;
        return parsed;
      }
    } catch (error) {
      console.error(`Blob get 실패 (${blobPath}, ${access}):`, error);
    }
  }

  try {
    const options = getBlobClientOptions();
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
    resolvedBlobAccess = "public";
    return (await response.json()) as T;
  } catch (error) {
    console.error(`Blob 읽기 실패 (${blobPath}):`, error);
    return fallback;
  }
}

async function writeBlobJson(blobPath: string, data: unknown) {
  if (!useBlobStorage()) {
    if (isVercelRuntime() && !usePostgresStorage()) {
      throw new Error(
        "저장소가 없습니다. Neon(DATABASE_URL) 또는 BLOB_READ_WRITE_TOKEN을 연결하세요.",
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

  const accessOrder: BlobAccess[] = resolvedBlobAccess
    ? [resolvedBlobAccess, resolvedBlobAccess === "private" ? "public" : "private"]
    : ["private", "public"];

  let lastError: unknown;
  for (const access of accessOrder) {
    try {
      await put(blobPath, JSON.stringify(data, null, 2), {
        access,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 60,
        token,
      });
      resolvedBlobAccess = access;
      return;
    } catch (error) {
      lastError = error;
      console.error(`Blob 쓰기 실패 (${blobPath}, ${access}):`, error);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Blob 쓰기 실패 (${blobPath})`);
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

  // Local-only convenience: never fall back to committed keys.
  if (!isProductionRuntime() && fs.existsSync(paths.vapidKeys)) {
    try {
      const fromFile = JSON.parse(
        fs.readFileSync(paths.vapidKeys, "utf-8"),
      ) as VapidKeys;
      if (fromFile?.publicKey && fromFile?.privateKey) {
        cachedVapidKeys = fromFile;
        return cachedVapidKeys;
      }
    } catch {
      /* fall through */
    }
  }

  throw new Error(
    "VAPID keys missing. Set VAPID_PRIVATE_KEY and NEXT_PUBLIC_VAPID_PUBLIC_KEY (or VAPID_PUBLIC_KEY).",
  );
}

export function getVapidPublicKey(): string {
  return getVapidKeys().publicKey;
}

export async function findOwnedSubscription(
  endpoint: string,
  keys: { p256dh: string; auth: string },
): Promise<PushSubscriptionRecord | null> {
  if (!endpoint || !keys?.p256dh || !keys?.auth) return null;

  const subscriptions = await getSubscriptions();
  const match = subscriptions.find((sub) => sub.endpoint === endpoint);
  if (!match?.keys?.p256dh || !match?.keys?.auth) return null;

  if (
    !safeEqual(match.keys.p256dh, keys.p256dh) ||
    !safeEqual(match.keys.auth, keys.auth)
  ) {
    return null;
  }

  return match;
}

export async function getSubscriptions(): Promise<PushSubscriptionRecord[]> {
  if (usePostgresStorage()) {
    return readPostgresJson<PushSubscriptionRecord[]>(PG_SUBSCRIPTIONS_KEY, []);
  }
  if (useBlobStorage()) {
    return readBlobJson<PushSubscriptionRecord[]>(SUBSCRIPTIONS_BLOB_PATH, []);
  }
  if (isVercelRuntime()) {
    console.warn(
      "Vercel에서 구독 저장소가 없습니다. Neon(DATABASE_URL)을 연결하세요.",
    );
    return [];
  }
  return readFileJson<PushSubscriptionRecord[]>(paths.subscriptions, []);
}

export async function saveSubscriptions(
  subscriptions: PushSubscriptionRecord[],
) {
  if (usePostgresStorage()) {
    await writePostgresJson(PG_SUBSCRIPTIONS_KEY, subscriptions);
    return;
  }

  if (useBlobStorage()) {
    await writeBlobJson(SUBSCRIPTIONS_BLOB_PATH, subscriptions);
    return;
  }

  if (isVercelRuntime()) {
    throw new Error(
      "구독 저장소가 없습니다. Neon(DATABASE_URL) 또는 Blob을 연결한 뒤 Redeploy하세요.",
    );
  }

  try {
    writeFileJson(paths.subscriptions, subscriptions);
  } catch (error) {
    console.error("구독 파일 갱신 에러:", error);
    throw error;
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

  try {
    const verified = await getSubscriptions();
    if (!verified.some((sub) => sub.endpoint === record.endpoint)) {
      console.warn(
        `구독 저장 직후 조회에 아직 반영되지 않음. 저장=${subscriptions.length}, 조회=${verified.length}`,
      );
    }
  } catch (error) {
    console.warn("구독 저장 직후 검증 조회 실패(무시):", error);
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
  if (usePostgresStorage()) {
    return readPostgresJson<Record<string, string>>(PG_SENT_SLOTS_KEY, {});
  }
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

  if (usePostgresStorage()) {
    await writePostgresJson(PG_SENT_SLOTS_KEY, sentSlots);
    return;
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

  // Fail closed in deployed/production environments.
  if (!cronSecret) {
    return !isProductionRuntime();
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;

  const cronHeader = request.headers.get("x-cron-secret");
  if (cronHeader === cronSecret) return true;

  // Query-string secrets leak via logs/Referer — reject them.
  return false;
}

export function getPushStorageInfo() {
  const postgresConfigured = usePostgresStorage();
  const blobTokenPresent = Boolean(getBlobToken());
  const blobStoreIdPresent = Boolean(process.env.BLOB_STORE_ID);

  return {
    storage: postgresConfigured
      ? "neon-postgres"
      : blobTokenPresent || (isVercelRuntime() && blobStoreIdPresent)
        ? "vercel-blob"
        : "local-file",
    postgresConfigured,
    blobConfigured: blobTokenPresent,
    blobStoreIdPresent,
    isVercel: isVercelRuntime(),
  };
}
