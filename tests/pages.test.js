import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp, mkdir, writeFile, copyFile, readdir, readFile, symlink, rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPages, PUBLIC_FILES } from "../scripts/build-pages.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const expected = [
  "LICENSE", "bodies.js", "crowd.js", "index.html",
  "input.js", "logic.js", "logo.png", "og.png", "party.js", "style.css",
  "traffic.js", "src/appearance.js", "src/audio.js", "src/main.js", "src/render.js", "src/run.js",
];

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "crowd-pages-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = join(dir, "source"), destination = join(dir, "site");
  await mkdir(source);
  for (const file of expected) {
    await mkdir(dirname(join(source, file)), { recursive: true });
    await copyFile(join(root, file), join(source, file));
  }
  return { source, destination };
}

async function listFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(join(directory, entry.name), name));
    else files.push(name);
  }
  return files.sort();
}

test("Pages artifact contains only the new game and excludes private or old-version files", async (t) => {
  const { source, destination } = await fixture(t);
  for (const file of [".env", "internal.md", "game.js", "all-stage-3d.html", "stage1-3d.html"])
    await writeFile(join(source, file), "PRIVATE_TEST_FIXTURE=value");
  await mkdir(join(source, "output"));
  await writeFile(join(source, "output", "raw.log"), "PRIVATE_TEST_FIXTURE");
  await mkdir(destination);
  await writeFile(join(destination, "stale-secret.txt"), "PRIVATE_TEST_FIXTURE");

  assert.deepEqual([...PUBLIC_FILES].sort(), expected.slice().sort());
  assert.deepEqual((await buildPages(source, destination)).sort(),
    [...expected, ".nojekyll"].sort());
  assert.deepEqual(await listFiles(destination), [...expected, ".nojekyll"].sort());
  for (const file of expected.filter((item) => !item.endsWith(".png")))
    assert.ok(!(await readFile(join(destination, file), "utf8")).includes("PRIVATE_TEST_FIXTURE"));
  assert.match(await readFile(join(destination, "LICENSE"), "utf8"),
    /Copyright \(c\) 2026 monnouchi/);
});

test("Pages copies exact files and rejects unsafe sources or output locations", async (t) => {
  const { source, destination } = await fixture(t);
  await buildPages(source, destination);
  for (const file of expected)
    assert.deepEqual(await readFile(join(destination, file)), await readFile(join(root, file)));
  await assert.rejects(buildPages(source, source), /must not contain/);
  await assert.rejects(buildPages(source, resolve(source, "..")), /must not contain/);

  await rm(join(source, "src", "main.js"));
  await symlink(join(source, "logic.js"), join(source, "src", "main.js"));
  await assert.rejects(buildPages(source, destination), /regular file/);
  await rm(join(source, "src", "main.js"));
  await copyFile(join(root, "src", "main.js"), join(source, "src", "main.js"));

  await rm(destination, { recursive: true });
  await symlink(source, destination);
  await assert.rejects(buildPages(source, destination), /symbolic link/);
});

test("HTML assets and module imports resolve inside the Pages project path", async () => {
  const base = new URL("https://monnouchi.github.io/crowd-weave/");
  const html = await readFile(join(root, "index.html"), "utf8");
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => [base, match[1]])
    .filter(([, ref]) => !ref.startsWith("data:"));
  for (const file of expected.filter((item) => item.endsWith(".js"))) {
    const code = await readFile(join(root, file), "utf8");
    for (const match of code.matchAll(/from\s+["']([^"']+)["']/g))
      refs.push([new URL(file, base), match[1]]);
  }
  for (const [owner, ref] of refs) {
    const url = new URL(ref, owner);
    assert.equal(url.origin, base.origin, `${owner.pathname}: ${ref}`);
    assert.ok(url.pathname.startsWith(base.pathname), `${owner.pathname}: ${ref}`);
    if (url.pathname === base.pathname) continue;
    assert.ok(expected.includes(url.pathname.slice(base.pathname.length)),
      `${owner.pathname}: ${ref}`);
  }
});

test("social preview uses the new original 1200×630 image and canonical page", async () => {
  const html = await readFile(join(root, "index.html"), "utf8");
  const png = await readFile(join(root, "og.png"));
  const logo = await readFile(join(root, "logo.png"));
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  assert.equal(logo.subarray(1, 4).toString(), "PNG");
  assert.ok(html.includes('src="./logo.png"'));
  assert.ok(html.includes("雑踏突破"));
  for (const value of [
    "og:title", "og:description", "og:image:width", "og:image:height",
    "og:image:type", "og:image:alt", "summary_large_image",
    "https://monnouchi.github.io/crowd-weave/og.png",
    '<link rel="canonical" href="https://monnouchi.github.io/crowd-weave/"',
  ]) assert.ok(html.includes(value), value);
  assert.ok(!html.includes("prototype-all-3d"));
  assert.ok(!html.includes("prototype-stage1"));
});
