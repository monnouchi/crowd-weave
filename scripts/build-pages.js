import { copyFile, lstat, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Only these files may be distributed as the website. Never copy the repo root.
export const PUBLIC_FILES = Object.freeze([
  "index.html",
  "og.png",
  "style.css",
  "game.js",
  "crowd.js",
  "character.js",
  "input.js",
  "logic.js",
  "bodies.js",
  "branding.js",
  "art.js",
  "finale.js",
  "pose.js",
  "party.js",
  "sound.js",
  "share.js",
  "tilt.js",
  "traffic.js",
  "LICENSE",
]);
export const PROTOTYPE_DIRECTORY = "prototype-stage1";
export const PROTOTYPE_FILES = Object.freeze([
  "stage1-3d.html",
  "stage1-3d.css",
  "stage1-3d.js",
  "stage1-3d-render.js",
  "character.js",
  "pose.js",
  "input.js",
  "logic.js",
  "crowd.js",
  "traffic.js",
  "party.js",
  "bodies.js",
]);
export const FULL_3D_DIRECTORY = "prototype-all-3d";
export const FULL_3D_FILES = Object.freeze([
  "all-stage-3d.html",
  "style.css",
  "game-all-3d.js",
  "world-3d.js",
  "stage1-3d-render.js",
  "share-all-3d.js",
  "tilt.js",
  "sound.js",
  "pose.js",
  "character.js",
  "branding.js",
  "logic.js",
  "traffic.js",
  "crowd.js",
  "party.js",
  "bodies.js",
  "input.js",
  "LICENSE",
]);
export async function buildPages(sourceRoot, destinationRoot) {
  const source = resolve(sourceRoot),
    destination = resolve(destinationRoot);
  const sourceFromDestination = relative(destination, source);
  if (
    source === destination ||
    (!sourceFromDestination.startsWith("..") &&
      !sourceFromDestination.startsWith("/"))
  )
    throw new Error("Build output must not contain the source directory");
  try {
    if ((await lstat(destination)).isSymbolicLink())
      throw new Error("Build output cannot be a symbolic link");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const file of new Set([...PUBLIC_FILES, ...PROTOTYPE_FILES, ...FULL_3D_FILES])) {
    const info = await lstat(resolve(source, file));
    if (!info.isFile() || info.isSymbolicLink())
      throw new Error(`Public source must be a regular file: ${file}`);
  }
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  for (const file of PUBLIC_FILES)
    await copyFile(resolve(source, file), resolve(destination, file));
  const prototype = resolve(destination, PROTOTYPE_DIRECTORY);
  await mkdir(prototype);
  for (const file of PROTOTYPE_FILES)
    await copyFile(resolve(source, file), resolve(prototype, file));
  const full3d = resolve(destination, FULL_3D_DIRECTORY);
  await mkdir(full3d);
  for (const file of FULL_3D_FILES)
    await copyFile(resolve(source, file), resolve(full3d, file));
  await writeFile(resolve(destination, ".nojekyll"), "");
  return [
    ...PUBLIC_FILES,
    ...PROTOTYPE_FILES.map((file) => `${PROTOTYPE_DIRECTORY}/${file}`),
    ...FULL_3D_FILES.map((file) => `${FULL_3D_DIRECTORY}/${file}`),
    ".nojekyll",
  ];
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const files = await buildPages(root, resolve(root, "_site"));
  console.log(
    `Pages artifact: _site/ (${files.length} files)\n${files.join("\n")}`,
  );
}
