import test from "node:test";
import assert from "node:assert/strict";
import { resultText, resultTotals, GAME_URL } from "../share.js";
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

test("clean journey honors every friend and signal stop, without making contact a failure", () => {
  const records = Array.from({ length: 5 }, () => ({
    time: 10,
    hits: 0,
    violations: 0,
  }));
  assert.equal(resultTotals(records).clean, true);
  records[3].violations = 1;
  assert.equal(resultTotals(records).clean, false);
  assert.match(resultText(records), /信号無視1回/);
  assert.match(resultText(records), /みんなで最前列/);
  records[3].violations = 0;
  records[2].hits = 1;
  assert.equal(resultTotals(records).clean, false);
  assert.equal(resultTotals(records.slice(0, 4)).clean, false);
});
