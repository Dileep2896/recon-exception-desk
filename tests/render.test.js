// @vitest-environment jsdom
import { it, expect } from "vitest";
import { renderDesk } from "../public/views/desk.js";
import { renderTieout } from "../public/views/tieout.js";
import { september } from "../src/fixtures/september.js";
import { reconcile } from "../src/engine/reconcile.js";
import { Store } from "../src/state/store.js";
import { money } from "../public/lib/ui.js";
const recon = {
  ...reconcile(september),
  ...{
    documents: september.documents,
    rules: september.rules,
    reviewers: september.reviewers,
  },
};
it("renders bank evidence, decision controls, and draft-only notice", () => {
  document.body.innerHTML = renderDesk({
    recon,
    filters: {},
    selected: recon.packets[0].id,
  });
  expect(document.querySelector('[data-action="approve"]')).not.toBeNull();
  expect(document.body.textContent).toContain("Bank statement");
  expect(document.body.textContent).toContain("Approving never posts");
  expect(document.querySelector("textarea")).not.toBeNull();
});
it("renders empty filters gracefully", () => {
  document.body.innerHTML = renderDesk({
    recon,
    filters: { search: "no-such-result" },
    selected: null,
  });
  expect(document.body.textContent).toContain("No packets");
});
it("ties every adjustment link to its packet", () => {
  document.body.innerHTML = renderTieout({ recon });
  for (const x of recon.tieOut.bookAdjustments)
    expect(
      document.querySelector(`[href="#/desk/${x.packetId}"]`),
    ).not.toBeNull();
  expect(document.body.textContent).toContain("$0.00");
});

it("distinguishes attribution from approval even when the proposed balances tie", () => {
  const s = new Store();
  document.body.innerHTML = renderTieout({ recon: s.result });
  expect(document.body.textContent).toContain("Every cent attributed to a reason");
  expect(document.querySelector(".pending-approval").textContent).toContain(
    `Pending approval: ${money(s.result.tieOut.pendingAdjustmentsCents)} across ${s.result.tieOut.pendingCount} drafts`,
  );
  expect(document.body.textContent).toContain(`Approved adjusted book: ${money(s.input.ledgerEndingCents)}`);
  expect(document.body.textContent).not.toMatch(/every cent accounted for|reconciliation closed/i);
  for (const p of s.result.packets.filter((p) => p.draftEntry))
    for (const reviewer of p.requiredReviewers)
      s.decide(p.id, { action: "approve", actor: reviewer.id, note: "Reviewed." });
  document.body.innerHTML = renderTieout({ recon: s.result });
  expect(document.querySelector(".pending-approval").textContent).toContain("Pending approval: $0.00 across 0 drafts");
  expect(document.querySelector(".proof-banner").classList.contains("warning")).toBe(false);
});
