import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { neon } from "@neondatabase/serverless";
import { get, list, put } from "@vercel/blob";
import { isKeywordMatch } from "@/lib/breaking-select";
import {
  isRedisConfigured,
  readRedisJson,
  redisGetString,
  redisHashDelete,
  redisHashGet,
  redisHashGetAll,
  redisHashLength,
  redisHashSet,
  redisHashSetIfMissing,
  redisSetString,
  writeRedisJson,
} from "@/lib/redis-rest";

export type PushSubscriptionRecord = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
  updatedAt?: string;
  alertEnabled?: boolean;
  scheduledAlertEnabled?: boolean;
  /** KST hour slots like "07:00". Empty/missing → defaults. */
  scheduledNewsHours?: string[];
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
  // 우선순위: Upstash Redis → Postgres → Blob → 로컬 파일
  return (
    !isRedisConfigured() && !usePostgresStorage() && Boolean(getBlobToken())
  );
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

/** Redis 이전용: 옛 Postgres 값을 읽는다. 행이 없으면 undefined, 연결 오류는 그대로 던진다. */
async function readPostgresLegacy<T>(key: string): Promise<T | undefined> {
  if (!usePostgresStorage()) return undefined;
  await ensurePostgresSchema();
  const sql = getSql();
  const rows = await sql`SELECT value FROM push_kv WHERE key = ${key} LIMIT 1`;
  const raw = rows[0]?.value;
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return JSON.parse(raw) as T;
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

export async function readAppJson<T>(
  key: string,
  fileName: string,
  blobPath: string,
  fallback: T,
): Promise<T> {
  if (isRedisConfigured()) {
    return readRedisJson<T>(key, fallback, () => readPostgresLegacy<T>(key));
  }
  if (usePostgresStorage()) {
    return readPostgresJson<T>(key, fallback);
  }
  if (useBlobStorage()) {
    return readBlobJson<T>(blobPath, fallback);
  }
  if (isVercelRuntime()) {
    return fallback;
  }
  return readFileJson<T>(path.join(paths.dir, fileName), fallback);
}

export async function writeAppJson(
  key: string,
  fileName: string,
  blobPath: string,
  data: unknown,
) {
  if (isRedisConfigured()) {
    await writeRedisJson(key, data);
    return;
  }
  if (usePostgresStorage()) {
    await writePostgresJson(key, data);
    return;
  }
  if (useBlobStorage()) {
    await writeBlobJson(blobPath, data);
    return;
  }
  if (isVercelRuntime()) {
    throw new Error(
      "저장소가 없습니다. Upstash Redis, Neon(DATABASE_URL) 또는 Blob을 연결하세요.",
    );
  }
  writeFileJson(path.join(paths.dir, fileName), data);
}

/* ───────────────────────── 푸시 구독 저장 ─────────────────────────
 * 구독은 기기(endpoint)마다 따로 저장한다. (Redis 해시 3개)
 *   push:subs   endpoint → 기기 설정 (키, 알림 ON/OFF, 시간, 키워드)
 *   push:seen   endpoint → 이미 보낸 기사 목록 (크론만 쓴다)
 *   push:status endpoint → 마지막 발송 성공/실패 (크론만 쓴다)
 * 예전처럼 "전체 목록을 읽고 → 고치고 → 통째로 다시 쓰는" 일이 없으므로,
 * 크론·설정 저장·새 구독이 동시에 일어나도 서로의 변경을 지우지 않는다.
 * (Redis가 없는 로컬 개발 환경에서만 옛 배열 방식을 쓴다.)
 */

const SUBS_HASH = "push:subs";
const SEEN_HASH = "push:seen";
const STATUS_HASH = "push:status";
const SUBS_MIGRATED_FLAG = "migrated:push:subs";

export type PushDeliveryStatus = {
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastStatusCode?: number;
  lastError?: string;
};

type StoredSettings = Omit<PushSubscriptionRecord, "seenArticleLinks">;

function parseRecord<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function toStoredSettings(record: PushSubscriptionRecord): StoredSettings {
  // seenArticleLinks는 별도 칸에 저장한다.
  const { seenArticleLinks: _seen, ...settings } = record;
  void _seen;
  return settings;
}

/** 옛 배열 저장소(Redis 단일 키 / Neon / Blob / 로컬 파일)를 읽는다. */
async function readLegacySubscriptionArray(): Promise<PushSubscriptionRecord[]> {
  if (isRedisConfigured()) {
    return readRedisJson<PushSubscriptionRecord[]>(
      PG_SUBSCRIPTIONS_KEY,
      [],
      () => readPostgresLegacy<PushSubscriptionRecord[]>(PG_SUBSCRIPTIONS_KEY),
    );
  }
  if (usePostgresStorage()) {
    return readPostgresJson<PushSubscriptionRecord[]>(PG_SUBSCRIPTIONS_KEY, []);
  }
  if (useBlobStorage()) {
    return readBlobJson<PushSubscriptionRecord[]>(SUBSCRIPTIONS_BLOB_PATH, []);
  }
  if (isVercelRuntime()) {
    console.warn("Vercel에서 구독 저장소가 없습니다. Upstash Redis를 연결하세요.");
    return [];
  }
  return readFileJson<PushSubscriptionRecord[]>(paths.subscriptions, []);
}

async function writeLegacySubscriptionArray(subscriptions: PushSubscriptionRecord[]) {
  if (usePostgresStorage()) {
    await writePostgresJson(PG_SUBSCRIPTIONS_KEY, subscriptions);
    return;
  }
  if (useBlobStorage()) {
    await writeBlobJson(SUBSCRIPTIONS_BLOB_PATH, subscriptions);
    return;
  }
  if (isVercelRuntime()) {
    throw new Error("구독 저장소가 없습니다. Upstash Redis를 연결한 뒤 Redeploy하세요.");
  }
  writeFileJson(paths.subscriptions, subscriptions);
}

/** 옛 배열 키에 있던 구독을 기기별 해시로 한 번만 옮긴다. */
let migrationPromise: Promise<void> | null = null;
async function ensureSubscriptionsMigrated() {
  if (!isRedisConfigured()) return;
  if (!migrationPromise) {
    migrationPromise = (async () => {
      if ((await redisGetString(SUBS_MIGRATED_FLAG)) !== null) return;
      const legacy = await readLegacySubscriptionArray();
      for (const record of legacy) {
        if (!record?.endpoint) continue;
        // 이미 새 방식으로 저장된 기기는 덮어쓰지 않는다.
        await redisHashSetIfMissing(
          SUBS_HASH,
          record.endpoint,
          JSON.stringify(toStoredSettings(record)),
        );
        if (record.seenArticleLinks?.length) {
          await redisHashSetIfMissing(
            SEEN_HASH,
            record.endpoint,
            JSON.stringify(record.seenArticleLinks),
          );
        }
      }
      await redisSetString(SUBS_MIGRATED_FLAG, new Date().toISOString());
      console.log(`푸시 구독 ${legacy.length}건을 기기별 저장으로 옮겼습니다.`);
    })().catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }
  await migrationPromise;
}

export async function getSubscriptions(): Promise<PushSubscriptionRecord[]> {
  if (!isRedisConfigured()) return readLegacySubscriptionArray();

  await ensureSubscriptionsMigrated();
  const [subs, seen] = await Promise.all([
    redisHashGetAll(SUBS_HASH),
    redisHashGetAll(SEEN_HASH),
  ]);

  const records: PushSubscriptionRecord[] = [];
  for (const [endpoint, raw] of Object.entries(subs)) {
    const settings = parseRecord<StoredSettings>(raw);
    if (!settings?.keys) continue;
    records.push({
      ...settings,
      endpoint,
      seenArticleLinks: parseRecord<string[]>(seen[endpoint]) ?? [],
    });
  }
  return records;
}

export async function getSubscription(
  endpoint: string,
): Promise<PushSubscriptionRecord | null> {
  if (!endpoint) return null;
  if (!isRedisConfigured()) {
    return (await readLegacySubscriptionArray()).find((sub) => sub.endpoint === endpoint) ?? null;
  }

  await ensureSubscriptionsMigrated();
  const settings = parseRecord<StoredSettings>(await redisHashGet(SUBS_HASH, endpoint));
  if (!settings?.keys) return null;
  const seen = parseRecord<string[]>(await redisHashGet(SEEN_HASH, endpoint)) ?? [];
  return { ...settings, endpoint, seenArticleLinks: seen };
}

export async function countSubscriptions(): Promise<number> {
  if (!isRedisConfigured()) return (await readLegacySubscriptionArray()).length;
  await ensureSubscriptionsMigrated();
  return redisHashLength(SUBS_HASH);
}

export async function findOwnedSubscription(
  endpoint: string,
  keys: { p256dh: string; auth: string },
): Promise<PushSubscriptionRecord | null> {
  if (!endpoint || !keys?.p256dh || !keys?.auth) return null;

  const match = await getSubscription(endpoint);
  if (!match?.keys?.p256dh || !match?.keys?.auth) return null;

  if (
    !safeEqual(match.keys.p256dh, keys.p256dh) ||
    !safeEqual(match.keys.auth, keys.auth)
  ) {
    return null;
  }

  return match;
}

/** 이 기기의 구독을 등록하거나, 이미 있으면 넘어온 값만 갱신한다. 다른 기기는 건드리지 않는다. */
export async function upsertSubscription(
  record: PushSubscriptionRecord,
): Promise<PushSubscriptionRecord> {
  const existing = await getSubscription(record.endpoint);

  const merged: PushSubscriptionRecord = {
    ...(existing || {}),
    ...record,
    alertEnabled: record.alertEnabled ?? existing?.alertEnabled,
    scheduledAlertEnabled:
      record.scheduledAlertEnabled ?? existing?.scheduledAlertEnabled,
    scheduledNewsHours:
      record.scheduledNewsHours ?? existing?.scheduledNewsHours,
    alertKeywords: record.alertKeywords ?? existing?.alertKeywords,
    seenArticleLinks: existing?.seenArticleLinks ?? [],
  };

  if (isRedisConfigured()) {
    await redisHashSet(SUBS_HASH, merged.endpoint, JSON.stringify(toStoredSettings(merged)));
    // 새로 연결했으면 이전 실패 기록은 지운다.
    await redisHashDelete(STATUS_HASH, merged.endpoint);
    return merged;
  }

  const subscriptions = await readLegacySubscriptionArray();
  const index = subscriptions.findIndex((sub) => sub.endpoint === merged.endpoint);
  if (index > -1) subscriptions[index] = merged;
  else subscriptions.push(merged);
  await writeLegacySubscriptionArray(subscriptions);
  return merged;
}

/** 이 기기의 설정만 바꾼다. 구독이 없으면 null. */
export async function updateSubscriptionSettings(
  endpoint: string,
  patch: Partial<
    Pick<
      PushSubscriptionRecord,
      "alertEnabled" | "scheduledAlertEnabled" | "scheduledNewsHours" | "alertKeywords"
    >
  >,
): Promise<PushSubscriptionRecord | null> {
  const existing = await getSubscription(endpoint);
  if (!existing) return null;

  const updated: PushSubscriptionRecord = {
    ...existing,
    ...Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ),
    updatedAt: new Date().toISOString(),
  };

  if (isRedisConfigured()) {
    await redisHashSet(SUBS_HASH, endpoint, JSON.stringify(toStoredSettings(updated)));
    return updated;
  }

  const subscriptions = await readLegacySubscriptionArray();
  const index = subscriptions.findIndex((sub) => sub.endpoint === endpoint);
  if (index === -1) return null;
  subscriptions[index] = updated;
  await writeLegacySubscriptionArray(subscriptions);
  return updated;
}

export async function removeSubscription(endpoint: string): Promise<void> {
  if (isRedisConfigured()) {
    await ensureSubscriptionsMigrated();
    await Promise.all([
      redisHashDelete(SUBS_HASH, endpoint),
      redisHashDelete(SEEN_HASH, endpoint),
      redisHashDelete(STATUS_HASH, endpoint),
    ]);
    return;
  }

  const subscriptions = (await readLegacySubscriptionArray()).filter(
    (sub) => sub.endpoint !== endpoint,
  );
  await writeLegacySubscriptionArray(subscriptions);
}

/** 크론 전용: 이 기기에 이미 보낸 기사 목록을 저장한다. */
export async function setSeenArticleLinks(endpoint: string, links: string[]) {
  if (isRedisConfigured()) {
    await redisHashSet(SEEN_HASH, endpoint, JSON.stringify(links));
    return;
  }

  const subscriptions = await readLegacySubscriptionArray();
  const index = subscriptions.findIndex((sub) => sub.endpoint === endpoint);
  if (index === -1) return;
  subscriptions[index] = { ...subscriptions[index], seenArticleLinks: links };
  await writeLegacySubscriptionArray(subscriptions);
}

/** 크론 전용: 이 기기로의 마지막 발송 결과를 남긴다. */
export async function recordDeliveryResult(
  endpoint: string,
  result: { ok: true } | { ok: false; statusCode?: number; message?: string },
) {
  if (!isRedisConfigured()) return;
  const previous =
    parseRecord<PushDeliveryStatus>(await redisHashGet(STATUS_HASH, endpoint)) ?? {};
  const now = new Date().toISOString();
  const next: PushDeliveryStatus = result.ok
    ? { ...previous, lastSuccessAt: now }
    : {
        ...previous,
        lastErrorAt: now,
        lastStatusCode: result.statusCode,
        lastError: result.message?.slice(0, 200),
      };
  await redisHashSet(STATUS_HASH, endpoint, JSON.stringify(next));
}

export async function getDeliveryStatus(endpoint: string): Promise<PushDeliveryStatus | null> {
  if (!isRedisConfigured()) return null;
  return parseRecord<PushDeliveryStatus>(await redisHashGet(STATUS_HASH, endpoint));
}

export async function getSentSlots(): Promise<Record<string, string>> {
  if (isRedisConfigured()) {
    return readRedisJson<Record<string, string>>(
      PG_SENT_SLOTS_KEY,
      {},
      () => readPostgresLegacy<Record<string, string>>(PG_SENT_SLOTS_KEY),
    );
  }
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

  if (isRedisConfigured()) {
    await writeRedisJson(PG_SENT_SLOTS_KEY, sentSlots);
    return;
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

const CRON_CHECK_KEY = "push-cron-check";
const CRON_CHECK_FILE = "push-cron-check.json";
const CRON_CHECK_BLOB_PATH = "push/cron-check.json";

export async function markCronChecked(at = new Date().toISOString()) {
  await writeAppJson(CRON_CHECK_KEY, CRON_CHECK_FILE, CRON_CHECK_BLOB_PATH, {
    at,
  });
}

export async function getCronCheckedAt(): Promise<string | null> {
  const stored = await readAppJson<{ at?: string }>(
    CRON_CHECK_KEY,
    CRON_CHECK_FILE,
    CRON_CHECK_BLOB_PATH,
    {},
  );
  return typeof stored.at === "string" && stored.at ? stored.at : null;
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
  return isKeywordMatch(text, keyword);
}

export function isCronAuthorized(request: Request): boolean {
  // 복사·붙여넣기로 생기는 앞뒤 공백/줄바꿈은 무시한다.
  const cronSecret = process.env.CRON_SECRET?.trim();

  // Fail closed in deployed/production environments.
  if (!cronSecret) {
    return !isProductionRuntime();
  }

  const authHeader = request.headers.get("authorization")?.trim() ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "");
  if (authHeader && safeEqual(bearer, cronSecret)) return true;

  const cronHeader = request.headers.get("x-cron-secret")?.trim() ?? "";
  if (cronHeader && safeEqual(cronHeader, cronSecret)) return true;

  // Query-string secrets leak via logs/Referer — reject them.
  return false;
}

export function getPushStorageInfo() {
  const redisConfigured = isRedisConfigured();
  const postgresConfigured = usePostgresStorage();
  const blobTokenPresent = Boolean(getBlobToken());
  const blobStoreIdPresent = Boolean(process.env.BLOB_STORE_ID);

  return {
    storage: redisConfigured
      ? "upstash-redis"
      : postgresConfigured
        ? "neon-postgres"
        : blobTokenPresent || (isVercelRuntime() && blobStoreIdPresent)
          ? "vercel-blob"
          : "local-file",
    redisConfigured,
    postgresConfigured,
    /** 서버리스에서 데이터가 유지되는 저장소가 하나라도 연결돼 있는지 */
    persistentConfigured:
      redisConfigured || postgresConfigured || blobTokenPresent,
    blobConfigured: blobTokenPresent,
    blobStoreIdPresent,
    isVercel: isVercelRuntime(),
  };
}
