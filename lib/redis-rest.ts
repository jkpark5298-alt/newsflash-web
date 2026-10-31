/**
 * Upstash Redis REST 클라이언트 (추가 패키지 없이 fetch만 사용).
 * Vercel Marketplace의 Upstash 연동은 KV_REST_API_* 또는 UPSTASH_REDIS_REST_* 를 넣어 준다.
 */

const KEY_PREFIX = "newsflash:";
const REQUEST_TIMEOUT_MS = 8000;

function getRedisConfig(): { url: string; token: string } | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

export function isRedisConfigured(): boolean {
  return getRedisConfig() !== null;
}

async function redisCommand(args: string[]): Promise<unknown> {
  const config = getRedisConfig();
  if (!config) {
    throw new Error(
      "Upstash Redis가 없습니다. UPSTASH_REDIS_REST_URL/TOKEN(또는 KV_REST_API_URL/TOKEN)을 설정하세요.",
    );
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    result?: unknown;
    error?: string;
  };

  if (!response.ok || payload.error) {
    throw new Error(
      `Upstash Redis 오류 (HTTP ${response.status}): ${payload.error || "알 수 없는 오류"}`,
    );
  }

  return payload.result ?? null;
}

async function getRaw(key: string): Promise<string | null> {
  const result = await redisCommand(["GET", KEY_PREFIX + key]);
  return typeof result === "string" ? result : null;
}

async function setRaw(key: string, value: string, onlyIfMissing = false) {
  const args = ["SET", KEY_PREFIX + key, value];
  if (onlyIfMissing) args.push("NX");
  await redisCommand(args);
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Redis에서 JSON을 읽는다.
 * 값이 아직 없으면 `legacyRead`(예: 옛 Neon 저장소)에서 한 번만 가져와 Redis에 복사한다.
 * - legacyRead가 undefined를 돌려주면 "옛 저장소에 데이터 없음"으로 보고 이전을 끝낸다.
 * - legacyRead가 예외를 던지면(예: Neon 한도 초과) 이전 완료로 표시하지 않고 다음에 다시 시도한다.
 * - DISABLE_LEGACY_MIGRATION=true 이면 이전을 시도하지 않는다.
 */
export async function readRedisJson<T>(
  key: string,
  fallback: T,
  legacyRead?: () => Promise<T | undefined>,
): Promise<T> {
  const raw = await getRaw(key);
  if (raw !== null) return parseJson<T>(raw, fallback);

  if (!legacyRead || process.env.DISABLE_LEGACY_MIGRATION === "true") {
    return fallback;
  }

  const migratedFlag = `migrated:${key}`;
  if ((await getRaw(migratedFlag)) !== null) return fallback;

  try {
    const legacy = await legacyRead();
    if (legacy !== undefined) {
      // NX: 그 사이 새로 저장된 값이 있으면 덮어쓰지 않는다.
      await setRaw(key, JSON.stringify(legacy), true);
    }
    await setRaw(migratedFlag, "1");

    if (legacy !== undefined) {
      const current = await getRaw(key);
      return current !== null ? parseJson<T>(current, fallback) : legacy;
    }
  } catch (error) {
    console.warn(`옛 저장소 데이터 이전 보류 (${key}):`, error);
  }

  return fallback;
}

export async function writeRedisJson(key: string, data: unknown) {
  await setRaw(key, JSON.stringify(data));
}
