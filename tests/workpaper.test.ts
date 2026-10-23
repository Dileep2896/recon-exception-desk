import { it, expect } from "vitest";
import { Store } from "../src/state/store.js";
import { workpaper } from "../src/engine/workpaper.js";
it("exports tie-out, every packet, evidence, reviewers and audit", () => {
  const s = new Store();
  s.decide(s.result.packets[0].id, {
    action: "approve",
    actor: s.result.packets[0].reviewer.name,
    note: "Checked the evidence.",
  });
  const text = workpaper(s.input, s.result, s.audit);
  expect(text).toContain("# Bank reconciliation workpaper");
  expect(text).toContain("$0.00");
  expect(text).toContain("Checked the evidence.");
  expect(text).toContain("never posted");
  for (const p of s.result.packets) {
    expect(text).toContain(p.id);
    expect(text).toContain(p.reason);
    expect(text).toContain(p.reviewer.name);
    for (const id of p.evidenceRefs) expect(text).toContain(id);
  }
});

it("separates pending and approved adjustments, including Suspense", () => {
  const s = new Store();
  const p = s.result.packets.find((p) => p.draftEntry && p.materiality === "below")!;
  s.decide(p.id, { action: "approve", actor: p.reviewer.id, note: "Reviewed." });
  const suspense = s.result.packets.find((p) => p.reason === "UNRECOGNIZED_BANK_ITEM")!;
  const text = workpaper(s.input, s.result, s.audit);
  expect(text).toContain(`${p.id} · approved`);
  expect(text).toContain(`${suspense.id} · pending approval`);
  expect(text).toContain(`Pending approval (${s.result.tieOut.pendingCount} drafts; net cash movement)`);
  expect(text).toContain("Approved adjustments");
  expect(text).toContain("Approved adjusted book (approved drafts only)");
  expect(text).not.toContain("truth");
});
