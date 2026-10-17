import type { Level } from "@/fixtures/codeChangeDemo";

// Every level is shown as a text label; color only reinforces it.
export const LEVELS: Record<
  Level,
  { label: string; hint: string; pill: string; dot: string; stroke: string; tint: string }
> = {
  breaks: {
    label: "Breaks",
    hint: "Will fail or crash",
    pill: "bg-rose-50 text-rose-700 ring-rose-200",
    dot: "bg-rose-500",
    stroke: "#f43f5e",
    tint: "#fff1f2",
  },
  update: {
    label: "Needs update",
    hint: "Out of date after this change",
    pill: "bg-amber-50 text-amber-800 ring-amber-200",
    dot: "bg-amber-500",
    stroke: "#f59e0b",
    tint: "#fffbeb",
  },
  check: {
    label: "Check",
    hint: "Probably fine, worth a look",
    pill: "bg-sky-50 text-sky-700 ring-sky-200",
    dot: "bg-sky-500",
    stroke: "#0ea5e9",
    tint: "#f0f9ff",
  },
  safe: {
    label: "Still safe",
    hint: "Related, but not affected",
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
    stroke: "#10b981",
    tint: "#ecfdf5",
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
