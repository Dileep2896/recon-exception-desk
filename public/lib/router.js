export function currentRoute() {
  const [view = "desk", id] = location.hash.replace(/^#\/?/, "").split("/");
  return {
    view: ["desk", "matches", "tieout", "eval", "audit"].includes(view)
      ? view
      : "desk",
    id,
  };
}
export function onRoute(callback) {
  window.addEventListener("hashchange", callback);
}
