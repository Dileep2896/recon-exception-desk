import { reasons, type ReconInput, type ReconResult, type TruthMap } from "./types.js";
import { baseline } from "./baseline.js";
export function evaluate(result: ReconResult, input: ReconInput, labels: TruthMap) {
  const engineLabels = new Map<string, string>(),
    baseLabels = new Map<string, string>(),
    base = baseline(input);
  for (const m of result.matches)
    for (const l of [...m.bankLines, ...m.ledgerEntries])
      engineLabels.set(l.id, "clean");
  for (const p of result.packets)
    for (const l of [...p.bankLines, ...p.ledgerEntries])
      engineLabels.set(l.id, p.reason);
  for (const m of base.matches)
    for (const l of [...m.bankLines, ...m.ledgerEntries])
      baseLabels.set(l.id, "clean");
  const lines = [...input.bankLines, ...input.ledgerEntries].filter(
    (x) => labels.has(x.id),
  );
  const expected = (id: string) => labels.get(id)!.reason;
  function score(labels: Map<string, string>, queueSize: number) {
    const correct = lines.filter(
      (l) => labels.get(l.id) === expected(l.id),
    ).length;
    return {
      correct,
      total: lines.length,
      accuracy: lines.length ? correct / lines.length : 0,
      unexplainedItems: lines.filter(
        (l) => !labels.has(l.id) || labels.get(l.id) === "UNMATCHED_LEDGER",
      ).length,
      investigateItems: lines.filter((l) => labels.get(l.id) !== "clean")
        .length,
      queueSize,
    };
  }
  function reasonScore(reason: string, labels: Map<string, string>) {
    const tp = lines.filter(
      (l) => expected(l.id) === reason && labels.get(l.id) === reason,
    ).length;
    const predicted = lines.filter((l) => labels.get(l.id) === reason).length;
    const actual = lines.filter((l) => expected(l.id) === reason).length;
    return {
      precision: predicted ? tp / predicted : 0,
      recall: actual ? tp / actual : 0,
      actual,
      predicted,
    };
  }
  return {
    engine: score(
      engineLabels,
      result.packets.filter((p) => p.severity !== "info").length,
    ),
    baseline: score(baseLabels, base.unmatched.length),
    perReason: ["clean", ...reasons]
      .filter((reason) => lines.some((l) => expected(l.id) === reason))
      .map((reason) => ({
        reason,
        engine: reasonScore(reason, engineLabels),
        baseline: reasonScore(reason, baseLabels),
      })),
  };
}
