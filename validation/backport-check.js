import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createGame, step } from "../logic.js";
import { moveCrowd } from "../crowd.js";
import { planRoute, routeInput } from "./plan-route.js";
import { trafficViolations } from "../traffic.js";
const results = [];
for (const seed of [17, 2026, 1402486078, 1, 97, 4004]) {
  const g = createGame(4, seed),
    crowd = g.crowd;
  let minY = Infinity,
    maxCycles = 0,
    centralMin = Infinity,
    centralMax = 0,
    frontMin = Infinity;
  for (let n = 0; n < 3520; n++) {
    moveCrowd(crowd, 0.025);
    for (const p of crowd) if (p.active) minY = Math.min(minY, p.y);
    const center = crowd.filter(
      (p) => p.active && p.x > 180 && p.x < 300,
    ).length;
    centralMin = Math.min(centralMin, center);
    centralMax = Math.max(centralMax, center);
    frontMin = Math.min(
      frontMin,
      crowd.filter((p) => p.active && p.y < 310).length,
    );
  }
  assert.ok(minY >= 33);
  assert.ok(
    crowd.some((p) => p.cycle > 0),
    "rear lifecycle cycles",
  );
  assert.ok(centralMax >= 6);
  assert.ok(frontMin > 4);
  assert.ok(
    crowd.every((p) => p.entry.y >= 620 && p.route.every((t) => t.y >= 33)),
  );
  let route = planRoute(4, seed, 40);
  for (const delay of [2, 4, 6, 8, 10, 15]) {
    if (route) break;
    route = planRoute(4, seed, 40, delay);
  }
  assert.ok(route, `route ${seed}`);
  const replay = createGame(4, seed);
  replay.phase = "playing";
  for (const action of route.path)
    for (let k = 0; k < 4; k++) step(replay, 0.025, routeInput(action));
  assert.equal(replay.phase, "finished");
  assert.equal(replay.hits, 0);
  assert.equal(trafficViolations(replay), 0);
  assert.ok(replay.party.members.every((p) => p.docked));
  results.push({
    seed,
    minY,
    centralMin,
    centralMax,
    frontMin,
    cycles: crowd.reduce((n, p) => n + p.cycle, 0),
    route,
    arrival: replay.elapsed,
    hits: replay.hits,
    docked: 4,
  });
}
const routes = [];
for (let stage = 0; stage < 5; stage++)
  routes.push(planRoute(stage, 1402485690 + stage * 97, 40));
assert.ok(routes.every(Boolean));
await writeFile("output/backport/routes.json", JSON.stringify(routes, null, 2));
await writeFile(
  "output/backport/audience-check.json",
  JSON.stringify(results, null, 2),
);
console.log(
  JSON.stringify(
    {
      result: "PASS",
      seeds: results.map(({ route, ...r }) => r),
      routes: routes.map((r) => r.seconds),
    },
    null,
    2,
  ),
);
