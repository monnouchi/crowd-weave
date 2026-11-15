import test from "node:test";
import assert from "node:assert/strict";
import { STAGES, courseOffsets, createCourseRun, createRun, beginRun, updateRun, retryRun } from "../src/run.js";

const round4 = (n) => Math.round(n * 10000) / 10000;
function crowdHash(crowd, dy = 0) {
  const rows = crowd.map((p) => [round4(p.x), round4(p.y - dy),
    round4(p.entry?.x ?? -1), round4((p.entry?.y ?? 0) - dy),
    (p.route || []).map((point) => [round4(point.x), round4(point.y - dy)]),
    p.r, round4(p.pace || 0), p.state, p.habit, p.flow, p.behavior || ""]);
  let hash = 5381;
  for (const c of JSON.stringify(rows)) hash = ((hash * 33) + c.charCodeAt(0)) >>> 0;
  return hash.toString(16);
}

test("course offsets connect each arrival to the next start", () => {
  const offsets = courseOffsets();
  assert.deepEqual(offsets, [0, -1041, -2422, -4463, -6144]);
  for (let k = 1; k < STAGES.length; k++) {
    assert.equal(offsets[k], offsets[k - 1] + 124 - STAGES[k].startY);
    assert.equal(offsets[k] + STAGES[k].startY - (offsets[k - 1] + 84), 40);
  }
});

test("course preserves seeded stage crowds and unique IDs", () => {
  const run = createCourseRun(), offsets = courseOffsets();
  const hashes = ["51b0c284", "a429953b", "1e125a37", "c69dcee6", "19d566c7"];
  const counts = [14, 24, 49, 54, 58];
  for (let k = 0; k < STAGES.length; k++) {
    const crowd = run.crowd.filter((p) => p.seg === k);
    assert.equal(crowd.length, counts[k]);
    assert.equal(crowdHash(crowd, offsets[k]), hashes[k]);
    assert.ok(crowd.every((p) => p.awarePlayer === run.player));
  }
  assert.equal(new Set(run.crowd.map((p) => p.id)).size, run.crowd.length);
});

test("course crowd is deterministic", () => {
  assert.equal(crowdHash(createCourseRun(20261115).crowd), crowdHash(createCourseRun(20261115).crowd));
});

function stepFrames(run, frames) {
  for (let i = 0; i < frames; i++) updateRun(run, 1 / 60, {});
}

test("course audience stays in its segment after 30 seconds", () => {
  const run = createCourseRun(), offsets = courseOffsets();
  beginRun(run);
  stepFrames(run, 1800);
  const audience = run.crowd.filter((p) => p.seg === 4);
  const inBand = (p) => p.y >= offsets[4] - 100 &&
    p.y <= offsets[4] + STAGES[4].startY + 300;
  assert.equal(audience.length, 58);
  assert.ok(audience.every(inBand));
  assert.ok(audience.filter((p) => p.active && inBand(p)).length >= 40);
  assert.equal(audience.filter((p) => p.y > offsets[3]).length, 0);
});

test("single-stage audience stays in its stage after 30 seconds", () => {
  const run = createRun(4, 1402485690 + 4 * 97);
  beginRun(run);
  stepFrames(run, 1800);
  assert.equal(run.crowd.length, 58);
  assert.ok(run.crowd.every((p) => p.y >= -100 && p.y <= STAGES[4].startY + 300));
});

test("stepped course crowds are deterministic", () => {
  const a = createCourseRun(20261115), b = createCourseRun(20261115);
  beginRun(a);
  beginRun(b);
  stepFrames(a, 600);
  stepFrames(b, 600);
  assert.equal(crowdHash(a.crowd), crowdHash(b.crowd));
});

function cross(run, k) {
  for (const person of run.crowd) person.y = run.course.offsets[k] + 600;
  run.combo.flow = 5;
  run.combo.maxFlow = 5;
  run.player.x = 240;
  run.player.y = run.course.offsets[k] + 89;
  // Teleport the party and trail along with the player to avoid artificial swept paths.
  run.party.members.forEach((member, i) => {
    member.x = 240;
    member.y = run.player.y + (i + 1) * 30;
  });
  run.party.trail = [{ x: 240, y: run.player.y + 180, s: run.party.distance - 180 },
    { x: 240, y: run.player.y, s: run.party.distance }];
  updateRun(run, 0.05, {});
}

test("course boundaries record splits and carry the party and combo", () => {
  const run = createCourseRun();
  beginRun(run);
  for (let k = 0; k < 4; k++) {
    cross(run, k);
    assert.equal(run.stage, k + 1);
    assert.equal(run.records.length, k + 1);
    assert.equal(run.records[k].stage, k);
    assert.equal(run.party.members.length, k + 1);
    assert.ok(run.events.some((event) => event.kind === "split"));
    assert.equal(run.combo.flow, 5);
    if (k) assert.ok(run.course.splits[k].total >= run.course.splits[k - 1].total);
  }
  cross(run, 4);
  assert.equal(run.phase, "finished");
  assert.equal(run.records.length, 5);
  assert.ok(run.events.some((event) => event.kind === "finale"));
});

test("course retry restores the current segment snapshot", () => {
  const run = createCourseRun();
  beginRun(run);
  cross(run, 0);
  const retry = retryRun(run), offset = run.course.offsets[1];
  assert.equal(retry.stage, 1);
  assert.equal(retry.records.length, 1);
  assert.equal(retry.phase, "ready");
  assert.equal(retry.course.index, 1);
  assert.ok(retry.player.y >= offset + 20 && retry.player.y <= offset + STAGES[1].startY + 55);
});

test("stage-select runs do not acquire a course", () => {
  assert.equal(createRun(2, 1402485690).course, undefined);
  assert.equal(createRun(0, 1402485690).course, undefined);
});
