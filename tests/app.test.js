// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { route } from "../src/api/routes.js";
import { store } from "../src/state/store.js";
import { money } from "../public/lib/ui.js";
afterEach(() => vi.unstubAllGlobals());

it("shows pending approval beside the unexplained chip at the top of the desk", async () => {
  store.reset();
  document.body.innerHTML = readFileSync("public/index.html", "utf8").match(/<body>([\s\S]*)<\/body>/)[1];
  vi.stubGlobal("fetch", vi.fn(async (path) => ({ json: async () => route("GET", path).body })));
  await import("../public/app.js");
  await vi.waitFor(() => expect(document.querySelector(".summary-strip .pending-approval")).not.toBeNull());
  const pending = document.querySelector(".summary-strip .pending-approval");
  expect(pending.previousElementSibling.classList.contains("tie-chip")).toBe(true);
  expect(pending.textContent).toBe(`Pending approval: ${money(store.result.tieOut.pendingAdjustmentsCents)} across ${store.result.tieOut.pendingCount} drafts`);
  expect(pending.getAttribute("href")).toBe("#/tieout");
});
