import { it, expect } from "vitest";
import { reconcile } from "../src/engine/reconcile.js";
import { bank as b, ledger as l, input } from "./helpers.js";
it.each([
  ["AMOUNT_DIFFERENCE", 485000, 490000, "Invoice"],
  ["TRANSPOSITION", -182900, -189200, "Check"],
])("detects %s and balances the draft", (reason, ba, la, reference) => {
  const r = reconcile(
    input(
      [b("b", Number(ba), { reference: String(reference) })],
      [l("l", Number(la), { reference: String(reference) })],
    ),
  );
  expect(r.packets[0].reason).toBe(reason);
  expect(r.tieOut.unexplainedCents).toBe(0);
  const lines = r.packets[0].draftEntry!.lines;
  expect(lines.reduce((s, x) => s + x.debitCents - x.creditCents, 0)).toBe(0);
});
it("reserves duplicate ledger entries before exact matching", () => {
  const r = reconcile(
    input(
      [b("b", -100, { reference: "D", counterparty: "Vendor" })],
      [
        l("l1", -100, { reference: "D", counterparty: "Vendor" }),
        l("l2", -100, {
          reference: "D",
          counterparty: "Vendor",
          date: "2026-09-12",
        }),
      ],
    ),
  );
  expect(r.packets[0].reason).toBe("DUPLICATE_LEDGER");
  expect(r.tieOut.unexplainedCents).toBe(0);
});
it("different vendors are not duplicates", () => {
  const r = reconcile(
    input(
      [b("b", 100)],
      [
        l("l1", 100, { counterparty: "One" }),
        l("l2", 100, { counterparty: "Two" }),
      ],
    ),
  );
  expect(r.packets.some((p) => p.reason === "DUPLICATE_LEDGER")).toBe(false);
});
it.each(["SERVICE FEE", "WIRE FEE", "INTEREST", "RETURNED ITEM"])(
  "recognizes %s bank-only evidence",
  (description) =>
    expect(
      reconcile(input([b("b", -1500, { description })], [])).packets[0].reason,
    ).toBe("UNRECORDED_BANK_ITEM"),
);
it("routes unknown bank debits high priority with suspense draft", () => {
  const p = reconcile(
    input([b("b", -120000, { description: "WEBPMT 88213 RECURRING" })], []),
  ).packets[0];
  expect(p.reason).toBe("UNRECOGNIZED_BANK_ITEM");
  expect(p.severity).toBe("high");
  expect(p.draftEntry!.lines.some((x) => x.account === "Suspense")).toBe(true);
});
it.each([99999, 100000])("support threshold boundary %i", (amount) => {
  const r = reconcile(
    input([b("b", amount)], [l("l", amount, { documentIds: [] })]),
  );
  expect(r.packets.length).toBe(amount >= 100000 ? 1 : 0);
});
it.each([249999, 250000])("materiality boundary %i", (amount) => {
  const p = reconcile(input([b("b", -amount)], [])).packets[0];
  expect(p.materiality).toBe(amount >= 250000 ? "above" : "below");
  expect(p.requiredReviewers.some((x) => x.id === "daniel")).toBe(
    amount >= 250000,
  );
});
it.each([
  [-100, "OUTSTANDING_CHECK"],
  [100, "DEPOSIT_IN_TRANSIT"],
])("classifies period-end ledger %i", (amount, reason) => {
  const r = reconcile(
    input([], [l("l", Number(amount), { date: "2026-09-24" })]),
  );
  expect(r.packets[0].reason).toBe(reason);
  expect(r.packets[0].severity).toBe("info");
  expect(r.tieOut.unexplainedCents).toBe(0);
});
it("older ledger-only item remains unexplained without a plug", () => {
  const r = reconcile(input([], [l("l", 100)]));
  expect(r.packets[0].reason).toBe("UNMATCHED_LEDGER");
  expect(r.packets[0].draftEntry).toBeUndefined();
  expect(r.tieOut.unexplainedCents).toBe(-100);
});
