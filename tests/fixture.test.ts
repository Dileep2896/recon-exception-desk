import { it, expect } from "vitest";
import { september, septemberTruth } from "../src/fixtures/september.js";
import { reconcile } from "../src/engine/reconcile.js";
it("has the prescribed fictional case mix", () => {
  const groups = new Map(
    [...september.bankLines, ...september.ledgerEntries].map((x) => [
      septemberTruth.get(x.id)!.group,
      septemberTruth.get(x.id)!.reason,
    ]),
  );
  const counts: Record<string, number> = {};
  for (const reason of groups.values())
    counts[reason] = (counts[reason] || 0) + 1;
  expect(counts).toEqual({
    clean: 106,
    FEE_NOT_BOOKED: 2,
    AMBIGUOUS_MATCH: 2,
    AMOUNT_DIFFERENCE: 2,
    TRANSPOSITION: 1,
    DUPLICATE_LEDGER: 2,
    UNRECORDED_BANK_ITEM: 4,
    UNRECOGNIZED_BANK_ITEM: 1,
    MISSING_SUPPORT: 2,
    OUTSTANDING_CHECK: 3,
    DEPOSIT_IN_TRANSIT: 1,
  });
  expect(september.bankLines.filter((x) => x.payoutId)).toHaveLength(6);
});
it("computes opening plus source movement for each ending balance", () => {
  expect(september.bankEndingCents).toBe(
    september.openingCents +
      september.bankLines.reduce((s, x) => s + x.amountCents, 0),
  );
  expect(september.ledgerEndingCents).toBe(
    september.openingCents +
      september.ledgerEntries.reduce((s, x) => s + x.amountCents, 0),
  );
});
it("each source line is consumed once and all evidence ids resolve", () => {
  const r = reconcile(september);
  const ids = [...r.matches, ...r.packets].flatMap((x) =>
    [...x.bankLines, ...x.ledgerEntries].map((x) => x.id),
  );
  expect(ids.length).toBe(new Set(ids).size);
  expect(ids.length).toBe(
    september.bankLines.length + september.ledgerEntries.length,
  );
  const evidence = new Set([...ids, ...september.documents.map((x) => x.id)]);
  expect(
    [...r.matches, ...r.packets]
      .flatMap((x) => x.evidenceRefs)
      .every((id) => evidence.has(id)),
  ).toBe(true);
});
