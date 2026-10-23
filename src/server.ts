import { createServer, type IncomingMessage } from "node:http";
import { statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, extname, sep } from "node:path";
import { route } from "./api/routes.js";
import { error, type Reply } from "./lib/http.js";
export function resolvePublicDir(moduleUrl: string): string {
  const adjacent = fileURLToPath(new URL("./public/", moduleUrl));
  if (statSync(adjacent, { throwIfNoEntry: false })?.isDirectory()) return adjacent;
  return fileURLToPath(new URL("../public/", moduleUrl));
}
const publicDir = resolvePublicDir(import.meta.url);

export function allowedHost(host: string | undefined, configuredHost = process.env.HOST): boolean {
  const match = host?.match(/^(\[[^\]]+\]|[^:/?#@\s]+)(?::\d+)?$/);
  if (!match) return false;
  try {
    const hostname = match[1].toLowerCase();
    if (new URL(`http://${host}`).hostname !== hostname) return false;
    const configured = configuredHost?.toLowerCase();
    const configuredHostname = configured?.includes(":") && !configured.startsWith("[")
      ? `[${configured}]` : configured;
    return ["localhost", "127.0.0.1", "[::1]", configuredHostname]
      .includes(hostname);
  } catch {
    return false;
  }
}

class BodyTooLarge extends Error {}
function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    // Keep consuming after the limit: breaking an async iterator destroys the
    // request socket and can truncate the 413 or the next keep-alive request.
    req.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 16384) {
        chunks.length = 0;
        reject(new BodyTooLarge());
      } else {
        chunks.push(chunk);
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
export const createAppServer = () => createServer(async (req, res) => {
  const send = (reply: Reply) => {
    res.writeHead(reply.status, {
      "Content-Type": reply.contentType || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(reply.contentType ? {
        "Content-Disposition": 'attachment; filename="september-workpaper.md"',
      } : {}),
    });
    res.end(reply.contentType ? String(reply.body) : JSON.stringify(reply.body));
  };
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
  );
  try {
    const path = decodeURIComponent(
      new URL(req.url || "/", "http://localhost").pathname,
    );
    if (path.startsWith("/api/")) {
      if (!allowedHost(req.headers.host)) {
        req.resume();
        send(error("MISDIRECTED_REQUEST", "Host is not allowed.", 421));
        return;
      }
      if (req.method === "POST" && req.headers["content-type"]?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
        req.resume();
        send(error("UNSUPPORTED_MEDIA_TYPE", "POST requests require application/json.", 415));
        return;
      }
      let raw: Buffer;
      try {
        raw = await readBody(req);
      } catch (e) {
        if (!(e instanceof BodyTooLarge)) throw e;
        send(error("BODY_TOO_LARGE", "Request exceeds 16 KB.", 413));
        return;
      }
      let body: unknown;
      try {
        body = raw.length ? JSON.parse(raw.toString("utf8")) : undefined;
      } catch {
        send(error("INVALID_JSON", "Send a valid JSON body."));
        return;
      }
      send(route(req.method || "GET", path, body));
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end("Method not allowed");
      return;
    }
    const file = resolve(
      publicDir,
      "." +
        (path === "/"
          ? "/index.html"
          : path === "/story"
            ? "/story.html"
            : path),
    );
    if (!file.startsWith(resolve(publicDir) + sep)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
    });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(error("NOT_FOUND", "Resource not found.", 404).body),
    );
  }
});
export const server = createAppServer();
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) server.listen(
  Number(process.env.PORT || 4610),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      `Recon Exception Desk · http://localhost:${process.env.PORT || 4610}`,
    ),
);
