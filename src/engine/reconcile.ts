import type { ReconInput, ReconResult, Rules } from "./types.js";
import { match } from "./match.js";
import { tieOut } from "./tieout.js";
import { sumCents } from "./money.js";
export const defaultRules: Rules = {
  timingWindowDays: 5,
  supportThresholdCents: 100000,
  amountTolerancePct: 5,
  materialityCents: 250000,
  inTransitDays: 7,
};
export function reconcile(
  raw: Omit<ReconInput, "rules"> & { rules?: Partial<Rules> },
): ReconResult {
  const input: ReconInput = {
    ...raw,
    rules: { ...defaultRules, ...raw.rules },
  };
  const lines = [...input.bankLines, ...input.ledgerEntries];
  sumCents([
    input.openingCents,
    input.bankEndingCents,
    input.ledgerEndingCents,
    ...lines.map((x) => x.amountCents),
  ]);
  if (new Set(lines.map((x) => x.id)).size !== lines.length)
    throw new Error("Source ids must be unique");
  if (
    lines.some(
      (x) =>
        !/^\d{4}-\d{2}-\d{2}$/.test(x.date) ||
        !Number.isFinite(Date.parse(x.date)) ||
        x.date < input.periodStart ||
        x.date > input.periodEnd,
    )
  )
    throw new Error("Source dates must be ISO dates in the period");
  const { matches, packets } = match(input);
  return {
    matches,
    packets,
    tieOut: tieOut(input, packets),
    stats: {
      autoCleared: matches.length,
      clearedLines: matches.reduce(
        (s, m) => s + m.bankLines.length + m.ledgerEntries.length,
        0,
      ),
      totalLines: lines.length,
      packetCount: packets.length,
      approved: 0,
    },
  };
}
