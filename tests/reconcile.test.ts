import { it, expect } from "vitest";
import { reconcile } from "../src/engine/reconcile.js";
import { bank, ledger, input } from "./helpers.js";
it("rejects duplicate source ids and fractional cents", () => {
  expect(() =>
    reconcile(input([bank("same", 100)], [ledger("same", 100)])),
  ).toThrow("unique");
  expect(() => reconcile(input([bank("b", 1.2)], []))).toThrow("integer");
});
it("rejects non-ISO and out-of-period dates", () => {
  for (const date of ["09/01/2026", "2026-08-31", "2026-10-01"])
    expect(() => reconcile(input([bank("b", 100, { date })], []))).toThrow(
      "dates",
    );
});
it("does not treat an older unsupported ledger line as an adjustment", () => {
  const r = reconcile(
    input([], [ledger("l", 99999, { date: "2026-09-23", documentIds: [] })]),
  );
  expect(r.packets[0].reason).toBe("UNMATCHED_LEDGER");
  expect(r.tieOut.bookAdjustments).toHaveLength(0);
});
it("applies documented defaults when optional rule values are omitted", () => {
  const x = input([bank("b", 100, { date: "2026-09-15" })], [ledger("l", 100)]);
  x.rules = {} as typeof x.rules;
  expect(reconcile(x).matches[0].basis).toBe("timing");
});
