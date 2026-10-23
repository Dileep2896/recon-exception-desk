import type { ReconInput, ReconResult, AuditEvent } from "./types.js";
import { formatUsd as usd, sumCents } from "./money.js";
const md = (s: unknown) =>
  String(s)
    .replace(/[|\n\r]/g, " ")
    .replace(/[<>]/g, "");
export function workpaper(
  input: ReconInput,
  r: ReconResult,
  audit: AuditEvent[],
): string {
  const t = r.tieOut;
  const out = [
    "# Bank reconciliation workpaper",
    "",
    `${input.client} · Account ${input.account} · ${input.periodStart} to ${input.periodEnd}`,
    "",
    "Fictional fixture data. Adjustments are proposed drafts, never posted. Approval records review only.",
    "",
    "## Tie-out (including all proposed drafts)",
    "",
    "| Component | Amount |",
    "| --- | ---: |",
    `| Ledger ending | ${usd(t.ledgerEndingCents)} |`,
    ...t.bookAdjustments.map(
      (x) => `| ${x.label} · ${x.packetId} · ${x.status === "approved" ? "approved" : "pending approval"} | ${usd(x.amountCents)} |`,
    ),
    `| Adjusted book | ${usd(t.adjustedBookCents)} |`,
    `| Pending approval (${t.pendingCount} drafts; net cash movement) | ${usd(t.pendingAdjustmentsCents)} |`,
    `| Approved adjustments | ${usd(t.approvedAdjustedBookCents - t.ledgerEndingCents)} |`,
    `| Approved adjusted book (approved drafts only) | ${usd(t.approvedAdjustedBookCents)} |`,
    `| Bank ending | ${usd(t.bankEndingCents)} |`,
    ...t.depositsInTransit.map(
      (x) => `| Deposit in transit · ${x.packetId} | ${usd(x.amountCents)} |`,
    ),
    ...t.outstandingChecks.map(
      (x) => `| Outstanding check · ${x.packetId} | ${usd(-x.amountCents)} |`,
    ),
    `| Adjusted bank | ${usd(t.adjustedBankCents)} |`,
    `| Unexplained | ${usd(t.unexplainedCents)} |`,
    "",
    "Unexplained means the difference not attributed to a packet. Attribution does not mean approval or posting.",
    "",
    `Source evidence complete: ${t.sourceComplete}. Bank evidence gap: ${usd(t.bankSourceGapCents)}; ledger evidence gap: ${usd(t.ledgerSourceGapCents)}.`,
    "",
    `Bank balance evidence: ${t.bankEvidenceRefs.join(", ")}`,
    `Ledger balance evidence: ${t.ledgerEvidenceRefs.join(", ")}`,
    "",
    "## Review packets",
  ];
  for (const p of r.packets) {
    out.push(
      "",
      `### ${p.id} · ${p.reason}`,
      "",
      md(p.explanation),
      "",
      `Status: ${p.status} · Severity: ${p.severity} · Materiality: ${p.materiality}`,
      `Reviewer: ${p.reviewer.name} · Required: ${p.requiredReviewers.map((r) => r.name).join(", ")}`,
      `Approvals recorded: ${p.approvals.length ? p.approvals.map(md).join(", ") : "none"}`,
      `Bank: ${usd(sumCents(p.bankLines.map((x) => x.amountCents)))} · Ledger: ${usd(sumCents(p.ledgerEntries.map((x) => x.amountCents)))} · Difference: ${usd(p.differenceCents)}`,
      `Basis: ${p.basisText}`,
      `Evidence: ${p.evidenceRefs.join(", ")}`,
    );
    for (const l of [...p.bankLines, ...p.ledgerEntries])
      out.push(
        `- ${md(l.id)} · ${l.date} · ${md(l.description)} · ${usd(l.amountCents)}`,
      );
    if (p.draftEntry)
      out.push(
        "",
        `Draft entry (${p.draftEntry.status}; never posted)`,
        "",
        "| Account | Debit | Credit |",
        "| --- | ---: | ---: |",
        ...p.draftEntry.lines.map(
          (l) =>
            `| ${md(l.account)} | ${usd(l.debitCents)} | ${usd(l.creditCents)} |`,
        ),
      );
  }
  out.push(
    "",
    "## Auto-cleared evidence",
    "",
    ...r.matches.map(
      (m) =>
        `- ${m.id} · ${m.basis}: ${m.basisText} Evidence: ${m.evidenceRefs.join(", ")}`,
    ),
    "",
    "## Audit log",
    "",
    "| At | Packet | Action | Actor | Note |",
    "| --- | --- | --- | --- | --- |",
    ...audit.map(
      (a) =>
        `| ${a.at} | ${a.packetId} | ${a.action} | ${md(a.actor)} | ${md(a.note)} |`,
    ),
  );
  return out.join("\n") + "\n";
}
