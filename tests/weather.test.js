import test from "node:test";
import assert from "node:assert/strict";
import { createGame, step } from "../logic.js";
import { drawCharacter } from "../character.js";
import { createWalkingPose } from "../pose.js";

test("rain, umbrellas and shelter destinations belong only to the outdoor venue approach", () => {
  for (let stage = 0; stage < 5; stage++) {
    const g = createGame(stage);
    if (stage !== 3) {
      assert.equal(g.scene.weather, undefined);
      assert.ok(g.crowd.every((p) => !p.weather && !p.umbrella));
      continue;
    }
    assert.equal(g.scene.weather, "rain");
    assert.equal(g.crowd.length, 30);
    assert.ok(g.crowd.some((p) => p.umbrella));
    assert.ok(g.crowd.some((p) => !p.umbrella));
    const shelters = g.crowd.filter((p) => p.habit === "shelter");
    assert.ok(shelters.length > 0);
    for (const p of shelters) {
      assert.equal(p.umbrella, false);
      assert.equal(p.route.length, 2);
      assert.ok([65, 415].includes(p.route[0].x));
      assert.ok([-80, 1260].includes(p.route.at(-1).y));
      assert.equal(p.r, 13);
    }
    for (const p of g.crowd.filter((p) => p.group))
      assert.ok(
        g.crowd
          .filter((q) => q.group === p.group)
          .every((q) => q.umbrella === p.umbrella),
      );
  }
});

test("people without umbrellas visibly reach shelter, wait, and continue to their original destination", () => {
  const g = createGame(3);
  g.phase = "playing";
  const sheltered = new Set(),
    leftShelter = new Set();
  const people = g.crowd.filter((p) => p.habit === "shelter"),
    goals = new Map(people.map((p) => [p.id, structuredClone(p.route.at(-1))]));
  for (let n = 0; n < 2800; n++) {
    step(g, 0.025, { left: true, right: true });
    for (const p of people) {
      if (p.state === "shelter") sheltered.add(p.id);
      if (sheltered.has(p.id) && p.leg === 1) leftShelter.add(p.id);
      assert.deepEqual(p.route.at(-1), goals.get(p.id));
    }
  }
  assert.ok(sheltered.size >= 2);
  assert.ok(leftShelter.size >= 2);
});

test("umbrella rendering preserves the carrier position, direction and collider", () => {
  const p = Object.freeze(
      structuredClone(createGame(3).crowd.find((p) => p.umbrella)),
    ),
    before = structuredClone(p);
  const c = new Proxy(
    { globalAlpha: 1 },
    {
      get: (t, k) => (k in t ? t[k] : () => {}),
      set: (t, k, v) => ((t[k] = v), true),
    },
  );
  const pose = Object.freeze({
    ...createWalkingPose(p, { x: 1, y: -1 }),
    moving: true,
    speed: 50,
    distance: 7,
  });
  assert.equal(drawCharacter(c, p, { pose }).view, "back-right");
  assert.deepEqual(p, before);
});
