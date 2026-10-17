// Read-only code listing with line numbers; evidence lines are marked. Rendered as text.
export function CodeView({ lines, highlight }: { lines: string[]; highlight: Set<number> }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/60 py-2 font-mono text-[12.5px] leading-6">
      {lines.map((l, i) => {
        const on = highlight.has(i + 1);
        return (
          <div
            key={i}
            className={`flex border-l-[3px] ${on ? "border-indigo-500 bg-indigo-50 text-slate-900" : "border-transparent text-slate-500"}`}
          >
            <span className={`w-10 shrink-0 select-none pr-3 text-right ${on ? "font-semibold text-indigo-600" : "text-slate-300"}`}>
              {i + 1}
            </span>
            <span className="whitespace-pre pr-4">{l || " "}</span>
          </div>
        );
      })}
    </pre>
  );
}
