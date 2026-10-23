import type { ReconInput, BankLine, LedgerEntry } from "../engine/types.js";
export interface BankFeedSource {
  bankLines(): BankLine[];
}
export interface LedgerSource {
  ledgerEntries(): LedgerEntry[];
  snapshot(): ReconInput;
}
