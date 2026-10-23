import { it, expect } from "vitest";
import { september } from "../src/fixtures/september.js";
import { reconcile } from "../src/engine/reconcile.js";
it("ties the seed month to the cent with explicit adjustments", () => {
  const r = reconcile(september);
  expect(r.tieOut.unexplainedCents).toBe(0);
  expect(r.tieOut.bookAdjustments.length).toBeGreaterThan(0);
  expect(r.tieOut.depositsInTransit).toHaveLength(1);
  expect(r.tieOut.outstandingChecks).toHaveLength(3);
  expect(r.tieOut.pendingCount).toBe(12);
  expect(r.tieOut.pendingAdjustmentsCents).toBe(-91017);
  expect(r.tieOut.approvedAdjustedBookCents).toBe(september.ledgerEndingCents);
});
it("removing evidence cannot silently plug the statement balance", () => {
  const broken = structuredClone(september);
  const removed = broken.bankLines.shift()!;
  broken.bankEndingCents -= removed.amountCents;
  expect(reconcile(broken).tieOut.unexplainedCents).not.toBe(0);
});
it("every adjusting draft balances", () => {
  for (const p of reconcile(september).packets)
    if (p.draftEntry)
      expect(
        p.draftEntry.lines.reduce(
          (s, l) => s + l.debitCents - l.creditCents,
          0,
        ),
      ).toBe(0);
});

it("flags missing source evidence even when declared ending balances still tie", () => {
  const broken = structuredClone(september);
  broken.bankLines.shift();
  expect(reconcile(broken).tieOut.sourceComplete).toBe(false);
  expect(reconcile(broken).tieOut.bankSourceGapCents).not.toBe(0);
});
it("a missing statement fee leaves a non-zero declared-balance tie-out", () => {
  const broken = structuredClone(september);
  broken.bankLines = broken.bankLines.filter((x) => x.id !== "B-BANK-1");
  const r = reconcile(broken);
  expect(r.tieOut.unexplainedCents).toBe(-3500);
  expect(r.tieOut.sourceComplete).toBe(false);
});
