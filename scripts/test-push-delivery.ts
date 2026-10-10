import assert from "node:assert/strict";
import { seenLinksAfterDelivery } from "../lib/breaking-select.ts";

const existing = ["https://news.example/old"];

const afterFailure = seenLinksAfterDelivery(existing, [
  {
    focus: "keyword",
    seenTitle: "환율이 올랐다",
    tag: "https://news.example/fx",
    delivered: false,
  },
]);

assert.deepEqual(afterFailure, existing);

const afterKeyword = seenLinksAfterDelivery(existing, [
  {
    focus: "keyword",
    seenTitle: "환율이 올랐다",
    tag: "https://news.example/fx",
    delivered: true,
  },
  {
    focus: "news",
    seenTitle: "정기 뉴스",
    tag: "scheduled-news-12",
    delivered: true,
  },
]);

assert.equal(afterKeyword.includes("https://news.example/old"), true);
assert.equal(afterKeyword.includes("https://news.example/fx"), true);
assert.equal(afterKeyword.includes("scheduled-news-12"), false);

const capped = seenLinksAfterDelivery(
  Array.from({ length: 205 }, (_, index) => `https://news.example/${index}`),
  [],
);

assert.equal(capped.length, 200);
assert.equal(capped[0], "https://news.example/5");
assert.equal(capped.at(-1), "https://news.example/204");

console.log("push-delivery tests passed");
