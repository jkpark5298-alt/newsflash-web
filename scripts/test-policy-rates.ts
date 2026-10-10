import assert from "node:assert/strict";
import { applyPolicyRateUpdate, DEFAULT_POLICY_RATES } from "../lib/policy-rate-model.ts";

const updatedAt = "2026-10-10T02:12:00.000Z";
const next = applyPolicyRateUpdate(
  DEFAULT_POLICY_RATES,
  "korea",
  " 2.25% ",
  " 기준금리 인하 ",
  updatedAt,
);

assert.equal(next.find((item) => item.id === "korea")?.value, "2.25%");
assert.equal(next.find((item) => item.id === "korea")?.reason, "기준금리 인하");
assert.equal(next.find((item) => item.id === "korea")?.updatedAt, updatedAt);
assert.equal(next.find((item) => item.id === "us")?.value, "3.50~3.75%");

assert.throws(
  () => applyPolicyRateUpdate(DEFAULT_POLICY_RATES, "us", "3.25%", "  "),
  /수정 사유/,
);

console.log("policy-rates tests passed");
