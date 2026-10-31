import { readAppJson, writeAppJson } from "@/lib/push-storage";
import {
  applyPolicyRateUpdate,
  DEFAULT_POLICY_RATES,
  type PolicyRate,
  type PolicyRateId,
} from "@/lib/policy-rate-model";

export type { PolicyRate, PolicyRateId };
export { DEFAULT_POLICY_RATES };

const STORAGE_KEY = "policy-rates";
const FILE_NAME = "policy-rates.json";
const BLOB_PATH = "market/policy-rates.json";

function normalizeStoredRates(stored: PolicyRate[]) {
  return DEFAULT_POLICY_RATES.map((fallback) => {
    const match = stored.find((item) => item.id === fallback.id);

    if (!match?.value?.trim()) {
      return fallback;
    }

    return {
      ...fallback,
      value: match.value.trim(),
      updatedAt: match.updatedAt || null,
      reason: match.reason?.trim() || "",
    };
  });
}

async function loadStoredRates() {
  const stored = await readAppJson<PolicyRate[]>(
    STORAGE_KEY,
    FILE_NAME,
    BLOB_PATH,
    [],
  );

  return normalizeStoredRates(Array.isArray(stored) ? stored : []);
}

/** 저장소 장애 때도 시장 화면이 죽지 않도록 기본값으로 대체한다. */
export async function getPolicyRates() {
  try {
    return await loadStoredRates();
  } catch (error) {
    console.error("정책금리 조회 실패, 기본값 사용:", error);
    return normalizeStoredRates([]);
  }
}

export async function updatePolicyRate(
  id: PolicyRateId,
  value: string,
  reason: string,
) {
  // 저장소 오류 시 기본값으로 덮어쓰지 않도록 실패를 그대로 던지는 조회를 쓴다.
  const next = applyPolicyRateUpdate(await loadStoredRates(), id, value, reason);
  await writeAppJson(STORAGE_KEY, FILE_NAME, BLOB_PATH, next);
  return next;
}
