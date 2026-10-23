import { json, error, type Reply } from "../lib/http.js";
import { store, StoreError } from "../state/store.js";
import { evaluate } from "../engine/eval.js";
import { reconcile } from "../engine/reconcile.js";
import { workpaper } from "../engine/workpaper.js";
import { septemberTruth } from "../fixtures/september.js";
export function route(method: string, path: string, body?: unknown): Reply {
  try {
    store.refreshStats();
    if (method === "GET") {
      if (path === "/api/health")
        return json({ status: "ok", engine: "ready", source: "fixture" });
      if (path === "/api/recon")
        return json({
          ...store.result,
          openingCents: store.input.openingCents,
          client: store.input.client,
          account: store.input.account,
          periodStart: store.input.periodStart,
          periodEnd: store.input.periodEnd,
          reviewers: store.input.reviewers,
          documents: store.input.documents,
          rules: store.input.rules,
        });
      if (path === "/api/packets") return json(store.result.packets);
      if (path === "/api/tieout") return json(store.result.tieOut);
      if (path === "/api/eval")
        return json(evaluate(reconcile(store.input), store.input, septemberTruth));
      if (path === "/api/audit") return json(store.audit);
      if (path === "/api/export")
        return {
          status: 200,
          body: workpaper(store.input, store.result, store.audit),
          contentType: "text/markdown; charset=utf-8",
        };
      const packet = path.match(/^\/api\/packets\/([^/]+)$/);
      if (packet) {
        const p = store.result.packets.find((p) => p.id === packet[1]);
        return p ? json(p) : error("NOT_FOUND", "Packet not found.", 404);
      }
    }
    if (method === "POST") {
      if (path === "/api/reset") return json(store.reset());
      const decision = path.match(/^\/api\/packets\/([^/]+)\/decision$/);
      if (decision) return json(store.decide(decision[1], body));
      const reopen = path.match(/^\/api\/matches\/([^/]+)\/reopen$/);
      if (reopen) {
        const b = (body || {}) as Record<string, unknown>;
        return json(store.reopen(reopen[1], b.actor, b.note));
      }
    }
    return error("NOT_FOUND", "This API route does not exist.", 404);
  } catch (e) {
    return e instanceof StoreError
      ? error(e.code, e.message, e.status)
      : error("INTERNAL_ERROR", "The request could not be completed.", 500);
  }
}
