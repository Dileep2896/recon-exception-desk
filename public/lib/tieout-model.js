export function tieoutRows(t) {
  return {
    book: [
      {
        label: "Ledger ending balance",
        amountCents: t.ledgerEndingCents,
        evidenceRefs: t.ledgerEvidenceRefs,
      },
      ...t.bookAdjustments,
    ],
    bank: [
      {
        label: "Bank statement ending",
        amountCents: t.bankEndingCents,
        evidenceRefs: t.bankEvidenceRefs,
      },
      ...t.depositsInTransit,
      ...t.outstandingChecks.map((x) => ({
        ...x,
        amountCents: -x.amountCents,
      })),
    ],
  };
}
