import assert from "node:assert/strict";
import {
  isCronCheckStale,
  slotsForScheduledPush,
} from "../lib/alert-schedule.ts";

const noon = slotsForScheduledPush(new Date("2026-10-10T03:08:00.000Z"));
assert.deepEqual(
  noon.map((slot) => `${slot.dateStr} ${slot.hourSlot}`),
  ["2026-10-10 11:00", "2026-10-10 12:00"],
);

const afterMidnight = slotsForScheduledPush(new Date("2026-10-09T15:05:00.000Z"));
assert.deepEqual(
  afterMidnight.map((slot) => `${slot.dateStr} ${slot.hourSlot}`),
  ["2026-10-09 23:00", "2026-10-10 00:00"],
);

const now = new Date("2026-10-10T03:20:00.000Z");
assert.equal(isCronCheckStale("2026-10-10T03:12:00.000Z", now), false);
assert.equal(isCronCheckStale("2026-10-10T03:09:00.000Z", now), true);
assert.equal(isCronCheckStale(null, now), true);
assert.equal(isCronCheckStale("not-a-date", now), true);

console.log("scheduled catchup ok");
