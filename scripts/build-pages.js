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
  "input.js",
  "logic.js",
  "branding.js",
  "pose.js",
  "party.js",
  "sound.js",
  "share.js",
  "tilt.js",
  "traffic.js",
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
  for (const file of PUBLIC_FILES) {
    const info = await lstat(resolve(source, file));
    if (!info.isFile() || info.isSymbolicLink())
      throw new Error(`Public source must be a regular file: ${file}`);
  }
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  for (const file of PUBLIC_FILES)
    await copyFile(resolve(source, file), resolve(destination, file));
  await writeFile(resolve(destination, ".nojekyll"), "");
  return [...PUBLIC_FILES, ".nojekyll"];
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
