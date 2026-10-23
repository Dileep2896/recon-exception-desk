import type { ReconInput, Packet, TieOut, TieItem } from "./types.js";
import { sumCents } from "./money.js";
import { total } from "./packets.js";
export function tieOut(input: ReconInput, packets: Packet[]): TieOut {
  const item = (p: Packet, amountCents: number): TieItem => ({
    packetId: p.id,
    label: p.reason,
    amountCents,
    evidenceRefs: p.evidenceRefs,
    ...(p.draftEntry ? { status: p.draftEntry.status } : {}),
  });
  const bookAdjustments = packets
    .filter((p) => p.draftEntry)
    .map((p) =>
      item(
        p,
        sumCents(
          p
            .draftEntry!.lines.filter((l) => l.account.startsWith("Cash"))
            .map((l) => l.debitCents - l.creditCents),
        ),
      ),
    );
  const depositsInTransit = packets
    .filter((p) => p.reason === "DEPOSIT_IN_TRANSIT")
    .map((p) => item(p, total(p.ledgerEntries)));
  const outstandingChecks = packets
    .filter((p) => p.reason === "OUTSTANDING_CHECK")
    .map((p) => item(p, -total(p.ledgerEntries)));
  const adjustedBookCents = sumCents([
    input.ledgerEndingCents,
    ...bookAdjustments.map((x) => x.amountCents),
  ]);
  const adjustedBankCents = sumCents([
    input.bankEndingCents,
    ...depositsInTransit.map((x) => x.amountCents),
    ...outstandingChecks.map((x) => -x.amountCents),
  ]);
  const pending = bookAdjustments.filter((x) => x.status !== "approved");
  const pendingAdjustmentsCents = sumCents(pending.map((x) => x.amountCents));
  const approvedAdjustedBookCents = sumCents([
    input.ledgerEndingCents,
    ...bookAdjustments.filter((x) => x.status === "approved").map((x) => x.amountCents),
  ]);
  const bankSourceGapCents =
      input.bankEndingCents - input.openingCents - total(input.bankLines),
    ledgerSourceGapCents =
      input.ledgerEndingCents - input.openingCents - total(input.ledgerEntries);
  return {
    sourceComplete: bankSourceGapCents === 0 && ledgerSourceGapCents === 0,
    bankSourceGapCents,
    ledgerSourceGapCents,
    ledgerEndingCents: input.ledgerEndingCents,
    bankEndingCents: input.bankEndingCents,
    bookAdjustments,
    depositsInTransit,
    outstandingChecks,
    adjustedBookCents,
    approvedAdjustedBookCents,
    pendingAdjustmentsCents,
    pendingCount: pending.length,
    adjustedBankCents,
    unexplainedCents: adjustedBankCents - adjustedBookCents,
    ledgerEvidenceRefs: input.ledgerEntries.map((x) => x.id),
    bankEvidenceRefs: input.bankLines.map((x) => x.id),
  };
}
