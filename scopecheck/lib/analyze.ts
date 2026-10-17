// Keyword scan that finds files connected to a code change. It is deterministic
// and explainable: every impact quotes the lines where a changed name appears.
// It reads names, not meaning, so its verdicts are a starting point for review.
//
// How analyze() works, in four steps:
//   1. Signals: diff each edited file and collect the names and string values the
//      change touched, each tagged with how strongly it was touched (see Signal).
//   2. Filter: drop names that appear in too many files to mean anything.
//   3. Match: for every other file, find the lines that use a remaining signal.
//   4. Verdict: turn the strongest matches into a level (breaks, update, check)
//      and a one-line reason, keeping up to three matching lines as evidence.
//
// Called from components/NewAnalysis.tsx for uploaded folders and GitHub pull
// requests. The sample pull requests use hand-written analyses instead.

import type { CodeChange, Edit, Impact, Level, ProjectFile, PullRequest } from "@/fixtures/codeChangeDemo";
import { diffLines } from "./diff";

// Common keywords and generic words that would match almost every file.
const STOP = new Set(
  (
    "if else return const let var function class new this true false null undefined await async import export from " +
    "default type interface extends implements public private protected static void string number boolean any for while " +
    "do switch case break continue try catch finally throw typeof instanceof in of def self none and or not elif pass " +
    "lambda with yield print the and to of is it be as at by on an or are was use get set has can will all props react " +
    "div span key value data item items result error id name text test expect describe should"
  ).split(" "),
);

// Quoted lines kept per affected file.
const MAX_EVIDENCE = 3;
// How a path is classified: tests and docs get different verdict wording.
const TEST_RE = /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[a-z]+$|_test\.[a-z]+$/i;
const DOC_RE = /\.(md|mdx|txt|rst|adoc)$/i;

export function kindOf(path: string): ProjectFile["kind"] {
  if (TEST_RE.test(path)) return "test";
  if (DOC_RE.test(path)) return "doc";
  return "code";
}

// Token extractors used on each changed line.
// Identifiers of three or more characters.
const words = (line: string) => line.match(/[A-Za-z_$][A-Za-z0-9_$]{2,}/g) ?? [];
// Quoted strings and JSX text such as <Button>Approve</Button>.
const literals = (line: string) =>
  [...line.matchAll(/["'`]([^"'`\n]{3,60})["'`]|>([^<>{}\n]{3,60})</g)]
    .map((m) => (m[1] ?? m[2]).trim())
    .filter((t) => /[A-Za-z]/.test(t));
// Names being declared on the line, e.g. "canSend" in "function canSend(".
const definitions = (line: string) =>
  [...line.matchAll(/\b(?:function|class|const|let|var|def|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]);

const COMMENT_RE = /^\s*(\/\/|#|\*|\/\*|<!--|--\s)/;
// camelCase, snake_case, PascalCase with an inner capital, or containing a digit.
const codeLike = (w: string) => /[a-z][A-Z]|_|[A-Za-z]\d|^[A-Z][a-z]+[A-Z]/.test(w);

const DATA_RE = /\.(json|ya?ml|toml|txt|csv)$/i;

// Makes a token safe to embed in a regular expression.
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A name or value the change touched, and how strongly, from strongest to weakest:
//   removed  - deleted and no longer in the new code, so anything still using it is stale
//   defined  - its definition changed, or it encloses a changed line
//   literal  - a string value on a changed line, such as a button label
//   used     - any other code-like name on a changed line
type Signal = { token: string; strength: "removed" | "defined" | "literal" | "used" };

// What the change touched: names it removed, names whose definition changed,
// changed string values, and other names on the changed lines.
function signalsFor(edit: Edit): Signal[] {
  const diff = diffLines(edit.before, edit.after);
  const changed = diff.filter((d) => d.type !== "same");
  const afterText = edit.after;
  const out = new Map<string, Signal["strength"]>();
  const put = (token: string, strength: Signal["strength"]) => {
    if (token.length < 3 || STOP.has(token.toLowerCase())) return;
    const rank = { removed: 3, defined: 2, literal: 1, used: 0 };
    const prev = out.get(token);
    if (!prev || rank[strength] > rank[prev]) out.set(token, strength);
  };
  // Prose (docs, comments) only contributes names that look like code, e.g. canSend or approval_id.
  const prose = kindOf(edit.path) === "doc";
  for (const d of changed) {
    const comment = prose || COMMENT_RE.test(d.text);
    if (comment) {
      for (const w of words(d.text).filter(codeLike)) {
        const gone = d.type === "del" && !new RegExp(`\\b${escape(w)}\\b`).test(afterText);
        put(w, gone ? "removed" : "used");
      }
      continue;
    }
    for (const def of definitions(d.text)) put(def, "defined");
    for (const lit of literals(d.text)) {
      // An old value that no longer appears as a whole value is a removal: anything still using it is stale.
      const gone = d.type === "del" && !literals(afterText).includes(lit);
      put(lit, gone ? "removed" : "literal");
    }
    for (const w of words(d.text)) {
      const gone = d.type === "del" && !new RegExp(`\\b${escape(w)}\\b`).test(afterText);
      if (gone || codeLike(w)) put(w, gone ? "removed" : "used");
    }
  }
  if (prose) return [...out].map(([token, strength]) => ({ token, strength }));
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

// Picks one level and reason for a file from the signals found in it. Rules are
// checked in order, so the strongest signal decides. Returns null when the
// matches are too weak to report.
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

// Entry point. Takes the whole project plus the edits, and returns a CodeChange
// whose impacts list the affected files, most severe first, at most 12.
export function analyze(input: {
  id: string;
  title: string;
  summary: string;
  pr: PullRequest;
  files: ProjectFile[];
  edits: Edit[];
}): CodeChange {
  const editedPaths = new Set(input.edits.map((e) => e.path));
  // The files that might be affected: everything except the edited files themselves.
  const others = input.files.filter((f) => !editedPaths.has(f.path));
  // Step 1. One signal per name across all edited files, keeping its strongest reading.
  const best = new Map<string, Signal>();
  const strength = { removed: 3, defined: 2, literal: 1, used: 0 };
  // A brand-new file can't make existing files stale, so only edits to existing files count.
  for (const sig of input.edits.filter((e) => e.before !== "").flatMap(signalsFor)) {
    const prev = best.get(sig.token);
    if (!prev || strength[sig.strength] > strength[prev.strength]) best.set(sig.token, sig);
  }
  let signals = [...best.values()];

  // Whole-token match; also works for values with spaces or symbols, like "Approve & send".
  const matcher = (token: string) => new RegExp(`(^|[^\\w$])${escape(token)}([^\\w$]|$)`, "m");

  // Step 2. Names that appear in most files carry no information about this change.
  const spread = (token: string) => others.filter((f) => matcher(token).test(f.code)).length;
  // Removed or redefined names always count, however widely they are used.
  const cap = { removed: Infinity, defined: Infinity, literal: 0.4, used: 0.15 };
  signals = signals.filter((s) => {
    const n = spread(s.token);
    return n > 0 && n <= Math.max(2, Math.ceil(others.length * cap[s.strength]));
  });

  signals.sort((a, b) => strength[b.strength] - strength[a.strength]);
  // Old string values (like a button label) are worth finding even in docs.
  const isOldValue = new Set(input.edits.flatMap((e) => e.before.split("\n").flatMap(literals)));

  // Steps 3 and 4. Match each file against the signals, then judge it.
  const impacts: Impact[] = [];
  for (const f of others) {
    const lines = f.code.split("\n");
    const hits: Signal[] = [];
    const evidence: string[] = [];
    // Docs and data files are prose or keys: plain words there are coincidences, not references.
    const plainText = f.kind === "doc" || DATA_RE.test(f.path);
    for (const s of signals) {
      if (plainText && !codeLike(s.token) && !(s.strength === "removed" && isOldValue.has(s.token))) continue;
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
    // A file is only reported when there is a quoted line to show as proof.
    if (v && evidence.length) impacts.push({ path: f.path, level: v.level, why: v.why, evidence });
  }

  const order: Record<Level, number> = { breaks: 0, update: 1, check: 2, safe: 3 };
  impacts.sort((a, b) => order[a.level] - order[b.level]);
  // The file list is large and the caller already has it, so it is left out of the result.
  const { files: _files, ...change } = input;
  void _files;
  return { ...change, impacts: impacts.slice(0, 12) };
}
