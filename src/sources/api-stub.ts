import type { LedgerSource, BankFeedSource } from "./types.js";
export class ApiSourceStub implements LedgerSource, BankFeedSource {
  // Connectors map signed cash movement into integer cents, ISO dates, stable ids,
  // references, payout ids, source documents and independently supplied balances.
  // Truth labels belong only to fixtures, never an ERP or statement connector.
  snapshot(): never {
    throw new Error(
      "NotConfigured: external sources are disabled; use FixtureSource.",
    );
  }
  bankLines(): never {
    return this.snapshot();
  }
  ledgerEntries(): never {
    return this.snapshot();
  }
}
