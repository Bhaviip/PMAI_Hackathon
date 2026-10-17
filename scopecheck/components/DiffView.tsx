import { diffLines, type DiffLine } from "@/lib/diff";
import type { Edit } from "@/fixtures/codeChangeDemo";

// "The change" section of the page: shows each edited file as a diff.

// Row background, sign and sign color for each kind of diff line.
const ROW = {
  same: { row: "", sign: " ", signColor: "text-faint" },
  add: { row: "bg-moss-50 text-ink", sign: "+", signColor: "text-moss" },
  del: { row: "bg-brick-50 text-ink", sign: "−", signColor: "text-brick" },
};
// Unchanged lines kept around each change, and edited files shown before "and N more".
const CONTEXT = 2;
const MAX_FILES = 5;

// Keeps changed lines plus a little context; long unchanged stretches become a gap.
function hunks(lines: DiffLine[]): (DiffLine | "gap")[] {
  const keep = lines.map(() => false);
  lines.forEach((l, i) => {
    if (l.type === "same") return;
    for (let j = Math.max(0, i - CONTEXT); j <= Math.min(lines.length - 1, i + CONTEXT); j++) keep[j] = true;
  });
  const out: (DiffLine | "gap")[] = [];
  lines.forEach((l, i) => {
    if (keep[i]) out.push(l);
    else if (out[out.length - 1] !== "gap") out.push("gap");
  });
  return out;
}

// Unified diff of each edited file, rendered as text.
export function DiffView({ edits }: { edits: Edit[] }) {
  return (
    <div className="max-h-[420px] space-y-3 overflow-y-auto">
      {edits.slice(0, MAX_FILES).map((e) => (
        <FileDiff key={e.path} edit={e} />
      ))}
      {edits.length > MAX_FILES && (
        <p className="text-xs text-muted">and {edits.length - MAX_FILES} more changed files</p>
      )}
    </div>
  );
}

function FileDiff({ edit }: { edit: Edit }) {
  const lines = diffLines(edit.before, edit.after);
  const added = lines.filter((l) => l.type === "add").length;
  const removed = lines.filter((l) => l.type === "del").length;
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-card">
      <div className="flex items-center gap-3 border-b border-line bg-paper px-4 py-2">
        <span className="truncate font-mono text-xs text-ink">{edit.path}</span>
        <span className="ml-auto shrink-0 font-mono text-xs">
          <span className="text-moss">+{added}</span> <span className="text-brick">−{removed}</span>
        </span>
      </div>
      <pre className="overflow-hidden py-1.5 font-mono text-[12.5px] leading-6">
        {hunks(lines).map((l, i) =>
          l === "gap" ? (
            <div key={i} className="bg-paper px-8 text-faint">⋯</div>
          ) : (
            <div key={i} className={`flex ${ROW[l.type].row}`}>
              <span className={`w-8 shrink-0 select-none text-center ${ROW[l.type].signColor}`}>{ROW[l.type].sign}</span>
              <span className={`min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere] pr-4 ${l.type === "same" ? "text-muted" : ""}`}>{l.text || " "}</span>
            </div>
          ),
        )}
      </pre>
    </div>
  );
}
