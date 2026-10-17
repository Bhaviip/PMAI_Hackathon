// Used in the Proof panel to show where the evidence sits in the affected file.

// Lines shown around each evidence line, and the length below which a file is shown in full.
const CONTEXT = 4;
const SHORT_FILE = 30;

// Read-only code listing with line numbers; evidence lines are marked. Long files
// show only the lines around the evidence. Rendered as text.
export function CodeView({ lines, highlight }: { lines: string[]; highlight: Set<number> }) {
  const near = (n: number) => [...highlight].some((h) => Math.abs(h - n) <= CONTEXT);
  const visible = lines.map((_, i) => lines.length <= SHORT_FILE || near(i + 1));
  return (
    <pre className="max-h-[480px] overflow-y-auto rounded-lg border border-line bg-paper/60 py-2 font-mono text-[12.5px] leading-6">
      {lines.map((l, i) => {
        if (!visible[i]) return i > 0 && visible[i - 1] ? <div key={i} className="px-10 text-faint">⋯</div> : null;
        const on = highlight.has(i + 1);
        return (
          <div
            key={i}
            className={`flex border-l-[3px] ${on ? "border-ochre bg-highlight text-ink" : "border-transparent text-muted"}`}
          >
            <span className={`w-10 shrink-0 select-none pr-3 text-right ${on ? "font-semibold text-ochre" : "text-faint"}`}>
              {i + 1}
            </span>
            <span className="min-w-0 whitespace-pre-wrap pr-4 [overflow-wrap:anywhere]">{l || " "}</span>
          </div>
        );
      })}
    </pre>
  );
}
