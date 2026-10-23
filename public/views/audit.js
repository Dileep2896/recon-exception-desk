import { esc, label, badge, empty } from "../lib/ui.js";
export function renderAudit({ audit }) {
  return `<section class="panel"><div class="section-header"><div><h2>A review trail you can follow</h2><p>Every decision preserves the actor, timestamp and review note. Nothing is posted.</p></div>${badge(`${audit.length} events`)}</div>${
    audit.length
      ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Packet</th><th>Action</th><th>Reviewer / note</th></tr></thead><tbody>${[
          ...audit,
        ]
          .reverse()
          .map(
            (a) =>
              `<tr><td class="mono">${esc(new Date(a.at).toLocaleString())}</td><td><a class="mono" href="#/desk/${esc(a.packetId)}">${esc(a.packetId)}</a></td><td>${badge(label(a.action), a.action === "approve" ? "success" : "neutral")}</td><td><strong>${esc(a.actor)}</strong><small>${esc(a.note)}</small></td></tr>`,
          )
          .join("")}</tbody></table></div>`
      : empty("No decisions yet", "Review a packet to start the audit trail.")
  }</section>`;
}
