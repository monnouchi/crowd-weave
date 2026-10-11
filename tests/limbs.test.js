import test from "node:test";
import assert from "node:assert/strict";
import { drawCharacter, appearanceFor } from "../character.js";
import { createWalkingPose } from "../pose.js";
import { createGame } from "../logic.js";
const directions = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];
function recorder(skin, shirt) {
  const output = { arms: [], hands: [] },
    values = { globalAlpha: 1 },
    stack = [];
  let path = [];
  const c = new Proxy(values, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === "save") return () => stack.push({ ...t });
      if (k === "restore") return () => Object.assign(t, stack.pop());
      if (k === "beginPath") return () => (path = []);
      if (k === "moveTo" || k === "lineTo")
        return (...args) => path.push([k, ...args]);
      if (k === "arc") return (...args) => path.push(["arc", ...args]);
      if (k === "stroke")
        return () => {
          if (t.strokeStyle === shirt && t.lineWidth === 4)
            output.arms.push(path);
        };
      if (k === "fill")
        return () => {
          if (t.fillStyle === skin)
            for (const p of path)
              if (p[0] === "arc" && p[3] >= 2.3 && p[3] <= 2.6)
                output.hands.push(p);
        };
      return () => {};
    },
    set(t, k, v) {
      t[k] = v;
      return true;
    },
  });
  return { c, output };
}
function check(p, heading, options = {}) {
  const shirt = options.player ? "#2185ae" : "#b27389",
    person = { ...p, shirt },
    skin = appearanceFor(person, !!options.player).skin;
  // Fix the clothing color while retaining all actual anatomy and prop paths.
  const { c, output } = recorder(skin, shirt);
  drawCharacter(c, person, {
    pose: createWalkingPose(person, { x: heading[0], y: heading[1] }),
    ...options,
  });
  assert.equal(
    output.arms.length,
    2,
    JSON.stringify({
      id: p.id,
      state: p.state,
      heading,
      options,
      arms: output.arms,
    }),
  );
  assert.equal(
    output.hands.length,
    2,
    JSON.stringify({
      id: p.id,
      state: p.state,
      heading,
      options,
      hands: output.hands,
    }),
  );
  return output;
}
test("all five waiting friends and their joined versions draw exactly two arms and hands in eight directions", () => {
  for (let stage = 0; stage < 5; stage++)
    for (const heading of directions) {
      const waiting = createGame(stage).meetingPartner;
      check(waiting, heading, { waving: true, wave: 2 });
      check(waiting, heading, { waving: true, reducedMotion: true });
      if (stage < 4) check(createGame(stage + 1).party.members.at(-1), heading);
      check({ ...waiting, state: "celebrating" }, heading);
    }
});
test("waves, held umbrellas and glow sticks replace shoulder poses without additional limbs for every look", () => {
  for (let id = 0; id < 12; id++)
    for (const heading of directions)
      for (const props of [
        {},
        { suitcase: true },
        { umbrella: true },
        { glowStick: true },
        { umbrella: true, glowStick: true },
      ])
        for (const state of ["waiting", "walking", "reading", "celebrating"]) {
          check(
            {
              id,
              appearanceId: id,
              x: 0,
              y: 0,
              r: 13,
              partner: true,
              color: 0,
              ...props,
              state,
            },
            heading,
            { waving: state === "waiting", live: true, wave: -2 },
          );
        }
});

test("the player and all four companions celebrate with one arm per shoulder", () => {
  const game = createGame(4);
  for (const heading of directions) {
    check({ ...game.player, state: "celebrating" }, heading, {
      player: true,
      live: true,
    });
    for (const p of game.party.members)
      check({ ...p, state: "celebrating" }, heading, { live: true });
  }
});
