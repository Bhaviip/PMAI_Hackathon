"use client";

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

export default function Home() {
  const [mine, setMine] = useState<Analysis[]>([]);
  const all = [...mine, ...samples];
  const [changeId, setChangeId] = useState<string | null>(changes[0].id);
  const current = all.find((a) => a.change.id === changeId) ?? null;
  const change = current?.change ?? changes[0];
  const isSample = !mine.some((a) => a.change.id === change.id);
  const impacts = ordered(change);
  const [selected, setSelected] = useState<string | null>(impacts[0]?.path ?? null);
  const [focusLevel, setFocusLevel] = useState<Level | null>(null);
  const fileByPath = new Map((current?.files ?? files).map((f) => [f.path, f]));
  const kinds = new Map((current?.files ?? files).map((f) => [f.path, f.kind]));

  function show(next: CodeChange) {
    setChangeId(next.id);
    setSelected(ordered(next)[0]?.path ?? null);
    setFocusLevel(null);
  }

  function added(a: Analysis) {
    setMine((m) => [a, ...m]);
    show(a.change);
  }

  const counts = countLevels(change);
  const index = impacts.findIndex((i) => i.path === selected);
  const impact = impacts[index] ?? null;
  const file = impact ? fileByPath.get(impact.path) : undefined;
  const evidence = impact && file ? locateEvidence(file.code, impact.evidence) : null;
  const step = (d: number) => impacts.length && setSelected(impacts[(index + d + impacts.length) % impacts.length].path);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-black text-white">
            S
          </span>
          <span className="text-[15px] font-bold tracking-tight">ScopeCheck</span>
          <span className="hidden text-slate-300 sm:inline">/</span>
          <span className="hidden truncate font-mono text-sm text-slate-500 sm:inline">{current ? change.pr.repo : "New analysis"}</span>
          {current &&
            (isSample ? (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Sample data
              </span>
            ) : (
              <span
                className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800 ring-1 ring-indigo-200"
                title="Found by matching changed names and values across your files. Review each result."
              >
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                Your code · keyword scan
              </span>
            ))}
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:pb-4">
          <button
            type="button"
            onClick={() => setChangeId(null)}
            aria-pressed={!current}
            className={`mb-5 flex w-full items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
              current ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500"
            }`}
          >
            <span className="text-lg leading-none">+</span> Analyze your code
          </button>
          {mine.length > 0 && <ChangeList title="Your changes" items={mine} activeId={changeId} onPick={show} />}
          <ChangeList title="Sample pull requests" items={samples} activeId={changeId} onPick={show} />
        </aside>

        <main className="min-w-0 space-y-6">
          {!current ? (
            <NewAnalysis onDone={added} />
          ) : (
            <>
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                  {change.title}{" "}
                  {change.pr.number !== undefined && <span className="font-normal text-slate-400">#{change.pr.number}</span>}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {change.pr.branch ? (
                    <>
                      <span className="font-medium text-slate-700">{change.pr.author}</span> wants to merge{" "}
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{change.pr.branch}</span> into{" "}
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{change.pr.base ?? "main"}</span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-slate-700">{change.pr.author}</span> edited{" "}
                      {change.edits.length} file{change.edits.length === 1 ? "" : "s"} in{" "}
                      <span className="font-mono text-xs">{change.pr.repo}</span>
                    </>
                  )}
                </p>
              </div>
              <Verdict breaks={counts.breaks} touched={change.impacts.length - counts.safe} />
            </div>
            <p className="mt-4 text-[15px] text-slate-700">{change.summary}</p>

            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <div className="grid grid-cols-2 gap-3 self-start sm:grid-cols-4 xl:grid-cols-2">
                {LEVEL_ORDER.map((l) => {
                  const on = focusLevel === l;
                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setFocusLevel(on ? null : l)}
                      aria-pressed={on}
                      disabled={counts[l] === 0}
                      className={`rounded-xl p-3 text-left ring-1 transition disabled:opacity-40 ${
                        on ? `${LEVELS[l].pill} ring-2` : "bg-white ring-slate-200 hover:ring-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <span className={`h-2 w-2 rounded-full ${LEVELS[l].dot}`} />
                        {LEVELS[l].label}
                      </div>
                      <div className="mt-1 text-2xl font-bold tabular-nums">{counts[l]}</div>
                    </button>
                  );
                })}
              </div>
              <DiffView edits={change.edits} />
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-12">
            <section className="min-w-0 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 xl:col-span-7">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-semibold">Impact map</h2>
                {focusLevel ? (
                  <button type="button" onClick={() => setFocusLevel(null)} className="text-xs font-medium text-indigo-600 hover:underline">
                    Show all
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">Click a file to see the proof</span>
                )}
              </div>
              {impacts.length ? (
                <ImpactMap change={change} kinds={kinds} selected={selected} focusLevel={focusLevel} onSelect={setSelected} />
              ) : (
                <div className="grid min-h-60 place-items-center rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                  Nothing else in the project uses the names or values this change touches.
                </div>
              )}
              {impacts.length > 0 && (
                <ul className="mt-4 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                  {impacts
                    .filter((i) => !focusLevel || i.level === focusLevel)
                    .map((i) => (
                      <li key={i.path}>
                        <button
                          type="button"
                          onClick={() => setSelected(i.path)}
                          aria-pressed={i.path === selected}
                          className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${
                            i.path === selected ? "bg-indigo-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <span className={`h-2 w-2 shrink-0 rounded-full ${LEVELS[i.level].dot}`} />
                          <span className="w-24 shrink-0 text-xs font-medium text-slate-500">{LEVELS[i.level].label}</span>
                          <span className="min-w-0 truncate font-mono text-xs text-slate-800" title={i.path}>
                            {i.path}
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </section>

            {impact && (
              <section
                className="min-w-0 self-start rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 xl:sticky xl:top-20 xl:col-span-5"
                aria-label="Evidence"
                aria-live="polite"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Proof</h2>
                  <div className="flex items-center gap-1">
                    <span className="mr-1 text-xs tabular-nums text-slate-400">
                      {index + 1} of {impacts.length}
                    </span>
                    <StepButton label="Previous file" onClick={() => step(-1)} d="M10 4 6 8l4 4" />
                    <StepButton label="Next file" onClick={() => step(1)} d="m6 4 4 4-4 4" />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${LEVELS[impact.level].pill}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${LEVELS[impact.level].dot}`} />
                    {LEVELS[impact.level].label}
                  </span>
                  <span className="truncate font-mono text-sm font-medium">{impact.path}</span>
                </div>
                <p className="mt-3 text-base font-medium leading-snug text-slate-800">{impact.why}</p>
                {evidence && (
                  <div className="mt-4">
                    <CodeView lines={evidence.lines} highlight={evidence.found} />
                  </div>
                )}
                {(!file || (evidence && evidence.missing.length > 0)) && (
                  <p className="mt-3 text-sm font-medium text-rose-700">
                    Proof not found in the file, so this impact is unverified.
                  </p>
                )}
              </section>
            )}
          </div>

            </>
          )}
          <HowItWorks />
        </main>
      </div>
    </div>
  );
}

function Verdict({ breaks, touched }: { breaks: number; touched: number }) {
  const plural = (n: number) => `${n} file${n === 1 ? "" : "s"}`;
  const v =
    breaks > 0
      ? { tone: "bg-rose-50 text-rose-800 ring-rose-200", kicker: "Not safe to merge yet", head: `${plural(breaks)} will break` }
      : touched > 0
        ? { tone: "bg-amber-50 text-amber-900 ring-amber-200", kicker: "Review before merging", head: "Nothing breaks" }
        : { tone: "bg-emerald-50 text-emerald-800 ring-emerald-200", kicker: "Looks safe", head: "Nothing affected" };
  return (
    <div className={`shrink-0 rounded-xl px-4 py-2.5 ring-1 ${v.tone}`}>
      <div className="text-xs font-medium opacity-75">{v.kicker}</div>
      <div className="text-lg font-bold">{v.head}</div>
      {touched > 0 && <div className="text-xs opacity-75">{plural(touched)} to look at</div>}
    </div>
  );
}

function StepButton({ label, onClick, d }: { label: string; onClick: () => void; d: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-900"
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </button>
  );
}

const STEPS = [
  { title: "Connect a repo", body: "Install ScopeCheck on GitHub once." },
  { title: "Open a pull request", body: "ScopeCheck reads the diff and the code around it." },
  { title: "See the impact", body: "Every affected file, with the lines that prove it." },
];

function HowItWorks() {
  return (
    <section aria-label="How it works" className="grid gap-3 sm:grid-cols-3">
      {STEPS.map((s, i) => (
        <div key={s.title} className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-600">
            {i + 1}
          </span>
          <div>
            <div className="text-sm font-semibold">{s.title}</div>
            <div className="text-sm text-slate-500">{s.body}</div>
          </div>
        </div>
      ))}
    </section>
  );
}

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
    <div className="mb-5">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h2>
      <ul className="mt-3 space-y-2">
        {items.map(({ change: c }) => {
          const k = countLevels(c);
          const on = c.id === activeId;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick(c)}
                aria-pressed={on}
                className={`w-full rounded-xl px-3.5 py-3 text-left transition ${
                  on ? "bg-white shadow-sm ring-2 ring-indigo-500" : "ring-1 ring-slate-200 hover:bg-white"
                }`}
              >
                <div className="flex items-baseline gap-2">
                  {c.pr.number !== undefined && <span className="font-mono text-xs text-slate-400">#{c.pr.number}</span>}
                  <span className="truncate text-sm font-semibold">{c.title}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  {LEVEL_ORDER.filter((l) => l !== "safe" && k[l] > 0).map((l) => (
                    <span key={l} className="inline-flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${LEVELS[l].dot}`} />
                      {k[l]} {SHORT[l](k[l])}
                    </span>
                  ))}
                  {c.impacts.length === 0 && <span>No affected files</span>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
