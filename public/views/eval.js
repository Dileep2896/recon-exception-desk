import { esc, label, badge } from "../lib/ui.js";
export function renderEval({ evaluation: e }) {
  const pct = (n) => `${(n * 100).toFixed(1)}%`;
  return `<div class="eval-intro"><div><span class="eyebrow">Measured, not assumed</span><h2>The same month.<br>A higher bar for clearing.</h2><p>Every source line has a ground-truth label. The engine is scored before reviewer decisions; the baseline only compares exact amounts and dates.</p></div><div class="eval-score"><strong>${pct(e.engine.accuracy)}</strong><span>engine accuracy</span><small>${e.engine.correct} / ${e.engine.total} labelled source lines</small></div></div><section class="panel"><div class="section-header"><h2>Engine vs. baseline</h2>${badge("Fictional seed month")}</div><div class="table-wrap"><table><thead><tr><th>Measure</th><th>1:1 baseline</th><th>Exception desk</th></tr></thead><tbody>${[
    ["Overall accuracy", pct(e.baseline.accuracy), pct(e.engine.accuracy)],
    [
      "Unexplained source lines",
      e.baseline.unexplainedItems,
      e.engine.unexplainedItems,
    ],
    [
      "Source lines to investigate",
      e.baseline.investigateItems,
      e.engine.investigateItems,
    ],
    [
      "Review queue (packets / baseline rows)",
      e.baseline.queueSize,
      e.engine.queueSize,
    ],
  ]
    .map(
      (r) =>
        `<tr><td>${r[0]}</td><td class="mono muted">${r[1]}</td><td class="mono success-text">${r[2]}</td></tr>`,
    )
    .join(
      "",
    )}</tbody></table></div></section><section class="panel"><div class="section-header"><h2>Classification by reason</h2><p>Precision / recall · source lines</p></div><div class="table-wrap"><table><thead><tr><th>Reason</th><th>Items</th><th>Baseline P / R</th><th>Engine P / R</th></tr></thead><tbody>${e.perReason.map((r) => `<tr><td>${esc(label(r.reason))}</td><td class="mono">${r.engine.actual}</td><td class="mono muted">${pct(r.baseline.precision)} / ${pct(r.baseline.recall)}</td><td class="mono success-text">${pct(r.engine.precision)} / ${pct(r.engine.recall)}</td></tr>`).join("")}</tbody></table></div><p class="table-note">Measured on the fictional seed month. Baseline false clears are counted as incorrect. Four period-end reconciling packets are informational and excluded from the judgment queue.</p></section>`;
}
