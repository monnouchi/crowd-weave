import test from "node:test";
import assert from "node:assert/strict";
import { resultText, GAME_URL } from "../share.js";
test("share result includes all five totals and canonical URL", () => {
  const text = resultText([
    { time: 10.2, hits: 1 },
    { time: 9, hits: 0 },
    { time: 12, hits: 2 },
    { time: 8, hits: 0 },
    { time: 11, hits: 3 },
  ]);
  assert.ok(text.includes("50.2秒・接触6回"));
  assert.ok(text.includes(GAME_URL));
  assert.ok(text.includes("Crowd Weave"));
});
