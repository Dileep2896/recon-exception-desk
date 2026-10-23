export function filterQueue(packets, filters = {}) {
  const rank = { high: 0, review: 1, info: 2 };
  return packets
    .filter(
      (p) =>
        (!filters.reason ||
          filters.reason === "all" ||
          p.reason === filters.reason) &&
        (!filters.status ||
          filters.status === "all" ||
          p.status === filters.status) &&
        (!filters.search ||
          [
            p.reason,
            p.explanation,
            p.reviewer.name,
            ...(p.bankLines || []).map((x) => x.description),
            ...(p.ledgerEntries || []).map((x) => x.description),
          ]
            .join(" ")
            .toLowerCase()
            .includes(filters.search.toLowerCase())),
    )
    .sort(
      (a, b) => rank[a.severity] - rank[b.severity] || a.id.localeCompare(b.id),
    );
}
export function moveSelection(queue, id, delta) {
  if (!queue.length) return null;
  const index = Math.max(
    0,
    queue.findIndex((p) => p.id === id),
  );
  return queue[Math.max(0, Math.min(queue.length - 1, index + delta))].id;
}
