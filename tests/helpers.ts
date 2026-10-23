import type { BankLine, LedgerEntry, ReconInput } from "../src/engine/types.js";
export const bank = (
  id: string,
  amountCents: number,
  extra: Partial<BankLine> = {},
): BankLine => ({
  id,
  amountCents,
  date: "2026-09-10",
  description: "Receipt",
  counterparty: id,
  ...extra,
});
export const ledger = (
  id: string,
  amountCents: number,
  extra: Partial<LedgerEntry> = {},
): LedgerEntry => ({
  id,
  amountCents,
  date: "2026-09-10",
  description: "Receipt",
  counterparty: id,
  account: "Accounts receivable",
  documentIds: ["doc"],
  ...extra,
});
export const input = (
  bankLines: BankLine[],
  ledgerEntries: LedgerEntry[],
  extra: Partial<ReconInput> = {},
): ReconInput => ({
  client: "Fixture client",
  account: "0417",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-30",
  openingCents: 1000000,
  bankEndingCents: 1000000 + bankLines.reduce((s, x) => s + x.amountCents, 0),
  ledgerEndingCents:
    1000000 + ledgerEntries.reduce((s, x) => s + x.amountCents, 0),
  bankLines,
  ledgerEntries,
  documents: [
    {
      id: "doc",
      title: "Invoice",
      type: "invoice",
      date: "2026-09-10",
      amountCents: 10000,
    },
  ],
  rules: {
    timingWindowDays: 5,
    supportThresholdCents: 100000,
    amountTolerancePct: 5,
    materialityCents: 250000,
    inTransitDays: 7,
  },
  reviewers: [
    { id: "priya", name: "Priya Raman", role: "Senior accountant" },
    { id: "mei", name: "Mei Lin", role: "AP specialist" },
    { id: "daniel", name: "Daniel Ortiz", role: "Controller" },
  ],
  ...extra,
});
