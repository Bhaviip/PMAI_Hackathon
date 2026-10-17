// Line-by-line diff of two versions of a file. Used by lib/analyze.ts to find the
// changed lines, and by components/DiffView.tsx to show the change.

// One line of a diff: unchanged, added in the new version, or deleted from the old one.
export type DiffLine = { type: "same" | "add" | "del"; text: string };

// Size limit for the comparison table (old lines × new lines) to avoid freezing the browser.
const MAX_CELLS = 4_000_000;

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

// dp[i][j] is the length of the longest common run of lines between a[i..] and b[j..].
// Walking it from the top gives the fewest additions and deletions.
function middle(a: string[], b: string[]): DiffLine[] {
  if (a.length * b.length > MAX_CELLS)
    return [...a.map((text) => ({ type: "del" as const, text })), ...b.map((text) => ({ type: "add" as const, text }))];
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ type: "del", text: a[i++] });
    else out.push({ type: "add", text: b[j++] });
  }
  while (i < a.length) out.push({ type: "del", text: a[i++] });
  while (j < b.length) out.push({ type: "add", text: b[j++] });
  return out;
}
