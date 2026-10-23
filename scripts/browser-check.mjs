import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
const baseUrl = process.env.APP_URL || "http://127.0.0.1:4610";
const localChrome =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath =
  process.env.BROWSER_EXECUTABLE ||
  (existsSync(localChrome) ? localChrome : undefined);
const context = await chromium.launchPersistentContext(
  ".cache/browser/profile",
  {
    executablePath,
    headless: true,
    viewport: { width: 1440, height: 1000 },
    colorScheme: "light",
    reducedMotion: "reduce",
    args: ["--disable-crash-reporter"],
  },
);
try {
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.request.post(`${baseUrl}/api/reset`, { data: {} });
  await page.goto(`${baseUrl}`);
  await page.waitForSelector(".desk-grid");
  await page.locator('[data-packet="pkt-B-SHORT"]').click();
  await mkdir("docs", { recursive: true });
  await page.screenshot({ path: "docs/desk.png", fullPage: true });
  await page
    .locator("#decision-note")
    .fill("Reviewed source evidence and confirmed the proposed adjustment.");
  await page.locator('[data-action="approve"]').click();
  await page.waitForSelector(".approval-progress");
  assert.match(
    await page.locator(".approval-progress").innerText(),
    /Awaiting/,
  );
  await page.locator("#decision-actor").selectOption("Daniel Ortiz");
  await page
    .locator("#decision-note")
    .fill("Controller confirmed the short payment and adjusting entry.");
  await page.locator('[data-action="approve"]').click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".summary-stat")].some((el) =>
      el.textContent.includes("1approved"),
    ),
  );
  await page.locator('a[href="#/audit"]').click();
  await page.waitForSelector("table");
  assert.match(
    await page.locator("#view").innerText(),
    /Reviewed source evidence/,
  );
  await page.goto(`${baseUrl}/#/matches`);
  await page.locator("[data-reopen]").first().click();
  await page
    .locator("#reopen-note")
    .fill("Please inspect the allocation once more.");
  await page.locator("#reopen-form button").click();
  await page.waitForSelector('.badge:text("Manual review")');
  await page.request.post(`${baseUrl}/api/reset`, { data: {} });
  await page.goto(`${baseUrl}/#/tieout`);
  await page.reload();
  await page.waitForSelector(".proof-banner");
  await page.waitForFunction(
    () => !document.querySelector("#toast")?.classList.contains("visible"),
  );
  await page.screenshot({ path: "docs/tieout.png", fullPage: true });
  await page.goto(`${baseUrl}/#/eval`);
  assert.match(await page.locator("#view").innerText(), /100\.0%/);
  await page.goto(`${baseUrl}/story`);
  await page.waitForFunction(
    () =>
      document.querySelector('[data-metric="accuracy"]')?.textContent ===
      "100%",
  );
  await page.screenshot({ path: "docs/story.png" });
  await page
    .locator("#flow")
    .screenshot({ path: ".cache/browser/story-flow.png" });
  await page
    .locator("#impact")
    .screenshot({ path: ".cache/browser/story-impact.png" });
  for (const width of [320, 375, 414, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/#/desk",
      "/#/matches",
      "/#/tieout",
      "/#/eval",
      "/#/audit",
      "/story",
    ]) {
      await page.goto(`${baseUrl}` + path);
      await page.waitForSelector(
        path === "/story" ? ".story-main" : ".summary-strip",
      );
      const sizes = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        width: window.innerWidth,
      }));
      assert.ok(
        sizes.scroll <= sizes.width,
        `${path} overflows at ${width}: ${sizes.scroll}`,
      );
    }
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`${baseUrl}/#/desk`);
  await page.waitForSelector(".desk-grid");
  await page.screenshot({
    path: ".cache/browser/mobile-desk.png",
    fullPage: true,
  });
  await page.goto(`${baseUrl}/story`);
  await page.waitForSelector(".story-main");
  await page.screenshot({
    path: ".cache/browser/mobile-story.png",
    fullPage: true,
  });
  await page.emulateMedia({
    reducedMotion: "no-preference",
    colorScheme: "dark",
  });
  await page.goto(`${baseUrl}/story`);
  await page.locator("#impact").scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-metric="accuracy"]')?.textContent ===
      "100%",
  );
  assert.ok((await page.locator(".reveal.visible").count()) > 0);
  assert.equal(errors.length, 0, errors.join("\n"));
  await page.request.post(`${baseUrl}/api/reset`, { data: {} });
  console.log(
    "PASS: approval, audit, reopen, all routes, live story metrics, reduced and full motion, dark mode, six responsive widths; no browser errors.",
  );
} finally {
  await context.close();
}
