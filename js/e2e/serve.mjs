// Serves ../examples on http://localhost:4174 for the Playwright tests.
// localhost counts as a secure context, so the async Clipboard API is on.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../examples/", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png" };

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  try {
    const file = join(root, path === "/" ? "index.html" : path);
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(4174, "localhost", () => console.log("serving examples on http://localhost:4174"));
