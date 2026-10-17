// Keyword scan that finds files connected to a code change. It is deterministic
// and explainable: every impact quotes the lines where a changed name appears.
// It reads names, not meaning, so its verdicts are a starting point for review.

import type { CodeChange, Edit, Impact, Level, ProjectFile, PullRequest } from "@/fixtures/codeChangeDemo";
import { diffLines } from "./diff";

const STOP = new Set(
  (
    "if else return const let var function class new this true false null undefined await async import export from " +
    "default type interface extends implements public private protected static void string number boolean any for while " +
    "do switch case break continue try catch finally throw typeof instanceof in of def self none and or not elif pass " +
    "lambda with yield print the and to of is it be as at by on an or are was use get set has can will all props react " +
    "div span key value data item items result error id name text test expect describe should"
  ).split(" "),
);

const MAX_EVIDENCE = 3;
const TEST_RE = /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[a-z]+$|_test\.[a-z]+$/i;
const DOC_RE = /\.(md|mdx|txt|rst|adoc)$/i;

export function kindOf(path: string): ProjectFile["kind"] {
  if (TEST_RE.test(path)) return "test";
  if (DOC_RE.test(path)) return "doc";
  return "code";
}

const words = (line: string) => line.match(/[A-Za-z_$][A-Za-z0-9_$]{2,}/g) ?? [];
// Quoted strings and JSX text such as <Button>Approve</Button>.
const literals = (line: string) =>
  [...line.matchAll(/["'`]([^"'`\n]{3,60})["'`]|>([^<>{}\n]{3,60})</g)]
    .map((m) => (m[1] ?? m[2]).trim())
    .filter((t) => /[A-Za-z]/.test(t));
const definitions = (line: string) =>
  [...line.matchAll(/\b(?:function|class|const|let|var|def|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type Signal = { token: string; strength: "removed" | "defined" | "literal" | "used" };

// What the change touched: names it removed, names whose definition changed,
// changed string values, and other names on the changed lines.
function signalsFor(edit: Edit): Signal[] {
  const diff = diffLines(edit.before, edit.after);
  const changed = diff.filter((d) => d.type !== "same");
  const afterText = edit.after;
  const out = new Map<string, Signal["strength"]>();
  const put = (token: string, strength: Signal["strength"]) => {
    if (STOP.has(token.toLowerCase())) return;
    const rank = { removed: 3, defined: 2, literal: 1, used: 0 };
    const prev = out.get(token);
    if (!prev || rank[strength] > rank[prev]) out.set(token, strength);
  };
  for (const d of changed) {
    for (const def of definitions(d.text)) put(def, "defined");
    for (const lit of literals(d.text)) {
      // An old value that no longer appears as a whole value is a removal: anything still using it is stale.
      const gone = d.type === "del" && !literals(afterText).includes(lit);
      put(lit, gone ? "removed" : "literal");
    }
    for (const w of words(d.text)) {
      const gone = d.type === "del" && !new RegExp(`\\b${escape(w)}\\b`).test(afterText);
      put(w, gone ? "removed" : "used");
    }
  }
  // The function or class that contains a changed line has changed behavior, so its callers matter.
  for (const name of enclosingDefinitions(diff)) put(name, "defined");
  return [...out].map(([token, strength]) => ({ token, strength }));
}

// Function, class or method that opens on this line, if any.
function functionName(line: string): string | null {
  const m =
    line.match(/\b(?:function|class|def)\s+([A-Za-z_$][\w$]*)/) ??
    line.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*(?::[^=]+)?=>/) ??
    line.match(/^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^{]+)?\{\s*$/);
  const name = m?.[1];
  return name && !STOP.has(name.toLowerCase()) && !["if", "for", "while", "switch", "catch"].includes(name) ? name : null;
}

const indent = (line: string) => line.length - line.trimStart().length;

// Walks the diff in "after" order and, for each changed line, finds the nearest
// earlier definition that is less indented than it.
function enclosingDefinitions(diff: ReturnType<typeof diffLines>): string[] {
  const names = new Set<string>();
  diff.forEach((d, i) => {
    if (d.type === "same" || !d.text.trim()) return;
    for (let j = i - 1; j >= 0; j--) {
      const prev = diff[j];
      if (prev.type === "del" || !prev.text.trim() || indent(prev.text) >= indent(d.text)) continue;
      const name = functionName(prev.text);
      if (name) {
        names.add(name);
        break;
      }
    }
  });
  return [...names];
}

function verdict(kind: ProjectFile["kind"], hits: Signal[]): { level: Level; why: string } | null {
  const by = (s: Signal["strength"]) => hits.filter((h) => h.strength === s).map((h) => h.token);
  const removed = by("removed");
  const defined = by("defined");
  const literal = by("literal");
  const used = by("used");
  const list = (t: string[]) => t.slice(0, 3).map((x) => `"${x}"`).join(", ");

  if (removed.length && kind !== "doc")
    return { level: "breaks", why: `Still uses ${list(removed)}, which this change removes or renames.` };
  if (removed.length) return { level: "update", why: `Still mentions ${list(removed)}, which this change removes or renames.` };
  if (kind === "test" && (defined.length || literal.length))
    return { level: "update", why: `Tests ${list([...defined, ...literal])}, which this change modifies. Expectations may be out of date.` };
  if (kind === "doc" && (removed.length || defined.length || literal.length))
    return { level: "update", why: `Describes ${list([...removed, ...defined, ...literal])}, which this change modifies.` };
  if (literal.length) return { level: "check", why: `Relies on the value ${list(literal)}, which this change edits.` };
  if (defined.length) return { level: "check", why: `Calls ${list(defined)}, whose code changed. Check it still behaves as expected.` };
  if (used.length >= 2) return { level: "check", why: `Shares ${list(used)} with the changed lines.` };
  return null;
}

export function analyze(input: {
  id: string;
  title: string;
  summary: string;
  pr: PullRequest;
  files: ProjectFile[];
  edits: Edit[];
}): CodeChange {
  const editedPaths = new Set(input.edits.map((e) => e.path));
  const others = input.files.filter((f) => !editedPaths.has(f.path));
  let signals = input.edits.flatMap(signalsFor);

  // Whole-token match; also works for values with spaces or symbols, like "Approve & send".
  const matcher = (token: string) => new RegExp(`(^|[^\\w$])${escape(token)}([^\\w$]|$)`, "m");

  // Names that appear in most files carry no information about this change.
  const spread = (token: string) => others.filter((f) => matcher(token).test(f.code)).length;
  const limit = Math.max(3, Math.ceil(others.length * 0.4));
  signals = signals.filter((s) => {
    const n = spread(s.token);
    return n > 0 && (s.strength !== "used" || n <= Math.max(2, Math.ceil(others.length * 0.15))) && n <= limit;
  });

  const rank = { removed: 3, defined: 2, literal: 1, used: 0 };
  signals.sort((a, b) => rank[b.strength] - rank[a.strength]);

  const impacts: Impact[] = [];
  for (const f of others) {
    const lines = f.code.split("\n");
    const hits: Signal[] = [];
    const evidence: string[] = [];
    for (const s of signals) {
      const re = matcher(s.token);
      // Prefer a line that uses the name over the line that imports it.
      const line =
        lines.find((l) => re.test(l) && !/^\s*(import|from|export \{|require|#include|using)\b/.test(l)) ??
        lines.find((l) => re.test(l));
      if (!line) continue;
      hits.push(s);
      if (evidence.length < MAX_EVIDENCE && !evidence.includes(line.trim())) evidence.push(line.trim());
    }
    const v = verdict(f.kind, hits);
    if (v && evidence.length) impacts.push({ path: f.path, level: v.level, why: v.why, evidence });
  }

  const order: Record<Level, number> = { breaks: 0, update: 1, check: 2, safe: 3 };
  impacts.sort((a, b) => order[a.level] - order[b.level]);
  const { files: _files, ...change } = input;
  void _files;
  return { ...change, impacts: impacts.slice(0, 12) };
}
