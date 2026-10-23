import { expect, it } from "vitest";
import { readFileSync } from "node:fs";

it("documents verification, approval accounting, actor validation and JSON-only POSTs", () => {
  const readme = readFileSync("README.md", "utf8");
  expect(readme).toContain("Built with Codex, verified by Claude Code.");
  expect(readme).not.toContain("verification has not been performed");
  expect(readme).toContain("Approved adjusted book uses approved drafts only");
  expect(readme).toContain("count of unapproved drafts, including Suspense");
  expect(readme).toContain("registered reviewer by ID or exact name");
  expect(readme).toContain("only a packet’s required reviewers can approve it");
  expect(readme).toContain("POST requests require `Content-Type: application/json`");
});
