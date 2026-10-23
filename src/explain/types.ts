import type { Reason } from "../engine/types.js";
export interface ExplanationFacts {
  reason: Reason;
  bankCents: number;
  ledgerCents: number;
  differenceCents: number;
  candidateCount: number;
}
export interface Explainer {
  explain(facts: ExplanationFacts): string;
}
