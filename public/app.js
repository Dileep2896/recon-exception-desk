import { api } from "./lib/api.js";
import { esc, money, icon, initials, label } from "./lib/ui.js";
import { currentRoute, onRoute } from "./lib/router.js";
import { filterQueue, moveSelection } from "./lib/queue-model.js";
import { renderDesk, sourceLine } from "./views/desk.js";
import { renderMatches } from "./views/matches.js";
import { renderTieout } from "./views/tieout.js";
import { renderEval } from "./views/eval.js";
import { renderAudit } from "./views/audit.js";
const store = {
  recon: null,
  evaluation: null,
  audit: [],
  filters: { status: "all", reason: "all", search: "" },
  selected: null,
  actor: "Priya Raman",
  busy: false,
};
const views = {
  desk: renderDesk,
  matches: renderMatches,
  tieout: renderTieout,
  eval: renderEval,
  audit: renderAudit,
};
const titles = {
  desk: ["Exception desk", "Clean matches move. Exceptions stop here."],
  matches: [
    "Cleared matches",
    "Evidence, a matching basis, and a traceable conclusion.",
  ],
  tieout: ["Tie-out proof", "From source balances to the last cent."],
  eval: [
    "Engine evaluation",
    "A reproducible benchmark against a naive matcher.",
  ],
  audit: ["Audit trail", "The evidence behind every human decision."],
};
function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("visible");
  setTimeout(() => el.classList.remove("visible"), 3500);
}
async function refresh() {
  const [recon, evaluation, audit] = await Promise.all([
    api("recon"),
    api("eval"),
    api("audit"),
  ]);
  Object.assign(store, { recon, evaluation, audit });
  render();
}
function render() {
  const route = currentRoute(),
    r = store.recon;
  if (!r) return;
  const t = r.tieOut;
  const q = filterQueue(r.packets, store.filters);
  if (!q.some((p) => p.id === store.selected)) store.selected = q[0]?.id;
  const [title, subtitle] = titles[route.view];
  document.title = `${title} — Recon`;
  document.querySelector("#app").innerHTML =
    `<aside class="sidebar"><a class="brand" href="#/desk"><span class="brand-mark">⇄</span><span>recon<span class="brand-sub">EXCEPTION DESK</span></span></a><a class="mobile-story" href="/story">The story ${icon("arrow")}</a><div class="workspace-label">WORKSPACE</div><div class="workspace"><span class="client-icon">${esc((r.client || "C").charAt(0))}</span><span>${esc(String(r.client || "").replace(/ (Supply )?LLC$/, ""))}<small>September close</small></span></div><div class="nav-label">RECONCILIATION</div><nav aria-label="Main navigation">${[
      [
        "desk",
        "grid",
        "Exception desk",
        r.packets.filter((x) => x.status !== "approved").length,
      ],
      ["matches", "check", "Cleared matches", r.stats.autoCleared],
      ["tieout", "layers", "Tie-out proof", ""],
      ["eval", "chart", "Evaluation", ""],
      ["audit", "clock", "Audit trail", store.audit.length || ""],
    ]
      .map(
        ([key, i, text, count]) =>
          `<a href="#/${key}" ${route.view === key ? 'aria-current="page"' : ""} class="nav-link ${route.view === key ? "active" : ""}">${icon(i)}<span>${text}</span><span class="nav-count">${count}</span></a>`,
      )
      .join(
        "",
      )}</nav><div class="sidebar-bottom"><a href="/story" class="story-link">${icon("play")} The story behind the desk ${icon("arrow")}</a><div class="fixture-tag"><span class="dot success"></span> Fictional seed month</div><button class="text-button reset" id="reset">Reset demo</button><div class="profile"><span class="avatar">${initials(store.actor)}</span><div><label for="actor">Reviewing as</label><select id="actor">${r.reviewers.map((x) => `<option ${x.name === store.actor ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div></div></div></aside><div class="app-main"><header class="topbar"><div class="breadcrumb">Workspace ${icon("chevron")} <span>${esc(r.client || "")}</span></div><div class="topbar-right"><span class="account-label">Operating ··0417</span><span class="period">Sep 1 – 30, 2026</span></div></header><main id="main"><div class="page-heading"><div><div class="eyebrow">SEPTEMBER 2026 · MONTH-END CLOSE</div><h1>${title}</h1><p>${subtitle}</p></div><a href="/api/export" class="button export" download>${icon("download")} Export workpaper</a></div><div class="summary-strip"><a class="tie-chip ${t.unexplainedCents || !t.sourceComplete ? "error" : "success"}" href="#/tieout">${icon("check")}<span>Unexplained<strong class="mono">${money(t.unexplainedCents)}</strong></span>${icon("arrow")}</a><a class="pending-approval" href="#/tieout">Pending approval: ${money(t.pendingAdjustmentsCents)} across ${t.pendingCount} drafts</a><div class="summary-stat"><span class="stat-dot success"></span><strong>${r.stats.autoCleared}</strong><span>auto-cleared</span></div><div class="summary-stat"><span class="stat-dot review"></span><strong>${r.stats.packetCount}</strong><span>review packets</span></div><div class="summary-stat"><span class="stat-dot neutral"></span><strong>${r.stats.approved}</strong><span>approved</span></div><span class="source-state">${icon("shield")} ${t.sourceComplete ? "Sources verified" : "Evidence missing"}</span></div><div id="view">${views[route.view](store)}</div><footer class="app-footer"><span>Evidence first. Judgment where it matters.</span><span>Drafts only · Nothing posts automatically</span></footer></main></div>`;
  bind();
}
function openDialog(html) {
  document.querySelector("#dialog-content").innerHTML = html;
  document.querySelector("#detail-dialog").showModal();
}
function evidenceDialog(id) {
  const r = store.recon,
    doc = r.documents.find((d) => d.id === id),
    line = [...r.packets, ...r.matches]
      .flatMap((x) => [...x.bankLines, ...x.ledgerEntries])
      .find((x) => x.id === id);
  if (doc)
    openDialog(
      `<div class="eyebrow">FICTIONAL SUPPORTING DOCUMENT</div><h2>${esc(doc.title)}</h2><p class="mono">${esc(doc.id)} · ${esc(doc.date)}</p><p class="document-amount mono">${money(doc.amountCents)}</p><p>${esc(label(doc.type))} recorded in the fixture document register. This is seeded evidence metadata, not an extracted PDF.</p>`,
    );
  else if (line)
    openDialog(
      `<h2>Source record</h2>${sourceLine(line, "documentIds" in line)}<p class="muted">Fictional source data · September 2026</p>`,
    );
}
async function decide(action) {
  const form = document.querySelector("#decision-form");
  if (!form || store.busy) return;
  const note = form.querySelector("textarea");
  if (!note.reportValidity()) {
    note.focus();
    return;
  }
  store.busy = true;
  form.querySelectorAll("button").forEach((b) => (b.disabled = true));
  try {
    const decision = await api(`packets/${form.dataset.packetId}/decision`, {
      action,
      actor: store.actor,
      note: note.value,
      reviewerId: document.querySelector("#reviewer").value,
    });
    await refresh();
    toast(
      action === "approve"
        ? decision.status === "approved"
          ? "Packet approved. Draft entry remains unposted."
          : "Approval recorded. Required co-review is still pending."
        : action === "send_back"
          ? "Packet sent back with your note."
          : "Packet reassigned.",
    );
  } catch (e) {
    document.querySelector("#decision-error").textContent = e.message;
    form.querySelectorAll("button").forEach((b) => (b.disabled = false));
  } finally {
    store.busy = false;
  }
}
function bind() {
  document.querySelectorAll("[data-packet]").forEach(
    (el) =>
      (el.onclick = () => {
        store.selected = el.dataset.packet;
        render();
      }),
  );
  document.querySelectorAll("[data-status]").forEach(
    (el) =>
      (el.onclick = () => {
        store.filters.status = el.dataset.status;
        render();
      }),
  );
  const search = document.querySelector("#search");
  if (search)
    search.oninput = () => {
      const start = search.selectionStart;
      store.filters.search = search.value;
      render();
      const next = document.querySelector("#search");
      next.focus();
      try {
        next.setSelectionRange(start, start);
      } catch {}
    };
  const reason = document.querySelector("#reason-filter");
  if (reason)
    reason.onchange = () => {
      store.filters.reason = reason.value;
      render();
    };
  document.querySelector("#actor").onchange = (e) => {
    store.actor = e.target.value;
    render();
  };
  const form = document.querySelector("#decision-form");
  if (form) {
    document.querySelector("#decision-actor").onchange = (e) => {
      store.actor = e.target.value;
      document.querySelector("#actor").value = store.actor;
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      decide("approve");
    };
    form
      .querySelectorAll('[data-action]:not([type="submit"])')
      .forEach((el) => (el.onclick = () => decide(el.dataset.action)));
    document.querySelector("#show-reassign").onclick = () => {
      document.querySelector("#reassign-fields").hidden = false;
      document.querySelector("#reviewer").focus();
    };
  }
  document
    .querySelectorAll("[data-evidence]")
    .forEach((el) => (el.onclick = () => evidenceDialog(el.dataset.evidence)));
  document.querySelectorAll("[data-match-evidence]").forEach(
    (el) =>
      (el.onclick = () => {
        const m = store.recon.matches.find(
          (x) => x.id === el.dataset.matchEvidence,
        );
        openDialog(
          `<h2>${esc(m.basis.replaceAll("_", " "))}</h2><p>${esc(m.basisText)}</p><div class="source-columns"><div><h3>Bank statement</h3>${m.bankLines.map((x) => sourceLine(x)).join("")}</div><div><h3>General ledger</h3>${m.ledgerEntries.map((x) => sourceLine(x, true)).join("")}</div></div>`,
        );
      }),
  );
  document.querySelectorAll("[data-balance]").forEach(
    (el) =>
      (el.onclick = () => {
        const side = el.dataset.balance,
          items = [...store.recon.matches, ...store.recon.packets].flatMap(
            (x) => (side === "bank" ? x.bankLines : x.ledgerEntries),
          );
        openDialog(
          `<h2>${side === "bank" ? "Bank" : "Ledger"} balance evidence</h2><p>Opening balance ${money(store.recon.openingCents)} · Prior month reconciled</p>${items.map((x) => sourceLine(x, side === "ledger")).join("")}`,
        );
      }),
  );
  document.querySelectorAll("[data-reopen]").forEach(
    (el) =>
      (el.onclick = () => {
        openDialog(
          `<h2>Reopen cleared match</h2><p>Add the reason for requesting another review.</p><form id="reopen-form"><label for="reopen-note">Review note</label><textarea id="reopen-note" required maxlength="2000"></textarea><button class="button primary" type="submit">Reopen for review</button><p id="reopen-error" role="alert"></p></form>`,
        );
        document.querySelector("#reopen-form").onsubmit = async (e) => {
          e.preventDefault();
          try {
            const p = await api(`matches/${el.dataset.reopen}/reopen`, {
              actor: store.actor,
              note: document.querySelector("#reopen-note").value,
            });
            document.querySelector("#detail-dialog").close();
            store.filters = {};
            store.selected = p.id;
            await refresh();
            location.hash = `#/desk/${p.id}`;
            toast("Match reopened. Original evidence preserved.");
          } catch (err) {
            document.querySelector("#reopen-error").textContent = err.message;
          }
        };
      }),
  );
  document.querySelector("#reset").onclick = () => {
    openDialog(
      '<h2>Reset the fictional month?</h2><p>This clears this demo’s review decisions and audit log.</p><button class="button primary" id="confirm-reset">Reset demo</button>',
    );
    document.querySelector("#confirm-reset").onclick = async () => {
      try {
        await api("reset", {});
        document.querySelector("#detail-dialog").close();
        store.filters = {};
        store.selected = null;
        await refresh();
        toast("September fixture restored.");
      } catch (e) {
        toast(e.message);
      }
    };
  };
}
document.querySelector(".dialog-close").onclick = () =>
  document.querySelector("#detail-dialog").close();
document.querySelector("#dialog-content").addEventListener("click", (e) => {
  const el = e.target.closest("[data-evidence]");
  if (el) evidenceDialog(el.dataset.evidence);
});
document.addEventListener("keydown", (e) => {
  if (
    /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    document.querySelector("dialog[open]") ||
    currentRoute().view !== "desk"
  )
    return;
  if (e.key === "j" || e.key === "k") {
    e.preventDefault();
    store.selected = moveSelection(
      filterQueue(store.recon.packets, store.filters),
      store.selected,
      e.key === "j" ? 1 : -1,
    );
    render();
    document
      .querySelector(".queue-row.selected")
      ?.scrollIntoView({ block: "nearest" });
  }
  if (e.key === "a" || e.key === "s") {
    e.preventDefault();
    decide(e.key === "a" ? "approve" : "send_back");
  }
});
onRoute(() => {
  const { id } = currentRoute();
  if (id) {
    store.filters = {};
    store.selected = id;
  }
  render();
});
const initial = currentRoute();
if (initial.id) store.selected = initial.id;
refresh().catch((e) => {
  document.querySelector("#app").innerHTML =
    `<div class="loading-screen"><h1>Couldn’t load the desk</h1><p>${esc(e.message)}</p><button class="button" onclick="location.reload()">Try again</button></div>`;
});
