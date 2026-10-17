// Read-only code listing with line numbers and highlighted lines. Rendered as text.
export function CodeView({
  lines,
  highlight,
  tone = "evidence",
}: {
  lines: string[];
  highlight?: Set<number>;
  tone?: "evidence" | "removed" | "added";
}) {
  const hl = {
    evidence: "bg-yellow-200/70",
    removed: "bg-rose-100 text-rose-900",
    added: "bg-emerald-100 text-emerald-900",
  }[tone];
  return (
    <pre className="overflow-x-auto rounded-lg bg-slate-50 py-2 font-mono text-[13px] leading-6 ring-1 ring-slate-200">
      {lines.map((l, i) => {
        const on = highlight ? highlight.has(i + 1) : true;
        return (
          <div key={i} className={`flex ${on ? hl : "text-slate-500"}`}>
            <span className="w-10 shrink-0 select-none pr-3 text-right text-slate-400">{i + 1}</span>
            <span className="whitespace-pre pr-4">{l || " "}</span>
          </div>
        );
      })}
    </pre>
  );
}
