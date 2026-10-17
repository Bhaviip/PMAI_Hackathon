import { diffLines } from "@/lib/diff";

const ROW = {
  same: { row: "", sign: " ", signColor: "text-slate-300" },
  add: { row: "bg-emerald-50 text-emerald-900", sign: "+", signColor: "text-emerald-600" },
  del: { row: "bg-rose-50 text-rose-900", sign: "−", signColor: "text-rose-500" },
};

// Unified diff of the changed snippet, rendered as text.
export function DiffView({ path, before, after }: { path: string; before: string; after: string }) {
  const lines = diffLines(before, after);
  const added = lines.filter((l) => l.type === "add").length;
  const removed = lines.filter((l) => l.type === "del").length;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2">
        <span className="truncate font-mono text-xs text-slate-700">{path}</span>
        <span className="ml-auto shrink-0 font-mono text-xs">
          <span className="text-emerald-600">+{added}</span> <span className="text-rose-500">−{removed}</span>
        </span>
      </div>
      <pre className="overflow-x-auto py-1.5 font-mono text-[12.5px] leading-6">
        {lines.map((l, i) => (
          <div key={i} className={`flex ${ROW[l.type].row}`}>
            <span className={`w-8 shrink-0 select-none text-center ${ROW[l.type].signColor}`}>{ROW[l.type].sign}</span>
            <span className={`whitespace-pre pr-4 ${l.type === "same" ? "text-slate-500" : ""}`}>{l.text || " "}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
