import type { ReconInput, ReconResult, AuditEvent } from "../engine/types.js";
import { FixtureSource } from "../sources/fixture.js";
import { reconcile } from "../engine/reconcile.js";
import { makePacket } from "../engine/packets.js";
import { tieOut } from "../engine/tieout.js";
export class StoreError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export class Store {
  input: ReconInput;
  result: ReconResult;
  audit: AuditEvent[] = [];
  constructor() {
    this.input = new FixtureSource().snapshot();
    this.result = reconcile(this.input);
  }
  reset() {
    this.input = new FixtureSource().snapshot();
    this.result = reconcile(this.input);
    this.audit = [];
    return this.result;
  }
  refreshStats() {
    this.result.tieOut = tieOut(this.input, this.result.packets);
    this.result.stats.autoCleared = this.result.matches.length;
    this.result.stats.clearedLines = this.result.matches.reduce(
      (s, x) => s + x.bankLines.length + x.ledgerEntries.length,
      0,
    );
    this.result.stats.packetCount = this.result.packets.length;
    this.result.stats.approved = this.result.packets.filter(
      (p) => p.status === "approved",
    ).length;
  }
  resolveActor(actor: string) {
    const reviewer = this.input.reviewers.find(
      (r) => r.id === actor || r.name === actor,
    );
    if (!reviewer)
      throw new StoreError("INVALID_ACTOR", "Choose an existing reviewer as the actor.");
    return reviewer;
  }
  decide(id: string, body: unknown) {
    if (!body || typeof body !== "object")
      throw new StoreError(
        "INVALID_DECISION",
        "Supply an action, actor and note.",
      );
    const p = this.result.packets.find((p) => p.id === id);
    if (!p) throw new StoreError("NOT_FOUND", "Packet not found.", 404);
    const { action, actor, note, reviewerId } = body as Record<string, unknown>;
    if (
      !["approve", "send_back", "reassign"].includes(String(action)) ||
      typeof actor !== "string" ||
      !actor.trim() ||
      actor.length > 100 ||
      typeof note !== "string" ||
      !note.trim() ||
      note.length > 2000
    )
      throw new StoreError(
        "INVALID_DECISION",
        "Use approve, send_back or reassign with an actor and a note (up to 2,000 characters).",
      );
    const actingReviewer = this.resolveActor(actor);
    if (action === "approve" && !p.requiredReviewers.some((r) => r.id === actingReviewer.id))
      throw new StoreError("INVALID_REVIEWER", "Only a required reviewer can approve this packet.");
    if (action === "reassign") {
      const reviewer = this.input.reviewers.find((r) => r.id === reviewerId);
      if (!reviewer)
        throw new StoreError(
          "INVALID_REVIEWER",
          "Choose an existing reviewer.",
        );
      p.reviewer = reviewer;
      p.requiredReviewers = [
        reviewer,
        ...p.requiredReviewers.filter(
          (r) => r.role === "Controller" && r.id !== reviewer.id,
        ),
      ];
    }
    if (action === "approve") {
      p.approvals = [...new Set([...p.approvals, actingReviewer.name])];
      p.status =
        !p.requiredReviewers.every((r) => p.approvals.includes(r.name))
          ? "open"
          : "approved";
    } else {
      p.approvals = [];
      p.status = action === "send_back" ? "sent_back" : "reassigned";
    }
    if (p.draftEntry)
      p.draftEntry.status = p.status === "approved" ? "approved" : "draft";
    this.audit.push({
      at: new Date().toISOString(),
      packetId: id,
      action: String(action),
      actor: actingReviewer.name,
      note: note.trim(),
    });
    this.refreshStats();
    return p;
  }
  reopen(id: string, actor: unknown, note: unknown) {
    if (
      typeof actor !== "string" ||
      !actor.trim() ||
      actor.length > 100 ||
      typeof note !== "string" ||
      !note.trim() ||
      note.length > 2000
    )
      throw new StoreError(
        "INVALID_DECISION",
        "Add an actor and a review note.",
      );
    const actingReviewer = this.resolveActor(actor);
    const m = this.result.matches.find((m) => m.id === id);
    if (!m) throw new StoreError("NOT_FOUND", "Match not found.", 404);
    const p = makePacket(
      this.input,
      "MANUAL_REVIEW",
      m.bankLines,
      m.ledgerEntries,
      [
        {
          bankIds: m.bankLines.map((x) => x.id),
          ledgerIds: m.ledgerEntries.map((x) => x.id),
          basis: m.basis,
          basisText: m.basisText,
          score: 1,
        },
      ],
      m.basisText,
    );
    this.result.matches = this.result.matches.filter((x) => x !== m);
    this.result.packets.push(p);
    this.audit.push({
      at: new Date().toISOString(),
      packetId: p.id,
      action: "reopen",
      actor: actingReviewer.name,
      note: note.trim(),
    });
    this.refreshStats();
    return p;
  }
}
export const store = new Store();
