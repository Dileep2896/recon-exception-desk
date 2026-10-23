import type { ReconInput, Match } from "./types.js";
import { evidence } from "./packets.js";
export function baseline(input: ReconInput) {
  const used = new Set<string>(),
    matches: Match[] = [];
  for (const b of input.bankLines) {
    const l = input.ledgerEntries.find(
      (l) =>
        !used.has(l.id) && l.amountCents === b.amountCents && l.date === b.date,
    );
    if (l) {
      used.add(l.id);
      matches.push({
        id: `baseline-${b.id}`,
        basis: "exact_date",
        basisText: "Naive 1:1 amount and date only; no evidence gate.",
        bankLines: [b],
        ledgerEntries: [l],
        evidenceRefs: evidence([b], [l]),
      });
    }
  }
  const cleared = new Set(
    matches.flatMap((m) =>
      [...m.bankLines, ...m.ledgerEntries].map((x) => x.id),
    ),
  );
  return {
    matches,
    unmatched: [...input.bankLines, ...input.ledgerEntries]
      .filter((x) => !cleared.has(x.id))
      .map((x) => x.id),
  };
}
