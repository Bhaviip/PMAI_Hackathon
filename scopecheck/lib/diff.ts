// Line-by-line diff of two versions of a file. Used by lib/analyze.ts to find the
// changed lines, and by components/DiffView.tsx to show the change.

// One line of a diff: unchanged, added in the new version, or deleted from the old one.
export type DiffLine = { type: "same" | "add" | "del"; text: string };

// Most added plus deleted lines the diff will work out exactly. Beyond this the
// files are too different to be worth aligning, and the middle is shown as replaced.
const MAX_EDITS = 3_000;

// Line diff: shared prefix and suffix are trimmed, then the middle is diffed by
// longest common subsequence. A middle too large for that is shown as replaced.
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before === "" ? [] : before.split("\n");
  const b = after === "" ? [] : after.split("\n");
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const same = (t: string): DiffLine => ({ type: "same", text: t });
  return [
    ...a.slice(0, start).map(same),
    ...middle(a.slice(start, endA), b.slice(start, endB)),
    ...a.slice(endA).map(same),
  ];
}

// Myers' diff: finds the fewest additions and deletions. Its cost grows with the
// number of changed lines, not the file size, so a small edit to a 3,000-line
// test file stays small instead of showing the whole file as rewritten.
function middle(a: string[], b: string[]): DiffLine[] {
  const n = a.length;
  const m = b.length;
  const replaced = (): DiffLine[] => [
    ...a.map((text) => ({ type: "del" as const, text })),
    ...b.map((text) => ({ type: "add" as const, text })),
  ];
  if (n === 0 || m === 0) return replaced();

  // v[k + offset] is the furthest index into a reached on diagonal k (k = x - y).
  // trace keeps a copy of v after each round so the path can be walked back.
  const max = Math.min(n + m, MAX_EDITS);
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  let found = false;
  for (let d = 0; d <= max && !found; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[k - 1 + offset] < v[k + 1 + offset]) ? v[k + 1 + offset] : v[k - 1 + offset] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[k + offset] = x;
      if (x >= n && y >= m) {
        found = true;
        break;
      }
    }
  }
  if (!found) return replaced();

  // Walk back from the end, recording each step, then reverse.
  const out: DiffLine[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const vd = trace[d];
    const k = x - y;
    const prevK = k === -d || (k !== d && vd[k - 1 + offset] < vd[k + 1 + offset]) ? k + 1 : k - 1;
    const prevX = vd[prevK + offset];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      out.push({ type: "same", text: a[--x] });
      y--;
    }
    if (d > 0) {
      if (x === prevX) out.push({ type: "add", text: b[--y] });
      else out.push({ type: "del", text: a[--x] });
    }
  }
  return out.reverse();
}
