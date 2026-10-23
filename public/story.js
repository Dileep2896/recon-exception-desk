import { api as fetchApi } from "./lib/api.js";
export function animateNumber(
  element,
  target,
  format = String,
  reducedMotion = false,
) {
  if (reducedMotion) {
    element.textContent = format(target);
    return;
  }
  const start = performance.now(),
    duration = 1300;
  function step(now) {
    const t = Math.min(1, (now - start) / duration),
      eased = 1 - Math.pow(1 - t, 3);
    element.textContent = format(target * eased);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
export async function initStory({
  document: doc = document,
  api = fetchApi,
  reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")
    .matches ?? false,
} = {}) {
  const reveals = doc.querySelectorAll(".reveal");
  if (reducedMotion || !globalThis.IntersectionObserver)
    reveals.forEach((el) => el.classList.add("visible"));
  else {
    doc.documentElement.classList.add("motion-ready");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.12 },
    );
    reveals.forEach((el, i) => {
      el.style.setProperty("--stagger", `${(i % 3) * 75}ms`);
      observer.observe(el);
    });
  }
  try {
    const [e, r] = await Promise.all([api("eval"), api("recon")]);
    const metrics = {
      baselineUnexplained: e.baseline.unexplainedItems,
      engineUnexplained: e.engine.unexplainedItems,
      baselineInvestigate: e.baseline.investigateItems,
      engineInvestigate: e.engine.investigateItems,
      reviewQueue: e.engine.queueSize,
      infoPackets: r.packets.filter((p) => p.severity === "info").length,
      clearGroups: r.stats.autoCleared,
      packets: r.stats.packetCount,
      clearShare: (r.stats.clearedLines / r.stats.totalLines) * 100,
      difference: r.tieOut.unexplainedCents / 100,
      accuracy: e.engine.accuracy * 100,
    };
    const formats = {
      clearShare: (n) => `${n.toFixed(1)}%`,
      accuracy: (n) => `${Math.round(n)}%`,
      difference: (n) =>
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(n),
    };
    const update = (el) => {
      const key = el.dataset.metric;
      animateNumber(
        el,
        metrics[key],
        formats[key] || ((n) => String(Math.round(n))),
        reducedMotion,
      );
    };
    const elements = doc.querySelectorAll("[data-metric]");
    if (reducedMotion || !globalThis.IntersectionObserver)
      elements.forEach((el) => {
        const key = el.dataset.metric;
        el.textContent = (formats[key] || String)(metrics[key]);
      });
    else {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries)
            if (entry.isIntersecting) {
              update(entry.target);
              observer.unobserve(entry.target);
            }
        },
        { threshold: 0.2 },
      );
      elements.forEach((el) => observer.observe(el));
    }
    doc.querySelector("#story-status").textContent =
      `Measured on the fictional seed month · ${e.engine.total} labelled source lines · September 2026. Measured from the desk’s current fictional month.`;
  } catch {
    const status = doc.querySelector("#story-status");
    if (status)
      status.textContent =
        "Live metrics unavailable. Start the local server and reload to see the measured results.";
  }
}
if (typeof document !== "undefined" && document.querySelector(".story-main"))
  initStory();
