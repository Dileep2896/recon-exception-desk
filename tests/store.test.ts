import { it, expect, beforeEach } from "vitest";
import { Store } from "../src/state/store.js";
let store: Store;
beforeEach(() => (store = new Store()));
it("approval records actor, note and draft-only approval", () => {
  const p = store.result.packets.find((p) => p.draftEntry)!;
  store.decide(p.id, {
    action: "approve",
    actor: p.reviewer.name,
    note: "Fee checked against payout evidence.",
  });
  expect(p.status).toBe("approved");
  expect(p.draftEntry!.status).toBe("approved");
  expect(store.audit[0]).toMatchObject({
    packetId: p.id,
    action: "approve",
    actor: p.reviewer.name,
    note: "Fee checked against payout evidence.",
  });
  expect(store.audit[0].at).toMatch(/^\d{4}-/);
  expect(p).not.toHaveProperty("posted");
});
it("send back and reassign retain audit and routing", () => {
  const p = store.result.packets[0];
  store.decide(p.id, {
    action: "send_back",
    actor: "Priya Raman",
    note: "Please confirm receipt.",
  });
  expect(p.status).toBe("sent_back");
  store.decide(p.id, {
    action: "reassign",
    actor: "Priya Raman",
    note: "AP owns this item.",
    reviewerId: "mei",
  });
  expect(p.reviewer.id).toBe("mei");
  expect(store.audit).toHaveLength(2);
});
it("rejects invalid decisions without mutation", () => {
  const id = store.result.packets[0].id;
  for (const payload of [
    { action: "post", actor: "X", note: "x" },
    { action: "approve", actor: "X", note: "" },
    { action: "reassign", actor: "X", note: "x", reviewerId: "nobody" },
  ])
    expect(() => store.decide(id, payload)).toThrow();
  expect(store.audit).toHaveLength(0);
});
it("reset restores fixture and clears audit", () => {
  store.decide(store.result.packets[0].id, {
    action: "approve",
    actor: store.result.packets[0].reviewer.id,
    note: "Reviewed.",
  });
  store.reset();
  expect(store.audit).toHaveLength(0);
  expect(store.result.packets.every((p) => p.status === "open")).toBe(true);
});
it("reopens a clean match for review, preserving the tie-out", () => {
  const m = store.result.matches[0];
  const p = store.reopen(m.id, "Priya Raman", "Request a second look.");
  expect(store.result.matches.some((x) => x.id === m.id)).toBe(false);
  expect(p.status).toBe("open");
  expect(store.audit[0].action).toBe("reopen");
  expect(store.result.tieOut.unexplainedCents).toBe(0);
});
it("requires controller co-approval above materiality", () => {
  const p = store.result.packets.find(
    (p) => p.materiality === "above" && p.draftEntry,
  )!;
  store.decide(p.id, {
    action: "approve",
    actor: p.reviewer.name,
    note: "Owner evidence review completed.",
  });
  expect(p.status).toBe("open");
  expect(p.draftEntry!.status).toBe("draft");
  store.decide(p.id, {
    action: "approve",
    actor: "Daniel Ortiz",
    note: "Controller review completed.",
  });
  expect(p.status).toBe("approved");
  expect(p.draftEntry!.status).toBe("approved");
  expect(store.audit).toHaveLength(2);
});
it("sending back clears earlier approvals", () => {
  const p = store.result.packets.find((p) => p.materiality === "above")!;
  store.decide(p.id, {
    action: "approve",
    actor: p.reviewer.name,
    note: "First review.",
  });
  store.decide(p.id, {
    action: "send_back",
    actor: p.reviewer.name,
    note: "Need more evidence.",
  });
  expect(p.approvals).toEqual([]);
});

it("rejects unknown, inexact and overlong actors for every mutation without changing state", () => {
  const before = JSON.stringify({ result: store.result, audit: store.audit });
  for (const actor of ["Unknown reviewer", "priya raman", " Priya Raman ", "x".repeat(101)]) {
    for (const action of ["approve", "send_back", "reassign"]) {
      expect(() => store.decide(store.result.packets[0].id, {
        action, actor, note: "Reviewed.", reviewerId: "priya",
      })).toThrow();
    }
    expect(() => store.reopen(store.result.matches[0].id, actor, "Review again.")).toThrow();
  }
  expect(JSON.stringify({ result: store.result, audit: store.audit })).toBe(before);
});

it("requires a routed reviewer even below materiality and canonicalizes id/name approvals", () => {
  const p = store.result.packets.find((p) => p.materiality === "below" && p.draftEntry)!;
  const outsider = store.input.reviewers.find((r) => !p.requiredReviewers.some((x) => x.id === r.id))!;
  expect(() => store.decide(p.id, { action: "approve", actor: outsider.id, note: "Checked." })).toThrow();
  expect(p.approvals).toEqual([]);
  store.decide(p.id, { action: "approve", actor: p.reviewer.id, note: "Checked." });
  store.decide(p.id, { action: "approve", actor: p.reviewer.name, note: "Checked again." });
  expect(p.approvals).toEqual([p.reviewer.name]);
  expect(p.status).toBe("approved");
  expect(store.audit.every((a) => a.actor === p.reviewer.name)).toBe(true);
});

it("reassignment removes old authority and requires the new owner plus controller", () => {
  const p = store.result.packets.find((p) => p.materiality === "above" && p.reviewer.id === "priya")!;
  store.decide(p.id, { action: "approve", actor: "priya", note: "Reviewed." });
  store.decide(p.id, { action: "reassign", actor: "daniel", reviewerId: "mei", note: "AP review." });
  expect(p.approvals).toEqual([]);
  expect(() => store.decide(p.id, { action: "approve", actor: "priya", note: "Reviewed." })).toThrow();
  store.decide(p.id, { action: "approve", actor: "mei", note: "Reviewed." });
  expect(p.status).toBe("open");
  store.decide(p.id, { action: "approve", actor: "Daniel Ortiz", note: "Reviewed." });
  expect(p.status).toBe("approved");
});

it("reopening accepts reviewer ids and records the canonical name", () => {
  store.reopen(store.result.matches[0].id, "mei", "Review again.");
  expect(store.audit[0].actor).toBe("Mei Lin");
});

it("keeps attribution stable while pending and approved totals follow the review lifecycle", () => {
  const initial = structuredClone(store.result.tieOut);
  const p = store.result.packets.find((p) => p.materiality === "above" && p.draftEntry)!;
  const delta = initial.bookAdjustments.find((x) => x.packetId === p.id)!.amountCents;
  store.decide(p.id, { action: "approve", actor: p.reviewer.id, note: "Owner review." });
  expect(store.result.tieOut).toEqual(initial);
  store.decide(p.id, { action: "approve", actor: "daniel", note: "Controller review." });
  expect(store.result.tieOut).toMatchObject({
    unexplainedCents: 0,
    pendingCount: initial.pendingCount - 1,
    pendingAdjustmentsCents: initial.pendingAdjustmentsCents - delta,
    approvedAdjustedBookCents: initial.ledgerEndingCents + delta,
  });
  store.reopen(store.result.matches[0].id, "priya", "Review again.");
  expect(store.result.tieOut.pendingCount).toBe(initial.pendingCount - 1);
  store.decide(p.id, { action: "send_back", actor: "daniel", note: "More evidence." });
  expect(store.result.tieOut).toEqual(initial);
  for (const reviewer of p.requiredReviewers)
    store.decide(p.id, { action: "approve", actor: reviewer.id, note: "Reviewed." });
  store.decide(p.id, { action: "reassign", actor: "daniel", reviewerId: "mei", note: "AP review." });
  expect(store.result.tieOut).toEqual(initial);
  store.reset();
  expect(store.result.tieOut).toEqual(initial);
});

it("counts the Suspense draft as pending until approved, including when it is the last draft", () => {
  const suspense = store.result.packets.find((p) => p.reason === "UNRECOGNIZED_BANK_ITEM")!;
  for (const p of store.result.packets.filter((p) => p.draftEntry && p !== suspense))
    for (const reviewer of p.requiredReviewers)
      store.decide(p.id, { action: "approve", actor: reviewer.id, note: "Reviewed." });
  expect(store.result.tieOut).toMatchObject({
    unexplainedCents: 0, pendingCount: 1,
    pendingAdjustmentsCents: suspense.differenceCents,
  });
  for (const reviewer of suspense.requiredReviewers)
    store.decide(suspense.id, { action: "approve", actor: reviewer.id, note: "Reviewed suspense." });
  expect(store.result.tieOut).toMatchObject({
    unexplainedCents: 0, pendingCount: 0, pendingAdjustmentsCents: 0,
    approvedAdjustedBookCents: store.result.tieOut.adjustedBookCents,
  });
});
