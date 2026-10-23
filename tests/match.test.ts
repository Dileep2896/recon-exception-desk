import { it, expect } from "vitest";
import { reconcile } from "../src/engine/reconcile.js";
import { bank as b, ledger as l, input } from "./helpers.js";
it("uses reference before date and allows any date in period", () => {
  const r = reconcile(
    input(
      [b("b", 100, { reference: "A", date: "2026-09-25" })],
      [l("l", 100, { reference: "A" })],
    ),
  );
  expect(r.matches[0].basis).toBe("exact_ref");
});
it("matches a unique exact date", () =>
  expect(reconcile(input([b("b", 100)], [l("l", 100)])).matches[0].basis).toBe(
    "exact_date",
  ));
it.each([1, 4, 5])("matches unique timing after %i days", (days) =>
  expect(
    reconcile(
      input([b("b", 100, { date: `2026-09-${10 + days}` })], [l("l", 100)]),
    ).matches[0].basis,
  ).toBe("timing"),
);
it.each(["2026-09-09", "2026-09-16"])(
  "does not clear outside timing: %s",
  (date) =>
    expect(
      reconcile(input([b("b", 100, { date })], [l("l", 100)])).matches,
    ).toHaveLength(0),
);
it.each([2, 3])(
  "never silently chooses among %i equally good candidates",
  (n) => {
    const r = reconcile(
      input(
        Array.from({ length: n }, (_, i) => b(`b${i}`, 100)),
        Array.from({ length: n }, (_, i) => l(`l${i}`, 100)),
      ),
    );
    expect(r.matches).toHaveLength(0);
    expect(r.packets[0].reason).toBe("AMBIGUOUS_MATCH");
    expect(r.packets[0].candidates).toHaveLength(n * n);
  },
);
it("timing uniqueness is mutual", () => {
  const r = reconcile(
    input(
      [b("b", 100, { date: "2026-09-12" })],
      [l("x", 100), l("y", 100, { date: "2026-09-11" })],
    ),
  );
  expect(r.matches).toHaveLength(0);
  expect(r.packets[0].reason).toBe("AMBIGUOUS_MATCH");
});
it.each([2, 3])("matches a %i-way reference-backed split", (n) => {
  const r = reconcile(
    input(
      Array.from({ length: n }, (_, i) => b(`b${i}`, -100, { reference: "S" })),
      [l("l", -100 * n, { reference: "S" })],
    ),
  );
  expect(r.matches[0].basis).toBe("split");
});
it.each([true, false])("payout fee booked = %s", (booked) => {
  const r = reconcile(
    input(
      [b("b", 9700, { payoutId: "P", processorFeeCents: 300 })],
      [
        l("a", 4000, { payoutId: "P", kind: "receipt" }),
        l("z", 6000, { payoutId: "P", kind: "receipt" }),
        ...(booked ? [l("f", -300, { payoutId: "P", kind: "fee" })] : []),
      ],
    ),
  );
  expect(booked ? r.matches[0].basis : r.packets[0].reason).toBe(
    booked ? "payout_batch" : "FEE_NOT_BOOKED",
  );
  expect(r.tieOut.unexplainedCents).toBe(0);
});
it("does not count a dangling document id as attached evidence", () =>
  expect(
    reconcile(
      input([b("b", 100000)], [l("l", 100000, { documentIds: ["missing"] })]),
    ).packets[0].reason,
  ).toBe("MISSING_SUPPORT"));
it("is deterministic and does not mutate input", () => {
  const x = input([b("b", 100)], [l("l", 100)]);
  const copy = structuredClone(x);
  expect(reconcile(x)).toEqual(reconcile(x));
  expect(x).toEqual(copy);
});
it("keeps multiple near-amount candidates together for judgment", () => {
  const r = reconcile(
    input(
      [b("b", 9800, { reference: "NEAR" })],
      [
        l("a", 10000, { reference: "NEAR" }),
        l("z", 10100, { reference: "NEAR" }),
      ],
    ),
  );
  expect(r.matches).toHaveLength(0);
  expect(r.packets).toHaveLength(1);
  expect(r.packets[0].reason).toBe("AMBIGUOUS_MATCH");
  expect(r.packets[0].candidates).toHaveLength(2);
});
it("reconciles independently of source ordering", () => {
  const x = input(
    [b("a", 100, { reference: "A" }), b("b", 200, { reference: "B" })],
    [l("a", 100, { reference: "A" }), l("b", 200, { reference: "B" })],
  );
  x.ledgerEntries.forEach((l) => (l.id = "L-" + l.id));
  const r = reconcile(x);
  const reversed = reconcile({
    ...x,
    bankLines: [...x.bankLines].reverse(),
    ledgerEntries: [...x.ledgerEntries].reverse(),
  });
  expect(reversed.matches.map((m) => m.id).sort()).toEqual(
    r.matches.map((m) => m.id).sort(),
  );
});
