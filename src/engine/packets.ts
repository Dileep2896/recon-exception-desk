import type {
  BankLine,
  LedgerEntry,
  ReconInput,
  Packet,
  Reason,
  Candidate,
  DraftEntry,
} from "./types.js";
import { sumCents } from "./money.js";
import { TemplateExplainer } from "../explain/template.js";
export const total = (lines: { amountCents: number }[]) =>
  sumCents(lines.map((x) => x.amountCents));
export const evidence = (banks: BankLine[], ledgers: LedgerEntry[]) => [
  ...new Set([
    ...banks.map((x) => x.id),
    ...ledgers.flatMap((x) => [x.id, ...x.documentIds]),
  ]),
];
export function adjustment(
  delta: number,
  account: string,
  memo: string,
): DraftEntry {
  return {
    memo,
    status: "draft",
    lines: [
      {
        account: "Cash · 0417",
        debitCents: Math.max(0, delta),
        creditCents: Math.max(0, -delta),
      },
      {
        account,
        debitCents: Math.max(0, -delta),
        creditCents: Math.max(0, delta),
      },
    ],
  };
}
export function makePacket(
  input: ReconInput,
  reason: Reason,
  banks: BankLine[],
  ledgers: LedgerEntry[],
  candidates: Candidate[] = [],
  basisText?: string,
): Packet {
  const bankCents = total(banks),
    ledgerCents = total(ledgers),
    differenceCents = bankCents - ledgerCents;
  const above =
    Math.max(
      Math.abs(bankCents),
      Math.abs(ledgerCents),
      Math.abs(differenceCents),
    ) >= input.rules.materialityCents;
  const ownerId =
    ledgers.some(
      (x) => x.amountCents < 0 && /payable|expense/i.test(x.account),
    ) || reason === "OUTSTANDING_CHECK"
      ? "mei"
      : "priya";
  const reviewer =
    input.reviewers.find((x) => x.id === ownerId) || input.reviewers[0];
  const controller = input.reviewers.find((x) => x.role === "Controller");
  const info =
    reason === "OUTSTANDING_CHECK" || reason === "DEPOSIT_IN_TRANSIT";
  let account: string | undefined;
  if (reason === "FEE_NOT_BOOKED") account = "Processor fees";
  if (
    ["AMOUNT_DIFFERENCE", "TRANSPOSITION", "DUPLICATE_LEDGER"].includes(reason)
  )
    account = ledgers[0]?.account || "Accounts receivable";
  if (reason === "UNRECOGNIZED_BANK_ITEM") account = "Suspense";
  if (reason === "UNRECORDED_BANK_ITEM")
    account = /INTEREST/i.test(banks[0].description)
      ? "Interest income"
      : /RETURNED ITEM/i.test(banks[0].description)
        ? "Accounts receivable"
        : "Bank fees";
  const explanation = new TemplateExplainer().explain({
    reason,
    bankCents,
    ledgerCents,
    differenceCents,
    candidateCount: candidates.length,
  });
  const reasonBasis: Partial<Record<Reason, string>> = {
    DUPLICATE_LEDGER:
      "One statement line supports two equal ledger postings with the same counterparty and reference/date within three days.",
    AMOUNT_DIFFERENCE:
      "Shared counterparty or reference; amounts differ within the configured tolerance.",
    TRANSPOSITION:
      "Related source records have the same amount digits in a different order.",
    UNRECORDED_BANK_ITEM:
      "Statement description identifies a fee, interest or returned item absent from the ledger.",
    UNRECOGNIZED_BANK_ITEM:
      "No related ledger candidate or recognized statement keyword.",
    OUTSTANDING_CHECK:
      "Ledger payment dated within the period-end timing window, absent from the statement.",
    DEPOSIT_IN_TRANSIT:
      "Ledger receipt dated within the period-end timing window, absent from the statement.",
    UNMATCHED_LEDGER:
      "No statement candidate; ledger date is outside the period-end timing window.",
  };
  return {
    approvals: [],
    id: `pkt-${banks[0]?.id || ledgers[0].id}`,
    reason,
    severity: info
      ? "info"
      : above || reason === "UNRECOGNIZED_BANK_ITEM"
        ? "high"
        : "review",
    bankLines: banks,
    ledgerEntries: ledgers,
    candidates,
    basisText:
      basisText || reasonBasis[reason] || "No evidence-backed match found.",
    differenceCents,
    explanation,
    materiality: above ? "above" : "below",
    reviewer,
    requiredReviewers:
      above && controller && reviewer.id !== controller.id
        ? [reviewer, controller]
        : [reviewer],
    draftEntry:
      account && differenceCents !== 0
        ? adjustment(differenceCents, account, explanation)
        : undefined,
    status: "open",
    evidenceRefs: evidence(banks, ledgers),
  };
}
