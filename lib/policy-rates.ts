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

export async function getPolicyRates() {
  const stored = await readAppJson<PolicyRate[]>(
    STORAGE_KEY,
    FILE_NAME,
    BLOB_PATH,
    [],
  );

  return normalizeStoredRates(Array.isArray(stored) ? stored : []);
}

export async function updatePolicyRate(
  id: PolicyRateId,
  value: string,
  reason: string,
) {
  const next = applyPolicyRateUpdate(await getPolicyRates(), id, value, reason);
  await writeAppJson(STORAGE_KEY, FILE_NAME, BLOB_PATH, next);
  return next;
}
