import { describe, it, expect } from "vitest";
import { formatUsd, isTransposition, sumCents } from "../src/engine/money.js";
describe("integer cents", () => {
  it("formats cents without changing precision", () => {
    expect(formatUsd(189200)).toBe("$1,892.00");
    expect(formatUsd(-63)).toBe("-$0.63");
  });
  it("requires the same digits, not just a multiple of nine", () => {
    expect(isTransposition(189200, 182900)).toBe(true);
    expect(isTransposition(10000, 10900)).toBe(false);
    expect(isTransposition(100, 100)).toBe(false);
    expect(isTransposition(-189200, 182900)).toBe(false);
  });
  it("sums cents exactly and rejects fractional or unsafe values", () => {
    expect(sumCents([10, 20, -5])).toBe(25);
    expect(() => sumCents([0.1])).toThrow();
    expect(() => sumCents([Number.MAX_SAFE_INTEGER, 1])).toThrow();
  });
});
