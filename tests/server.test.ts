import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { Agent, request } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createAppServer, resolvePublicDir } from "../src/server.js";
import { store } from "../src/state/store.js";

const server = createAppServer();
let port: number;
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
});

function send({ method = "POST", path = "/api/reset", host = "localhost", contentType = "application/json", chunks = [Buffer.from("{}")], agent }: {
  method?: string; path?: string; host?: string; contentType?: string;
  chunks?: Buffer[]; agent?: Agent;
} = {}) {
  return new Promise<{ status: number; text: string; body: any; socket: unknown }>((resolve, reject) => {
    const req = request({
      hostname: "127.0.0.1", port, method, path, agent, setHost: false,
      headers: { Host: host, ...(contentType ? { "Content-Type": contentType } : {}) },
    }, (res) => {
      const parts: Buffer[] = [];
      res.on("data", (chunk: Buffer) => parts.push(chunk));
      res.on("error", reject);
      res.on("end", () => {
        const text = Buffer.concat(parts).toString("utf8");
        resolve({ status: res.statusCode!, text, body: res.headers["content-type"]?.includes("application/json") ? JSON.parse(text) : text, socket: req.socket });
      });
    });
    req.on("error", reject);
    for (const chunk of chunks) req.write(chunk);
    req.end();
  });
}

it.each(["", "text/plain", "application/x-www-form-urlencoded", "application/jsonp"])("requires JSON media type: %s", async (contentType) => {
  const before = JSON.stringify(store.result);
  const reply = await send({ contentType });
  expect(reply).toMatchObject({ status: 415, body: { success: false, error: { code: "UNSUPPORTED_MEDIA_TYPE" } } });
  expect(JSON.stringify(store.result)).toBe(before);
});

it.each(["application/json", "application/json; charset=utf-8", "Application/JSON"])("accepts JSON media type: %s", async (contentType) => {
  expect(await send({ contentType })).toMatchObject({ status: 200, body: { success: true } });
});

it.each(["localhost", "LOCALHOST:4610", "127.0.0.1:4610", "[::1]:4610"])("accepts local Host: %s", async (host) => {
  expect((await send({ host })).status).toBe(200);
});

it.each(["", "outside.invalid", "localhost.outside.invalid", "localhost@outside.invalid", "outside.invalid/localhost", "127.1", "0x7f000001"])("rejects foreign or malformed Host: %s", async (host) => {
  const before = JSON.stringify(store.result);
  expect(await send({ host })).toMatchObject({ status: 421, body: { success: false, error: { code: "MISDIRECTED_REQUEST" } } });
  expect(JSON.stringify(store.result)).toBe(before);
});

it("allows only the exact configured HOST in addition to loopback", async () => {
  vi.stubEnv("HOST", "desk.internal");
  expect((await send({ host: "desk.internal:4610" })).status).toBe(200);
  expect((await send({ host: "desk.internal.outside.invalid" })).status).toBe(421);
});

it("applies POST guards to decision, reopen and unknown API routes", async () => {
  for (const path of ["/api/packets/missing/decision", "/api/matches/missing/reopen", "/api/missing"]) {
    expect((await send({ path, contentType: "" })).status).toBe(415);
    expect((await send({ path, host: "outside.invalid" })).status).toBe(421);
  }
});

it("returns a JSON error for malformed JSON", async () => {
  expect(await send({ chunks: [Buffer.from("{")] })).toMatchObject({
    status: 400, body: { success: false, error: { code: "INVALID_JSON" } },
  });
});

it("reassembles UTF-8 split across chunks before parsing", async () => {
  store.reset();
  const p = store.result.packets[0];
  const note = "Checked € and 漢字.";
  const body = Buffer.from(JSON.stringify({ action: "send_back", actor: "priya", note }));
  const split = body.indexOf(Buffer.from("€")) + 1;
  const reply = await send({ path: `/api/packets/${p.id}/decision`, chunks: [body.subarray(0, split), body.subarray(split)] });
  expect(reply.status).toBe(200);
  expect(store.audit.at(-1)?.note).toBe(note);
});

it("enforces bytes, accepts the exact limit, and preserves the keep-alive connection after 413", async () => {
  const agent = new Agent({ keepAlive: true, maxSockets: 1 });
  try {
    const boundary = Buffer.from(JSON.stringify("a".repeat(16382)));
    expect(boundary.length).toBe(16384);
    const first = await send({ chunks: [boundary], agent });
    expect(first.status).toBe(200);
    // Fewer than 16,384 characters, but more than 16,384 UTF-8 bytes.
    const oversized = Buffer.from(JSON.stringify("€".repeat(6000)));
    const large = await send({ chunks: [oversized.subarray(0, 10000), oversized.subarray(10000)], agent });
    expect(large).toMatchObject({ status: 413, body: { success: false, error: { code: "BODY_TOO_LARGE" } } });
    expect(large.socket).toBe(first.socket);
    const next = await send({ agent });
    expect(next.status).toBe(200);
    expect(next.socket).toBe(first.socket);
    expect((await send({ chunks: [Buffer.concat([boundary, Buffer.from(" ")])], agent })).status).toBe(413);
  } finally {
    agent.destroy();
  }
});

it("serves the SPA and static modules without a POST content type", async () => {
  expect(await send({ method: "GET", path: "/", contentType: "", chunks: [] })).toMatchObject({ status: 200, text: expect.stringContaining('id="app"') });
  expect((await send({ method: "GET", path: "/lib/api.js", chunks: [] })).status).toBe(200);
});

it("finds an adjacent public directory regardless of output-folder name, with a parent fallback", async () => {
  const root = await mkdtemp(join(tmpdir(), "recon-public-"));
  try {
    const output = join(root, "release");
    await mkdir(output);
    await mkdir(join(root, "public"));
    const moduleUrl = pathToFileURL(join(output, "server.js")).href;
    expect(resolvePublicDir(moduleUrl)).toBe(join(root, "public") + "/");
    await writeFile(join(output, "public"), "a file is not a directory");
    expect(resolvePublicDir(moduleUrl)).toBe(join(root, "public") + "/");
    await rm(join(output, "public"));
    await mkdir(join(output, "public"));
    expect(resolvePublicDir(moduleUrl)).toBe(join(output, "public") + "/");
    // A source checkout nested under a folder named dist still needs the fallback.
    await mkdir(join(root, "dist", "src"), { recursive: true });
    await mkdir(join(root, "dist", "public"));
    expect(resolvePublicDir(pathToFileURL(join(root, "dist", "src", "server.ts")).href))
      .toBe(join(root, "dist", "public") + "/");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
