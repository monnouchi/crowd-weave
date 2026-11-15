import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STORY_STAGES } from "../src/run.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");

test("result markup places all statistics and records before the narrative and share control", () => {
  const stats = html.indexOf('id="overlay-stats"'), body = html.indexOf('id="overlay-body"'), share = html.indexOf('id="share-seed"');
  for (const id of ["result-time", "result-score", "result-max-flow", "result-hits", "result-friends", "result-splits", "result-record"]) {
    const pos = html.indexOf(`id="${id}"`);
    assert.ok(pos > stats && pos < body, id);
  }
  assert.ok(body < share);
});

test("result rendering keeps records, splits, and an honest unavailable arrival count", () => {
  assert.match(source, /result-friends"\)\.textContent = "記録なし"/);
  assert.match(source, /run\.records : \[\]/);
  assert.match(source, /\[scoreText, bestText, courseText, streakText\]/);
  assert.match(source, /record\.elapsed/);
  assert.match(html, /一緒に着いた友達/);
  assert.match(html, /同じ配置の URL をコピー/);
});

test("stage result excerpts are the first short sentence", () => {
  for (const stage of STORY_STAGES.slice(0, 4)) {
    const first = stage.clear.match(/^.*?[。！？!?]/)?.[0];
    assert.ok(first && first.length <= 20 && !/[。！？!?].+[。！？!?]/.test(first));
  }
  assert.match(source, /人波を抜けて、舞台が開けた！/);
  assert.match(source, /\.match\(\/\^\.\*\?\[。！？!\?\]\//);
});

test("finished overlays render current totals, split rows, and records", () => {
  const implementation = source.slice(source.indexOf("function resultTotals()"), source.indexOf("function showGameOver()"));
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, { textContent: "", hidden: false, replaceChildren(...children) { this.children = children; } });
    return elements.get(id);
  };
  const records = Array.from({ length: 5 }, (_, stage) => ({ stage, elapsed: stage + 10, hits: 1, score: 100, maxFlow: stage + 1 }));
  const run = { stage: 4, startStage: 0, course: {}, records, runSeed: 2, combo: {}, party: { members: [{ docked: false }] } };
  let overlay;
  const best = { elapsed: 60, hits: 5, score: 500 };
  const invoke = new Function("run", "$", "document", "setOverlay", "recordLocalBest", "recordCourseResults", "browserStorage", "clock", "story", "reducedMotion", "spawnConfetti", `${implementation}\nreturn showFinished();`);
  invoke(run, get, { createElement: () => ({}) }, value => { overlay = value; },
    () => ({ stored: true, best, improved: true }), () => ({ best, improved: true, scoreImproved: true }),
    () => null, String, () => STORY_STAGES[4], { matches: true }, () => {});
  assert.equal(overlay.body, "人波を抜けて、舞台が開けた！");
  assert.equal(get("result-time").textContent, "60");
  assert.equal(get("result-hits").textContent, "5");
  assert.equal(get("result-score").textContent, "500");
  assert.equal(get("result-max-flow").textContent, "5");
  assert.equal(get("result-friends").textContent, "記録なし");
  assert.deepEqual(get("result-splits").children.map(row => row.textContent), ["1区間 10", "2区間 11", "3区間 12", "4区間 13", "5区間 14"]);
  assert.match(get("result-record").textContent, /スコアベスト更新！ 500/);
  assert.match(get("result-record").textContent, /自己ベスト更新/);
  assert.match(get("result-record").textContent, /通しベスト更新/);
});
