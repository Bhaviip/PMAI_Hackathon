import type { Level } from "@/fixtures/codeChangeDemo";

// Every level is shown as a text label; color only reinforces it.
export const LEVELS: Record<Level, { label: string; hint: string; text: string; mark: string; tint: string; stroke: string }> = {
  breaks: { label: "Breaks", hint: "Will fail or crash", text: "text-brick", mark: "bg-brick", tint: "bg-brick-50", stroke: "#b4442c" },
  update: { label: "Needs update", hint: "Out of date after this change", text: "text-ochre", mark: "bg-ochre", tint: "bg-ochre-50", stroke: "#a86a12" },
  check: { label: "Check", hint: "Probably fine, worth a look", text: "text-steel", mark: "bg-steel", tint: "bg-steel-50", stroke: "#3b6a8f" },
  safe: { label: "Still safe", hint: "Related, but not affected", text: "text-moss", mark: "bg-moss", tint: "bg-moss-50", stroke: "#4d7a3a" },
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
