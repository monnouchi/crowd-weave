import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createGame, step, seedForRun, nextRunSeed } from "../logic.js";
import { planRoute, routeInput } from "./plan-route.js";
import { trafficViolations } from "../traffic.js";
const records = [];
for (const runSeed of [17, 2026, 1402485690]) {
  const routes = [];
  for (let stage = 0; stage < 5; stage++) {
    const seed = seedForRun(runSeed, stage),
      a = createGame(stage, seed),
      b = createGame(stage, seed);
    assert.deepEqual(a, b, "same seed reproduces the whole initial state");
    let route = planRoute(stage, seed, 40);
    for (const delay of [2, 4, 6, 8]) {
      if (route) break;
      route = planRoute(stage, seed, 40, delay);
    }
    assert.ok(route, `fair route ${runSeed}/${stage}/${seed}`);
    a.phase = b.phase = "playing";
    for (const action of route.path)
      for (let n = 0; n < 4; n++) {
        step(a, 0.025, routeInput(action));
        step(b, 0.025, routeInput(action));
      }
    assert.deepEqual(a, b, "same seed and input reproduce movement/result");
    assert.equal(a.phase, "finished");
    assert.equal(a.hits, 0);
    assert.equal(trafficViolations(a), 0);
    routes.push({ ...route, stage, seed });
    records.push({ runSeed, stage, seed, time: a.elapsed, hits: a.hits });
  }
  await writeFile(
    `output/mobile-result/routes-${runSeed}.json`,
    JSON.stringify(routes, null, 2),
  );
}
assert.equal(nextRunSeed(7, 7), 8);
assert.equal(nextRunSeed(7, 9), 9);
await writeFile(
  "output/mobile-result/replay-check.json",
  JSON.stringify({ result: "PASS", records }, null, 2),
);
console.log(JSON.stringify({ result: "PASS", records }, null, 2));
