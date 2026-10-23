import type { Explainer, ExplanationFacts } from "./types.js";
import { formatUsd as usd } from "../engine/money.js";
export class TemplateExplainer implements Explainer {
  explain(f: ExplanationFacts): string {
    const b = usd(f.bankCents),
      l = usd(f.ledgerCents),
      d = usd(f.differenceCents);
    const templates = {
      MANUAL_REVIEW: `An accountant reopened bank ${b} and ledger ${l} for an additional evidence review; difference ${d}.`,
      AMBIGUOUS_MATCH: `${f.candidateCount} candidate pairings share the same basis; bank ${b} and ledger ${l} differ by ${d}. Confirm the allocation.`,
      AMOUNT_DIFFERENCE: `Bank ${b} differs from ledger ${l} by ${d}; review the short-pay, FX or charge before approving the draft.`,
      TRANSPOSITION: `Ledger ${l} and bank ${b} have permuted digits; the draft corrects cash by ${d}.`,
      DUPLICATE_LEDGER: `Bank ${b} supports one payment against ledger postings totaling ${l}; reverse the duplicate by ${d}.`,
      FEE_NOT_BOOKED: `Receipts of ${l} landed as ${b}; the ${usd(Math.abs(f.differenceCents))} processor fee has not been booked.`,
      UNRECORDED_BANK_ITEM: `The statement records ${b} with no ledger entry; draft the identified bank fee, interest or returned item.`,
      UNRECOGNIZED_BANK_ITEM: `Unidentified statement activity of ${b} has no ledger candidate; investigate before clearing the suspense draft.`,
      MISSING_SUPPORT: `Bank ${b} matches ledger ${l}, but a ledger amount at or above the support threshold has no attached document.`,
      OUTSTANDING_CHECK: `Ledger payment ${l} has not cleared by period end; subtract ${usd(Math.abs(f.ledgerCents))} from the bank balance.`,
      DEPOSIT_IN_TRANSIT: `Ledger receipt ${l} has not reached the statement; add ${l} to the bank balance.`,
      UNMATCHED_LEDGER: `Ledger ${l} has no statement candidate and is outside the in-transit window; ${d} remains unexplained.`,
    };
    return templates[f.reason];
  }
}
