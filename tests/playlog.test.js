import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDevServer } from "../scripts/dev-server.js";

test("development server serves files and accepts JSONL and beacon content types", async t => {
  const dir = await mkdtemp(join(tmpdir(), "playlog-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, "index.html"), "hello");
  const server = createDevServer(dir);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal(await (await fetch(base)).text(), "hello");
  for (const type of ["application/x-ndjson", "text/plain;charset=UTF-8"]) {
    const response = await fetch(base + "/__playlog", { method: "POST", headers: { "content-type": type }, body: '{"type":"test"}\n' });
    assert.equal(response.status, 204);
  }
  assert.equal(await readFile(join(dir, "playlogs/events.jsonl"), "utf8"), '{"type":"test"}\n{"type":"test"}\n');
});

test("run instrumentation emits observed events with fields", async () => {
  const posted = [];
  globalThis.window = {};
  globalThis.document = { createElement: () => ({ style: {} }), body: { append() {} } };
  globalThis.localStorage = { getItem: () => null, removeItem() {}, setItem() {} };
  globalThis.addEventListener = () => {};
  const originalFetch = globalThis.fetch, originalInterval = globalThis.setInterval;
  globalThis.fetch = async (url, options) => { posted.push(...options.body.trim().split("\n").map(JSON.parse)); return { ok: true }; };
  globalThis.setInterval = () => 0;
  try {
    const { createRun, beginRun, updateRun } = await import("../src/run.js");
    const { flush } = await import("../src/playlog.js");
    const run = createRun(0, 17);
    beginRun(run);
    const person = run.crowd.find(p => p.active && !p.animal);
    Object.assign(person, { x: run.player.x, y: run.player.y, vx: 0, vy: 0 });
    updateRun(run, .05, { call: true, callPulse: true });
    run.arriving = true;
    updateRun(run, .05, {});
    flush();
    for (const type of ["run_start", "contact", "call", "clear_summary"]) assert.ok(posted.some(e => e.type === type), type);
    assert.equal(posted.find(e => e.type === "run_start").seed, 17);
    assert.ok(posted.find(e => e.type === "contact").position);
    assert.equal(typeof posted.find(e => e.type === "call").gaugeBefore, "number");
    assert.ok(Array.isArray(posted.find(e => e.type === "clear_summary").stages));
  } finally {
    globalThis.fetch = originalFetch; globalThis.setInterval = originalInterval;
    delete globalThis.window; delete globalThis.document; delete globalThis.localStorage; delete globalThis.addEventListener;
  }
});
