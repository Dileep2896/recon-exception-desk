import type {
  BankLine,
  LedgerEntry,
  Document,
  ReconInput,
  Truth,
  Reason,
} from "../engine/types.js";
import { total } from "../engine/packets.js";
const bankLines: BankLine[] = [],
  ledgerEntries: LedgerEntry[] = [],
  documents: Document[] = [];
const truth = (reason: Reason | "clean", group: string): Truth => ({
  reason,
  group,
});
// Evaluation labels stay separate from the source records served by the desk.
export const septemberTruth = new Map<string, Truth>();
function bank(
  id: string,
  amountCents: number,
  date: string,
  counterparty: string,
  t: Truth,
  extra: Partial<BankLine> = {},
) {
  septemberTruth.set(`B-${id}`, t);
  bankLines.push({
    id: `B-${id}`,
    amountCents,
    date,
    counterparty,
    description: counterparty,
    ...extra,
  });
}
function ledger(
  id: string,
  amountCents: number,
  date: string,
  counterparty: string,
  t: Truth,
  extra: Partial<LedgerEntry> = {},
  support = true,
) {
  septemberTruth.set(`L-${id}`, t);
  const docId = `DOC-${id}`;
  if (support)
    documents.push({
      id: docId,
      title: `${counterparty} · ${amountCents < 0 ? "payment advice" : "remittance"}`,
      type: amountCents < 0 ? "payment advice" : "remittance",
      amountCents,
      date,
    });
  ledgerEntries.push({
    id: `L-${id}`,
    amountCents,
    date,
    counterparty,
    description: counterparty,
    account: amountCents < 0 ? "Accounts payable" : "Accounts receivable",
    documentIds: support ? [docId] : [],
    ...extra,
  });
}
const names = [
  "Cedar Freight",
  "Alpine Textiles",
  "Bramble & Co.",
  "Northfork Rentals",
  "Payroll run",
  "Card payment",
];
for (let i = 1; i <= 90; i++) {
  const id = `C${String(i).padStart(3, "0")}`,
    date = `2026-09-${String(1 + (i % 22)).padStart(2, "0")}`,
    amount = (12000 + i * 1379) * (i % 3 === 0 ? -1 : 1),
    name = names[i % names.length],
    t = truth("clean", id);
  bank(id, amount, date, name, t, { reference: `REF-${id}` });
  ledger(id, amount, date, name, t, { reference: `REF-${id}` });
}
for (let i = 1; i <= 10; i++) {
  const id = `T${i}`,
    t = truth("clean", id),
    amount = 71001 + i * 1113;
  bank(id, amount, `2026-09-${10 + (i % 4) + 1}`, "Juniper Trail Co.", t);
  ledger(id, amount, "2026-09-10", "Juniper Trail Co.", t);
}
for (let i = 1; i <= 6; i++) {
  const id = `PAY-${i}`,
    booked = i <= 4,
    t = truth(booked ? "clean" : "FEE_NOT_BOOKED", id),
    fee = 1800 + i * 327;
  let gross = 0;
  for (let j = 1; j <= i + 2; j++) {
    const amount = 18500 + i * 3000 + j * 163;
    gross += amount;
    ledger(`${id}-${j}`, amount, "2026-09-17", `PayLane receipt ${j}`, t, {
      payoutId: id,
      kind: "receipt",
    });
  }
  bank(id, gross - fee, "2026-09-19", "PayLane", t, {
    payoutId: id,
    processorFeeCents: fee,
    description: `PayLane payout ${id}`,
  });
  if (booked)
    ledger(`${id}-FEE`, -fee, "2026-09-17", "PayLane", t, {
      payoutId: id,
      kind: "fee",
      account: "Processor fees",
    });
}
for (let i = 1; i <= 2; i++) {
  const id = `SPLIT-${i}`,
    t = truth("clean", id);
  ledger(id, -(81000 + i * 2000), "2026-09-12", "Cedar Freight", t, {
    reference: id,
  });
  bank(`${id}-A`, -40000, "2026-09-13", "Cedar Freight", t, { reference: id });
  bank(`${id}-B`, -(41000 + i * 2000), "2026-09-13", "Cedar Freight", t, {
    reference: id,
  });
}
for (let i = 1; i <= 2; i++) {
  const id = `AMB-${i}`,
    t = truth("AMBIGUOUS_MATCH", id);
  for (let j = 1; j <= 2; j++) {
    bank(
      `${id}-${j}`,
      225000 + i * 10000,
      "2026-09-21",
      `Unallocated deposit ${j}`,
      t,
    );
    ledger(
      `${id}-${j}`,
      225000 + i * 10000,
      "2026-09-21",
      j === 1 ? "Birch Outfitters" : "Aspen Goods",
      t,
    );
  }
}
const differences = [
  { id: "SHORT", b: 485000, l: 490000, name: "Bramble & Co." },
  { id: "FX", b: -204500, l: -200000, name: "Alpine Textiles" },
  { id: "DIGITS", b: -182900, l: -189200, name: "Northfork Rentals" },
];
for (const d of differences) {
  const t = truth(
    d.id === "DIGITS" ? "TRANSPOSITION" : "AMOUNT_DIFFERENCE",
    d.id,
  );
  bank(d.id, d.b, "2026-09-16", d.name, t, { reference: d.id });
  ledger(d.id, d.l, "2026-09-15", d.name, t, { reference: d.id });
}
for (let i = 1; i <= 2; i++) {
  const id = `DUP-${i}`,
    t = truth("DUPLICATE_LEDGER", id),
    amount = -(64000 + i * 2345);
  bank(id, amount, "2026-09-18", "Cedar Freight", t, { reference: id });
  ledger(`${id}-A`, amount, "2026-09-17", "Cedar Freight", t, {
    reference: id,
  });
  ledger(`${id}-B`, amount, "2026-09-18", "Cedar Freight", t, {
    reference: id,
  });
}
for (const [i, description, amount] of [
  [1, "SERVICE FEE · September", -3500],
  [2, "WIRE FEE · Outgoing", -2500],
  [3, "INTEREST · Earned", 1245],
  [4, "RETURNED ITEM · Customer check", -82500],
] as const)
  bank(
    `BANK-${i}`,
    amount,
    "2026-09-30",
    "Statement adjustment",
    truth("UNRECORDED_BANK_ITEM", `BANK-${i}`),
    { description },
  );
bank(
  "UNKNOWN",
  -128400,
  "2026-09-23",
  "Unknown payee",
  truth("UNRECOGNIZED_BANK_ITEM", "UNKNOWN"),
  { description: "WEBPMT 88213 RECURRING" },
);
for (let i = 1; i <= 2; i++) {
  const id = `DOC-${i}`,
    t = truth("MISSING_SUPPORT", id),
    amount = i === 1 ? -325000 : 156000;
  bank(id, amount, "2026-09-20", "Northfork Rentals", t, { reference: id });
  ledger(
    id,
    amount,
    "2026-09-20",
    "Northfork Rentals",
    t,
    { reference: id },
    false,
  );
}
for (let i = 1; i <= 3; i++)
  ledger(
    `OUT-${i}`,
    -(51000 + i * 9123),
    `2026-09-${24 + i}`,
    "Alpine Textiles",
    truth("OUTSTANDING_CHECK", `OUT-${i}`),
    { reference: `CHK-90${i}` },
  );
ledger(
  "TRANSIT",
  342600,
  "2026-09-30",
  "Bramble & Co.",
  truth("DEPOSIT_IN_TRANSIT", "TRANSIT"),
  { reference: "DEP-0930" },
);
const openingCents = 12500000;
export const september: ReconInput = {
  client: "Larkspur Outdoor Supply LLC",
  account: "0417",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-30",
  openingCents,
  bankEndingCents: openingCents + total(bankLines),
  ledgerEndingCents: openingCents + total(ledgerEntries),
  bankLines,
  ledgerEntries,
  documents,
  rules: {
    timingWindowDays: 5,
    supportThresholdCents: 100000,
    amountTolerancePct: 5,
    materialityCents: 250000,
    inTransitDays: 7,
  },
  reviewers: [
    { id: "priya", name: "Priya Raman", role: "Senior accountant · Cash & AR" },
    { id: "mei", name: "Mei Lin", role: "AP specialist" },
    { id: "daniel", name: "Daniel Ortiz", role: "Controller" },
  ],
};
