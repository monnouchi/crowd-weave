import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  copyFile,
  readdir,
  readFile,
  symlink,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPages } from "../scripts/build-pages.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const expected = [
  ".nojekyll",
  "LICENSE",
  "art.js",
  "branding.js",
  "crowd.js",
  "game.js",
  "index.html",
  "input.js",
  "logic.js",
  "og.png",
  "party.js",
  "pose.js",
  "share.js",
  "sound.js",
  "style.css",
  "tilt.js",
  "traffic.js",
];
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "crowd-pages-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = join(dir, "source"),
    destination = join(dir, "site");
  await mkdir(source);
  for (const file of expected.filter((f) => f !== ".nojekyll"))
    await copyFile(join(root, file), join(source, file));
  return { source, destination };
}
test("Pages build excludes private notes, local verification and stale files", async (t) => {
  const { source, destination } = await fixture(t);
  await writeFile(join(source, ".env"), "PRIVATE_TEST_FIXTURE=value");
  await writeFile(join(source, "internal.md"), "PRIVATE_TEST_FIXTURE");
  await mkdir(join(source, "output"));
  await writeFile(join(source, "output", "notes.txt"), "PRIVATE_TEST_FIXTURE");
  await mkdir(destination);
  await writeFile(
    join(destination, "stale-secret.txt"),
    "PRIVATE_TEST_FIXTURE",
  );
  await buildPages(source, destination);
  assert.deepEqual((await readdir(destination)).sort(), expected);
  for (const file of expected)
    assert.ok(
      !(await readFile(join(destination, file), "utf8")).includes(
        "PRIVATE_TEST_FIXTURE",
      ),
    );
  assert.match(
    await readFile(join(destination, "LICENSE"), "utf8"),
    /Copyright \(c\) 2026 monnouchi/,
  );
});
test("Pages build preserves game code and rejects symlink sources and destructive output", async (t) => {
  const { source, destination } = await fixture(t);
  await buildPages(source, destination);
  for (const file of expected.filter((f) => f !== ".nojekyll"))
    assert.deepEqual(
      await readFile(join(destination, file)),
      await readFile(join(root, file)),
    );
  await assert.rejects(buildPages(source, source), /must not contain/);
  await assert.rejects(
    buildPages(source, resolve(source, "..")),
    /must not contain/,
  );
  await rm(join(source, "game.js"));
  await symlink(join(source, "logic.js"), join(source, "game.js"));
  await assert.rejects(buildPages(source, destination), /regular file/);
});
test("Browser asset references stay within a GitHub Pages project base path", async () => {
  const base = new URL("https://monnouchi.github.io/crowd-weave/");
  const html = await readFile(join(root, "index.html"), "utf8");
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((x) => !x.startsWith("data:"));
  for (const file of [
    "game.js",
    "logic.js",
    "pose.js",
    "party.js",
    "sound.js",
    "share.js",
    "tilt.js",
    "traffic.js",
    "crowd.js",
    "input.js",
    "branding.js",
    "art.js",
  ]) {
    const code = await readFile(join(root, file), "utf8");
    for (const m of code.matchAll(/from\s+"([^"]+)"/g)) refs.push(m[1]);
  }
  for (const ref of refs) {
    const url = new URL(ref, base);
    assert.equal(url.origin, base.origin);
    assert.ok(url.pathname.startsWith("/crowd-weave/"), ref);
    if (url.pathname === base.pathname) continue;
    assert.ok(
      expected.includes(url.pathname.slice("/crowd-weave/".length)),
      ref,
    );
  }
});

test("static OGP has an original 1200x630 PNG and canonical HTTPS metadata", async () => {
  const html = await readFile(join(root, "index.html"), "utf8"),
    png = await readFile(join(root, "og.png"));
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  for (const value of [
    "og:title",
    "og:description",
    "og:image:width",
    "og:image:height",
    "og:image:type",
    "og:image:alt",
    "summary_large_image",
    "https://monnouchi.github.io/crowd-weave/og.png",
  ])
    assert.ok(html.includes(value), value);
});
