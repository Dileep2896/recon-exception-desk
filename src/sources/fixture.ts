import { september } from "../fixtures/september.js";
import type { LedgerSource, BankFeedSource } from "./types.js";
export class FixtureSource implements LedgerSource, BankFeedSource {
  snapshot() {
    return structuredClone(september);
  }
  bankLines() {
    return this.snapshot().bankLines;
  }
  ledgerEntries() {
    return this.snapshot().ledgerEntries;
  }
}
