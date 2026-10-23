export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const money = (cents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
export const label = (value) =>
  String(value)
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
export const initials = (name) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((x) => x[0])
    .join("");
export const badge = (text, kind = "neutral") =>
  `<span class="badge ${esc(kind)}">${esc(text)}</span>`;
export const sum = (lines) => lines.reduce((s, x) => s + x.amountCents, 0);
const paths = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  check: "m5 12 4 4L19 6",
  layers: "m3 7 9-4 9 4-9 4z M3 12l9 4 9-4 M3 17l9 4 9-4",
  chart: "M4 20V4 M4 20h17 M8 15v-4 M13 15V7 M18 15V3",
  clock: "M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  arrow: "M5 12h14 m-5-5 5 5-5 5",
  file: "M14 2H5v20h14V7z M14 2v6h5 M8 12h8 M8 16h6",
  download: "M12 3v12 m-4-4 4 4 4-4 M5 17v4h14v-4",
  search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  chevron: "m9 5 7 7-7 7",
  shield: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z m-4 9 3 3 5-6",
  bank: "m3 8 9-5 9 5 M3 9h18 M5 10v8 M10 10v8 M15 10v8 M20 10v8 M3 21h18",
  play: "m8 4 13 8-13 8z",
};
export const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.file}"/></svg>`;
export const empty = (title, text) =>
  `<div class="empty">${icon("check")}<h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
