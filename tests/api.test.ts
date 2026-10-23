import { it, expect, beforeEach } from "vitest";
import { route } from "../src/api/routes.js";
import { store } from "../src/state/store.js";
beforeEach(() => store.reset());
it("health uses the success envelope", () => {
  expect(route("GET", "/api/health").body).toEqual({
    success: true,
    data: { status: "ok", engine: "ready", source: "fixture" },
  });
});
it("unknown API paths use an error envelope", () => {
  expect(route("GET", "/api/nope")).toMatchObject({
    status: 404,
    body: { success: false, error: { code: "NOT_FOUND" } },
  });
});
it("recon and packets provide seeded data", () => {
  expect(route("GET", "/api/recon").body).toMatchObject({
    success: true,
    data: { stats: { autoCleared: 106 } },
  });
  expect(route("GET", "/api/packets").status).toBe(200);
});
it("decisions append audit and reset restores the queue", () => {
  route("POST", "/api/reset");
  const packets = (route("GET", "/api/packets").body as any).data;
  const p = packets[0];
  expect(
    route("POST", `/api/packets/${p.id}/decision`, {
      action: "approve",
      actor: p.reviewer.name,
      note: "Evidence reviewed.",
    }).status,
  ).toBe(200);
  expect((route("GET", "/api/audit").body as any).data).toHaveLength(1);
  route("POST", "/api/reset");
  expect((route("GET", "/api/audit").body as any).data).toHaveLength(0);
});
it("invalid actions and malformed bodies return useful errors", () => {
  expect(route("POST", "/api/packets/missing/decision", null).status).toBe(400);
  expect(
    route("POST", "/api/packets/missing/decision", {
      action: "post",
      actor: "X",
      note: "x",
    }).status,
  ).toBe(404);
});
it("exports a downloadable Markdown workpaper", () => {
  const r = route("GET", "/api/export");
  expect(r.contentType).toContain("text/markdown");
  expect(r.body).toContain("# Bank reconciliation workpaper");
});

it("returns 400 envelopes for unknown or unauthorized actors on decisions and reopening", () => {
  const p = store.result.packets[0];
  const outsider = store.input.reviewers.find((r) => !p.requiredReviewers.some((x) => x.id === r.id))!;
  for (const actor of ["Unknown", "x".repeat(101), outsider.id])
    expect(route("POST", `/api/packets/${p.id}/decision`, { action: "approve", actor, note: "Reviewed." }))
      .toMatchObject({ status: 400, body: { success: false, error: { code: expect.any(String) } } });
  for (const actor of ["Unknown", "x".repeat(101)])
    expect(route("POST", `/api/matches/${store.result.matches[0].id}/reopen`, { actor, note: "Review again." }))
      .toMatchObject({ status: 400, body: { success: false, error: { code: expect.any(String) } } });
  expect(store.audit).toHaveLength(0);
});

it("never includes evaluation labels in any API response body, including matches and mutations", () => {
  const p = store.result.packets[0];
  const replies = [
    ...["health", "recon", "packets", `packets/${p.id}`, "tieout", "eval", "audit", "export", "missing"]
      .map((path) => route("GET", `/api/${path}`)),
    route("POST", `/api/packets/${p.id}/decision`, { action: "approve", actor: p.reviewer.id, note: "Reviewed." }),
    route("POST", `/api/matches/${store.result.matches[0].id}/reopen`, { actor: "priya", note: "Review again." }),
    route("POST", "/api/reset"),
  ];
  for (const reply of replies) expect(JSON.stringify(reply.body)).not.toContain("truth");
});

it("refreshes pending totals across API decisions, reopening and reset without changing evaluation", () => {
  const data = (path: string) => (route("GET", path).body as any).data;
  const initial = structuredClone(data("/api/tieout"));
  const evaluation = data("/api/eval");
  const p = store.result.packets.find((p) => p.draftEntry && p.materiality === "below")!;
  route("POST", `/api/packets/${p.id}/decision`, { action: "approve", actor: p.reviewer.id, note: "Reviewed." });
  expect(data("/api/tieout").pendingCount).toBe(initial.pendingCount - 1);
  expect(data("/api/recon").tieOut).toEqual(data("/api/tieout"));
  route("POST", `/api/matches/${store.result.matches[0].id}/reopen`, { actor: "priya", note: "Review again." });
  expect(data("/api/tieout").pendingCount).toBe(initial.pendingCount - 1);
  expect(data("/api/eval")).toEqual(evaluation);
  route("POST", "/api/reset");
  expect(data("/api/tieout")).toEqual(initial);
});
