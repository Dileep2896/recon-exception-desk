export const reasons = [
  "AMBIGUOUS_MATCH",
  "AMOUNT_DIFFERENCE",
  "TRANSPOSITION",
  "DUPLICATE_LEDGER",
  "FEE_NOT_BOOKED",
  "UNRECORDED_BANK_ITEM",
  "UNRECOGNIZED_BANK_ITEM",
  "MISSING_SUPPORT",
  "OUTSTANDING_CHECK",
  "DEPOSIT_IN_TRANSIT",
  "UNMATCHED_LEDGER",
  "MANUAL_REVIEW",
] as const;
export type Reason = (typeof reasons)[number];
export type Basis =
  "exact_ref" | "exact_date" | "timing" | "payout_batch" | "split";
export type Truth = { reason: Reason | "clean"; group: string };
export type TruthMap = ReadonlyMap<string, Truth>;
export interface SourceLine {
  id: string;
  date: string;
  amountCents: number;
  description: string;
  counterparty: string;
  reference?: string;
  payoutId?: string;
}
export interface BankLine extends SourceLine {
  processorFeeCents?: number;
}
export interface LedgerEntry extends SourceLine {
  account: string;
  documentIds: string[];
  kind?: "receipt" | "fee" | "payment";
}
export interface Document {
  id: string;
  title: string;
  type: string;
  amountCents: number;
  date: string;
}
export interface Rules {
  timingWindowDays: number;
  supportThresholdCents: number;
  amountTolerancePct: number;
  materialityCents: number;
  inTransitDays: number;
}
export interface Reviewer {
  id: string;
  name: string;
  role: string;
}
export interface ReconInput {
  client: string;
  account: string;
  periodStart: string;
  periodEnd: string;
  openingCents: number;
  bankEndingCents: number;
  ledgerEndingCents: number;
  bankLines: BankLine[];
  ledgerEntries: LedgerEntry[];
  documents: Document[];
  rules: Rules;
  reviewers: Reviewer[];
}
export interface Candidate {
  bankIds: string[];
  ledgerIds: string[];
  basis: string;
  basisText: string;
  score: number;
}
export interface Match {
  id: string;
  basis: Basis;
  basisText: string;
  bankLines: BankLine[];
  ledgerEntries: LedgerEntry[];
  evidenceRefs: string[];
}
export interface DraftEntry {
  lines: { account: string; debitCents: number; creditCents: number }[];
  memo: string;
  status: "draft" | "approved";
}
export interface Packet {
  approvals: string[];
  id: string;
  reason: Reason;
  severity: "info" | "review" | "high";
  bankLines: BankLine[];
  ledgerEntries: LedgerEntry[];
  candidates: Candidate[];
  basisText: string;
  differenceCents: number;
  explanation: string;
  materiality: "below" | "above";
  reviewer: Reviewer;
  requiredReviewers: Reviewer[];
  draftEntry?: DraftEntry;
  status: "open" | "approved" | "sent_back" | "reassigned";
  evidenceRefs: string[];
}
export interface TieItem {
  packetId: string;
  label: string;
  amountCents: number;
  evidenceRefs: string[];
  status?: DraftEntry["status"];
}
export interface TieOut {
  sourceComplete: boolean;
  bankSourceGapCents: number;
  ledgerSourceGapCents: number;
  ledgerEndingCents: number;
  bankEndingCents: number;
  bookAdjustments: TieItem[];
  depositsInTransit: TieItem[];
  outstandingChecks: TieItem[];
  adjustedBookCents: number;
  approvedAdjustedBookCents: number;
  pendingAdjustmentsCents: number;
  pendingCount: number;
  adjustedBankCents: number;
  unexplainedCents: number;
  ledgerEvidenceRefs: string[];
  bankEvidenceRefs: string[];
}
export interface ReconResult {
  matches: Match[];
  packets: Packet[];
  tieOut: TieOut;
  stats: {
    autoCleared: number;
    clearedLines: number;
    totalLines: number;
    packetCount: number;
    approved: number;
  };
}
export interface AuditEvent {
  at: string;
  packetId: string;
  action: string;
  actor: string;
  note: string;
}
