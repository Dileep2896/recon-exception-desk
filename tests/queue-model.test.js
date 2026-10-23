import { it, expect } from "vitest";
import { filterQueue, moveSelection } from "../public/lib/queue-model.js";
import { esc } from "../public/lib/ui.js";
const packets = [
  {
    id: "1",
    reason: "FEE_NOT_BOOKED",
    severity: "review",
    status: "open",
    explanation: "Payout fee",
    reviewer: { name: "Priya" },
  },
  {
    id: "2",
    reason: "MISSING_SUPPORT",
    severity: "high",
    status: "approved",
    explanation: "No document",
    reviewer: { name: "Mei" },
  },
];
it("filters reason, status and text without mutating source", () => {
  expect(
    filterQueue(packets, { reason: "FEE_NOT_BOOKED", status: "open" }).map(
      (p) => p.id,
    ),
  ).toEqual(["1"]);
  expect(filterQueue(packets, { search: "mei" }).map((p) => p.id)).toEqual([
    "2",
  ]);
  expect(packets[0].id).toBe("1");
});
it("sorts high priority before review and clamps navigation", () => {
  const q = filterQueue(packets, {});
  expect(q[0].id).toBe("2");
  expect(moveSelection(q, "2", 1)).toBe("1");
  expect(moveSelection(q, "2", -1)).toBe("2");
  expect(moveSelection([], null, 1)).toBe(null);
});
it("escapes every HTML-sensitive character", () =>
  expect(esc('<img onerror="x"> & \'')).toBe(
    "&lt;img onerror=&quot;x&quot;&gt; &amp; &#39;",
  ));
