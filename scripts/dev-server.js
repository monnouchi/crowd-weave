import http from "node:http";
import { createReadStream } from "node:fs";
import { appendFile, mkdir, realpath, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".json": "application/json" };
export function createDevServer(directory = root, logDirectory = resolve(directory, "playlogs")) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (req.method === "POST" && url.pathname === "/__playlog") {
        // Reject cross-origin submissions, including form-compatible beacons.
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) { res.writeHead(403).end(); return; }
        let body = "";
        for await (const chunk of req) { body += chunk; if (body.length > 1024 * 1024) { res.writeHead(413).end(); return; } }
        const lines = body.split("\n").filter(Boolean);
        for (const line of lines) JSON.parse(line);
        await mkdir(logDirectory, { recursive: true });
        await appendFile(resolve(logDirectory, "events.jsonl"), lines.join("\n") + (lines.length ? "\n" : ""));
        res.writeHead(204).end(); return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405).end(); return; }
      const path = resolve(directory, "." + decodeURIComponent(url.pathname), url.pathname.endsWith("/") ? "index.html" : "");
      const base = await realpath(directory), actual = await realpath(path);
      if (!actual.startsWith(base + sep) || !(await stat(actual)).isFile()) { res.writeHead(404).end(); return; }
      res.writeHead(200, { "Content-Type": types[extname(actual)] || "application/octet-stream" });
      if (req.method === "HEAD") res.end(); else createReadStream(actual).pipe(res);
    } catch { if (!res.headersSent) res.writeHead(404).end(); else res.destroy(); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  createDevServer().listen(4175, "127.0.0.1", () => console.log("Serving http://127.0.0.1:4175"));
