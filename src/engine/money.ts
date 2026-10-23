export function sumCents(values: number[]): number {
  let sum = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value))
      throw new Error("Money must be safe integer cents");
    sum += value;
    if (!Number.isSafeInteger(sum))
      throw new Error("Money total exceeds safe integer cents");
  }
  return sum;
}
export const formatUsd = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
export function isTransposition(a: number, b: number): boolean {
  return (
    a !== b &&
    Math.sign(a) === Math.sign(b) &&
    (a - b) % 9 === 0 &&
    String(Math.abs(a)).split("").sort().join("") ===
      String(Math.abs(b)).split("").sort().join("")
  );
}
