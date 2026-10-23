import { it, expect } from "vitest";
import { september, septemberTruth } from "../src/fixtures/september.js";
import { reconcile } from "../src/engine/reconcile.js";
import { evaluate } from "../src/engine/eval.js";
import { baseline } from "../src/engine/baseline.js";
it("scores every labelled item at 100% against ground truth", () => {
  const e = evaluate(reconcile(september), september, septemberTruth);
  expect(e.engine.accuracy).toBe(1);
  expect(e.engine.total).toBe(282);
  expect(e.baseline.correct).toBe(180);
  expect(JSON.stringify(september)).not.toContain('"truth"');
  expect(e.engine.correct).toBe(e.engine.total);
  expect(e.engine.unexplainedItems).toBe(0);
  expect(e.baseline.unexplainedItems).toBeGreaterThan(
    e.engine.unexplainedItems,
  );
  expect(e.baseline.accuracy).toBeLessThan(e.engine.accuracy);
  expect(
    e.perReason.every((x) => x.engine.precision === 1 && x.engine.recall === 1),
  ).toBe(true);
});
it("baseline only consumes exact amount/date pairs", () => {
  for (const m of baseline(september).matches) {
    expect(m.bankLines).toHaveLength(1);
    expect(m.ledgerEntries).toHaveLength(1);
    expect(m.bankLines[0].amountCents).toBe(m.ledgerEntries[0].amountCents);
    expect(m.bankLines[0].date).toBe(m.ledgerEntries[0].date);
  }
});
it("engine predictions do not consult truth labels", () => {
  const input = structuredClone(september);
  for (const line of [...input.bankLines, ...input.ledgerEntries])
    Object.assign(line, { truth: { reason: "UNMATCHED_LEDGER", group: "decoy" } });
  const a = reconcile(input),
    b = reconcile(september);
  expect(a.matches.map((x) => x.id)).toEqual(b.matches.map((x) => x.id));
  expect(a.packets.map((x) => [x.id, x.reason])).toEqual(
    b.packets.map((x) => [x.id, x.reason]),
  );
});
