import type { Level } from "@/fixtures/codeChangeDemo";

// Every level is shown as a text label; color only reinforces it.
export const LEVELS: Record<Level, { label: string; hint: string; chip: string; stroke: string; fill: string }> = {
  breaks: {
    label: "Breaks",
    hint: "Will fail or crash",
    chip: "bg-rose-100 text-rose-900 ring-rose-300",
    stroke: "#e11d48",
    fill: "#fff1f2",
  },
  update: {
    label: "Needs update",
    hint: "Out of date after the change",
    chip: "bg-amber-100 text-amber-900 ring-amber-300",
    stroke: "#d97706",
    fill: "#fffbeb",
  },
  check: {
    label: "Check",
    hint: "Probably fine, worth a look",
    chip: "bg-sky-100 text-sky-900 ring-sky-300",
    stroke: "#0284c7",
    fill: "#f0f9ff",
  },
  safe: {
    label: "Still safe",
    hint: "Related, but unaffected",
    chip: "bg-emerald-100 text-emerald-900 ring-emerald-300",
    stroke: "#059669",
    fill: "#ecfdf5",
  },
};

export const LEVEL_ORDER: Level[] = ["breaks", "update", "check", "safe"];

// Finds the 1-based line numbers of each quoted snippet. A quote that is not in
// the file is reported as missing instead of being shown as evidence.
export function locateEvidence(code: string, quotes: string[]) {
  const lines = code.split("\n");
  const found = new Set<number>();
  const missing: string[] = [];
  for (const q of quotes) {
    const i = lines.findIndex((l) => l.includes(q.trim()));
    if (i === -1) missing.push(q);
    else found.add(i + 1);
  }
  return { lines, found, missing };
}
