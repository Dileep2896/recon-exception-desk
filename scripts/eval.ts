import { september, septemberTruth } from "../src/fixtures/september.js";
import { reconcile } from "../src/engine/reconcile.js";
import { evaluate } from "../src/engine/eval.js";
const e = evaluate(reconcile(september), september, septemberTruth);
console.log(
  "Measured on the fictional September 2026 seed month; scoring every labelled source line.",
);
console.table(
  e.perReason.map((r) => ({
    Reason: r.reason,
    Items: r.engine.actual,
    "Engine precision": `${r.engine.precision * 100}%`,
    "Engine recall": `${r.engine.recall * 100}%`,
    "Baseline precision": `${Math.round(r.baseline.precision * 100)}%`,
    "Baseline recall": `${Math.round(r.baseline.recall * 100)}%`,
  })),
);
console.table({ Engine: e.engine, Baseline: e.baseline });
