// @vitest-environment jsdom
import { it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { initStory, animateNumber } from "../public/story.js";
import { september, septemberTruth } from "../src/fixtures/september.js";
import { reconcile } from "../src/engine/reconcile.js";
import { evaluate } from "../src/engine/eval.js";
it("renders final measured values without animation under reduced motion", async () => {
  document.body.innerHTML = readFileSync("public/story.html", "utf8").match(
    /<body>([\s\S]*)<\/body>/,
  )[1];
  const r = reconcile(september);
  const e = evaluate(r, september, septemberTruth);
  const api = vi.fn(async (path) => (path === "eval" ? e : r));
  await initStory({ document, api, reducedMotion: true });
  expect(api).toHaveBeenCalledWith("eval");
  expect(api).toHaveBeenCalledWith("recon");
  expect(document.querySelector('[data-metric="accuracy"]').textContent).toBe(
    "100%",
  );
  expect(document.querySelector('[data-metric="difference"]').textContent).toBe(
    "$0.00",
  );
  expect(document.querySelectorAll(".reveal.visible").length).toBeGreaterThan(
    0,
  );
  expect(document.querySelector('svg[aria-label*="Before"]')).not.toBeNull();
});
it("sets counter final state immediately when motion is reduced", () => {
  const el = document.createElement("span");
  animateNumber(el, 82.3, (n) => `${n.toFixed(1)}%`, true);
  expect(el.textContent).toBe("82.3%");
});
it("shows an honest error instead of invented metrics", async () => {
  document.body.innerHTML = '<p id="story-status"></p>';
  await initStory({
    document,
    api: async () => {
      throw new Error("Offline");
    },
    reducedMotion: true,
  });
  expect(document.querySelector("#story-status").textContent).toContain(
    "unavailable",
  );
});
