import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../logic.js";
import {
  scenePalette,
  surroundings,
  paintFloor,
  floorDetails,
  architecture,
  goalBoundary,
  goalMark,
  streetFurniture,
  venueJourney,
  hallInterior,
  rainShelters,
} from "../art.js";

test("scenery renders all five frozen scenes without changing the model or game randomness", () => {
  const context = new Proxy(
    { globalAlpha: 1 },
    {
      get: (o, k) => (k in o ? o[k] : () => {}),
      set: (o, k, v) => ((o[k] = v), true),
    },
  );
  const originalRandom = Math.random;
  try {
    for (let stage = 0; stage < 5; stage++) {
      const game = createGame(stage, 2026),
        before = structuredClone(game),
        scene = Object.freeze(game.scene);
      Math.random = () => {
        throw Error("Rendering must not consume game entropy");
      };
      assert.ok(scenePalette(scene).ground);
      surroundings(context, scene, {
        left: -240,
        right: 720,
        top: -250,
        bottom: 1300,
      });
      paintFloor(context, scene, game.worldHeight);
      floorDetails(context, scene);
      architecture(context, scene, {
        time: 8,
        complete: true,
        reducedMotion: false,
      });
      goalBoundary(context, scene);
      goalMark(context, scene);
      streetFurniture(context, scene, { startY: game.startY });
      if (stage === 3) {
        venueJourney(context);
        rainShelters(context, { time: 8 });
      }
      if (stage === 4) hallInterior(context, { time: 8 });
      assert.deepEqual(game, before);
      Math.random = originalRandom;
    }
  } finally {
    Math.random = originalRandom;
  }
});
