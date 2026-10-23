import { afterEach, expect, it, vi } from "vitest";
import { api } from "../public/lib/api.js";
afterEach(() => vi.unstubAllGlobals());

it("sends application/json for every SPA POST, including reset", async () => {
  const fetch = vi.fn(async () => ({ json: async () => ({ success: true, data: {} }) }));
  vi.stubGlobal("fetch", fetch);
  for (const path of ["reset", "packets/demo/decision", "matches/demo/reopen"]) {
    await api(path, {});
    expect(fetch).toHaveBeenLastCalledWith(`/api/${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    });
  }
});
