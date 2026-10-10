export type PolicyRateId = "us" | "korea";

export type PolicyRate = {
  id: PolicyRateId;
  label: string;
  value: string;
  updatedAt: string | null;
  reason: string;
};

export const DEFAULT_POLICY_RATES: PolicyRate[] = [
  {
    id: "us",
    label: "미국 기준금리",
    value: "3.50~3.75%",
    updatedAt: null,
    reason: "",
  },
  {
    id: "korea",
    label: "한국 기준금리",
    value: "2.50%",
    updatedAt: null,
    reason: "",
  },
];

export function applyPolicyRateUpdate(
  current: PolicyRate[],
  id: PolicyRateId,
  value: string,
  reason: string,
  updatedAt = new Date().toISOString(),
) {
  const trimmedValue = value.trim();
  const trimmedReason = reason.trim();

  if (!trimmedValue) {
    throw new Error("기준값을 입력해 주세요.");
  }
  if (trimmedValue.length > 40) {
    throw new Error("기준값은 40자 안으로 입력해 주세요.");
  }
  if (!trimmedReason) {
    throw new Error("수정 사유를 입력해 주세요.");
  }
  if (trimmedReason.length > 80) {
    throw new Error("사유는 80자 안으로 입력해 주세요.");
  }
  if (!current.some((item) => item.id === id)) {
    throw new Error("수정할 기준금리를 찾지 못했습니다.");
  }

  return current.map((item) =>
    item.id === id
      ? {
          ...item,
          value: trimmedValue,
          reason: trimmedReason,
          updatedAt,
        }
      : item,
  );
}
