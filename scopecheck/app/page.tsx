"use client";

// The whole app is this one page. Left sidebar: "Analyze your code", the How To
// steps, and the list of changes (yours first, then the two samples). Main area,
// for the chosen change, top to bottom:
//   header      - pull request details, title and the overall verdict
//   What it affects - the map and list of affected files (ImpactMap)
//   Proof       - the selected file's reason and highlighted evidence lines (CodeView)
//   The change  - the diff of the edited files (DiffView)
// Choosing "Analyze your code" swaps the main area for NewAnalysis.
// All state lives in memory, so a page refresh clears your own analyses.

import { useState } from "react";
import { changes, files, type CodeChange, type Level } from "@/fixtures/codeChangeDemo";
import { ImpactMap } from "@/components/ImpactMap";
import { CodeView } from "@/components/CodeView";
import { DiffView } from "@/components/DiffView";
import { NewAnalysis, type Analysis } from "@/components/NewAnalysis";
import { LEVELS, LEVEL_ORDER, locateEvidence } from "@/lib/levels";

// Sidebar wording, e.g. "1 break", "3 breaks", "2 to update".
const SHORT: Record<Level, (n: number) => string> = {
  breaks: (n) => (n === 1 ? "break" : "breaks"),
  update: () => "to update",
  check: () => "to check",
  safe: () => "safe",
};

const samples: Analysis[] = changes.map((change) => ({ change, files }));

// Impacts in the order the map and the evidence stepper show them: most severe first.
const ordered = (c: CodeChange) =>
  [...c.impacts].sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level));

const countLevels = (c: CodeChange) =>
  Object.fromEntries(LEVEL_ORDER.map((l) => [l, c.impacts.filter((i) => i.level === l).length])) as Record<Level, number>;

const plural = (n: number) => `${n} file${n === 1 ? "" : "s"}`;

export default function Home() {
  // Analyses the visitor ran this session, newest first.
  const [mine, setMine] = useState<Analysis[]>([]);
  const all = [...mine, ...samples];
  // Which change is open. null means the "Analyze your code" form is showing.
  const [changeId, setChangeId] = useState<string | null>(changes[0].id);
  const current = all.find((a) => a.change.id === changeId) ?? null;
  const change = current?.change ?? changes[0];
  const isSample = !mine.some((a) => a.change.id === change.id);
  const impacts = ordered(change);
  // The affected file whose proof is shown, and an optional level filter from the tally.
  const [selected, setSelected] = useState<string | null>(impacts[0]?.path ?? null);
  const [focusLevel, setFocusLevel] = useState<Level | null>(null);
  // Lookups into the project's files, used to show proof and file kinds.
  const fileByPath = new Map((current?.files ?? files).map((f) => [f.path, f]));
  const kinds = new Map((current?.files ?? files).map((f) => [f.path, f.kind]));

  // Opens a change and selects its most severe affected file.
  function show(next: CodeChange) {
    setChangeId(next.id);
    setSelected(ordered(next)[0]?.path ?? null);
    setFocusLevel(null);
  }

  // Called by NewAnalysis when a scan finishes.
  function added(a: Analysis) {
    setMine((m) => [a, ...m]);
    show(a.change);
  }

  const counts = countLevels(change);
  const index = impacts.findIndex((i) => i.path === selected);
  const impact = impacts[index] ?? null;
  const file = impact ? fileByPath.get(impact.path) : undefined;
  // Proof is re-checked against the file text here; quotes that aren't found are flagged below.
  const evidence = impact && file ? locateEvidence(file.code, impact.evidence) : null;
  // Previous / next file in the Proof panel, wrapping around at the ends.
  const step = (d: number) => impacts.length && setSelected(impacts[(index + d + impacts.length) % impacts.length].path);

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-[1360px] items-baseline gap-4 px-5 pt-5 sm:px-8">
          <span className="font-serif text-[26px] font-semibold leading-none tracking-tight">ScopeCheck</span>
          <span className="hidden truncate font-mono text-[13px] text-muted sm:inline">
            {current ? change.pr.repo : "new analysis"}
          </span>
          {current && (
            <span
              className="ml-auto shrink-0 text-[13px] text-muted"
              title={
                isSample
                  ? "A made-up project with a hand-written analysis."
                  : change.review?.status === "ai"
                    ? "A keyword scan found candidate files; an AI model judged each one, and every quoted line was checked against the file."
                    : "Found by matching changed names and values across your files."
              }
            >
              {isSample ? "Sample data" : change.review?.status === "ai" ? `Your code · AI-checked · ${change.review.model}` : "Your code · keyword scan"}
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-[1360px] gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:self-start lg:overflow-y-auto">
          <button
            type="button"
            onClick={() => setChangeId(null)}
            aria-pressed={!current}
            className={`mb-8 w-full rounded-md px-3 py-2.5 text-left text-sm font-medium text-paper transition ${
              current ? "bg-ink hover:bg-accent" : "bg-accent"
            }`}
          >
            Analyze your code →
          </button>
          <HowTo />
          {mine.length > 0 && <ChangeList title="Your changes" items={mine} activeId={changeId} onPick={show} />}
          <ChangeList title="Samples · hand-written, no AI" items={samples} activeId={changeId} onPick={show} />
        </aside>

        <main className="min-w-0">
          {!current ? (
            <NewAnalysis onDone={added} />
          ) : (
            <div className="space-y-10">
              <section>
                <p className="font-mono text-[13px] text-muted">
                  {change.pr.number !== undefined && <>#{change.pr.number} · </>}
                  {change.pr.branch
                    ? `${change.pr.author} → ${change.pr.base ?? "main"} from ${change.pr.branch}`
                    : `${change.pr.author} edited ${plural(change.edits.length)}`}
                </p>
                <h1 className="mt-2 font-serif text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-[40px]">
                  {change.title}
                </h1>
                <Verdict breaks={counts.breaks} touched={change.impacts.length - counts.safe} />
                <p className="mt-3 max-w-[70ch] text-[15px] leading-relaxed text-muted">{change.summary}</p>
                <ReviewNote change={change} />
              </section>

              {/* The map and proof come first: they answer "what does this break?" at a glance. */}
              <div className="grid gap-10 xl:grid-cols-12 xl:gap-8">
                <section className="min-w-0 xl:col-span-7">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6">
                    <SectionTitle>What it affects</SectionTitle>
                    <Tally counts={counts} focus={focusLevel} onFocus={setFocusLevel} />
                  </div>
                  <div className="overflow-hidden rounded-lg border border-line bg-card">
                    {impacts.length ? (
                      <ImpactMap change={change} kinds={kinds} selected={selected} focusLevel={focusLevel} onSelect={setSelected} />
                    ) : (
                      <p className="px-6 py-20 text-center font-serif text-lg text-muted">
                        Nothing else in the project uses what this change touches.
                      </p>
                    )}
                    {impacts.length > 0 && (
                      <ul className="max-h-64 divide-y divide-line overflow-y-auto border-t border-line">
                        {impacts
                          .filter((i) => !focusLevel || i.level === focusLevel)
                          .map((i) => (
                            <li key={i.path}>
                              <button
                                type="button"
                                onClick={() => setSelected(i.path)}
                                aria-pressed={i.path === selected}
                                className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                                  i.path === selected ? "bg-highlight" : "hover:bg-paper"
                                }`}
                              >
                                <span className={`w-24 shrink-0 text-[13px] font-medium ${LEVELS[i.level].text}`}>
                                  {LEVELS[i.level].label}
                                </span>
                                <span className="min-w-0 truncate font-mono text-[12.5px]" title={i.path}>
                                  {i.path}
                                </span>
                              </button>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                </section>

                {impact && (
                  <section className="min-w-0 self-start xl:sticky xl:top-8 xl:col-span-5" aria-label="Evidence" aria-live="polite">
                    <div className="flex items-baseline justify-between gap-2">
                      <SectionTitle>Proof</SectionTitle>
                      <div className="flex items-center gap-1 text-[13px] text-muted">
                        <StepButton label="Previous file" onClick={() => step(-1)}>
                          ←
                        </StepButton>
                        <span className="w-14 text-center tabular-nums">
                          {index + 1} of {impacts.length}
                        </span>
                        <StepButton label="Next file" onClick={() => step(1)}>
                          →
                        </StepButton>
                      </div>
                    </div>
                    <div className="rounded-lg border border-line bg-card p-5">
                      <p className="text-[13px]">
                        <span className={`font-medium ${LEVELS[impact.level].text}`}>{LEVELS[impact.level].label}</span>
                        <span className="text-muted"> · {LEVELS[impact.level].hint}</span>
                      </p>
                      {impact.source && (
                        <p className="mt-1 text-[12px] text-faint">
                          {impact.source === "ai" ? "AI-checked" : "Keyword match, not AI-checked"}
                          {impact.scanLevel && impact.scanLevel !== impact.level && ` · keyword scan said ${LEVELS[impact.scanLevel].label}`}
                        </p>
                      )}
                      <p className="mt-1 break-all font-mono text-[13px]">{impact.path}</p>
                      <p className="mt-4 font-serif text-[21px] leading-snug">{impact.why}</p>
                      {evidence && (
                        <div className="mt-5">
                          <CodeView lines={evidence.lines} highlight={evidence.found} />
                        </div>
                      )}
                      {(!file || (evidence && evidence.missing.length > 0)) && (
                        <p className="mt-3 text-sm font-medium text-brick">Proof not found in the file, so this impact is unverified.</p>
                      )}
                    </div>
                  </section>
                )}
              </div>

              <section>
                <SectionTitle>The change</SectionTitle>
                <DiffView edits={change.edits} />
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 font-serif text-[22px] font-semibold tracking-tight">{children}</h2>;
}

// Under the summary on your own changes: the AI's one-line take, or why the AI check
// didn't run, so keyword-only results are never mistaken for AI-checked ones.
function ReviewNote({ change }: { change: CodeChange }) {
  const r = change.review;
  if (!r) return null;
  if (r.status === "ai") {
    return (
      <p className="mt-3 max-w-[70ch] text-[14px] leading-relaxed">
        <span className="font-medium">AI check:</span> {r.summary}
        {r.withheld > 0 && (
          <span className="text-muted">
            {" "}
            ({r.withheld} verdict{r.withheld === 1 ? "" : "s"} not used because the quoted proof wasn&apos;t in the file.)
          </span>
        )}
      </p>
    );
  }
  return (
    <p className="mt-3 max-w-[70ch] rounded-md bg-ochre-50 px-3 py-2 text-[14px] text-ochre">
      AI check didn&apos;t run: {r.reason} These are keyword matches only.
    </p>
  );
}

// One-sentence summary under the title, e.g. "2 files will break."
function Verdict({ breaks, touched }: { breaks: number; touched: number }) {
  const [lead, color] =
    breaks > 0
      ? [`${plural(breaks)} will break.`, "text-brick"]
      : touched > 0
        ? ["Nothing breaks, but review first.", "text-ochre"]
        : ["Nothing else is affected.", "text-moss"];
  return (
    <p className="mt-4 font-serif text-[22px] leading-snug">
      <span className={`font-semibold ${color}`}>{lead}</span>{" "}
      {touched > 0 && <span className="text-muted">{plural(touched)} to look at before merging.</span>}
    </p>
  );
}

// Counts per level; clicking one narrows the map and list to that level.
function Tally({
  counts,
  focus,
  onFocus,
}: {
  counts: Record<Level, number>;
  focus: Level | null;
  onFocus: (l: Level | null) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1">
      {LEVEL_ORDER.map((l) => {
        const on = focus === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => onFocus(on ? null : l)}
            aria-pressed={on}
            disabled={counts[l] === 0}
            className={`flex items-baseline gap-1.5 border-b-2 pb-0.5 text-[13px] transition disabled:opacity-35 ${
              on ? "border-current" : "border-transparent hover:border-line"
            } ${LEVELS[l].text}`}
          >
            <span className="font-serif text-[20px] font-semibold tabular-nums">{counts[l]}</span>
            <span className="text-muted">{LEVELS[l].label}</span>
          </button>
        );
      })}
    </div>
  );
}

function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-7 w-7 place-items-center rounded-md border border-line bg-card text-ink hover:border-ink"
    >
      {children}
    </button>
  );
}

// Sidebar instructions for using this app.
const HOW_TO = [
  { title: "Pick a change", body: "Open a sample below, or click Analyze your code." },
  { title: "Add your code", body: "Upload a project folder and edit a file, or paste a public GitHub pull request link." },
  { title: "Read the map", body: "Each card is an affected file. Click one to see the lines that prove it." },
];

function HowTo() {
  return (
    <section aria-label="How To" className="mb-8">
      <h2 className="mb-3 text-[12px] font-medium uppercase tracking-[0.08em] text-faint">How To</h2>
      <ol className="space-y-3">
        {HOW_TO.map((s, i) => (
          <li key={s.title} className="flex gap-2.5">
            <span className="font-serif text-[20px] font-semibold leading-none text-faint">{i + 1}</span>
            <div>
              <div className="text-[13px] font-medium leading-snug">{s.title}</div>
              <div className="text-[12.5px] leading-snug text-muted">{s.body}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// A sidebar group of changes, each with a short count of what it affects.
function ChangeList({
  title,
  items,
  activeId,
  onPick,
}: {
  title: string;
  items: Analysis[];
  activeId: string | null;
  onPick: (c: CodeChange) => void;
}) {
  return (
    <div className="mb-8">
      <h2 className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-faint">{title}</h2>
      <ul>
        {items.map(({ change: c }) => {
          const k = countLevels(c);
          const on = c.id === activeId;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick(c)}
                aria-pressed={on}
                className={`w-full border-l-2 py-2.5 pl-3 pr-2 text-left transition ${
                  on ? "border-ink" : "border-line hover:border-faint"
                }`}
              >
                <div className={`text-sm leading-snug ${on ? "font-medium text-ink" : "text-muted"}`}>
                  {c.pr.number !== undefined && <span className="font-mono text-[12px] text-faint">#{c.pr.number} </span>}
                  {c.title}
                </div>
                <div className="mt-1 text-[12px] text-faint">
                  {c.impacts.length === 0
                    ? "No affected files"
                    : LEVEL_ORDER.filter((l) => l !== "safe" && k[l] > 0)
                        .map((l) => `${k[l]} ${SHORT[l](k[l])}`)
                        .join(" · ")}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
