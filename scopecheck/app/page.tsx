"use client";

import { useState } from "react";
import { changes, files } from "@/fixtures/codeChangeDemo";
import { ImpactMap } from "@/components/ImpactMap";
import { CodeView } from "@/components/CodeView";
import { Badge } from "@/components/Badge";
import { LEVELS, LEVEL_ORDER, locateEvidence } from "@/lib/levels";

const fileByPath = new Map(files.map((f) => [f.path, f]));

export default function Home() {
  const [changeId, setChangeId] = useState(changes[0].id);
  const change = changes.find((c) => c.id === changeId) ?? changes[0];
  const [selected, setSelected] = useState<string | null>(change.impacts[0]?.path ?? null);

  function pickChange(id: string) {
    const next = changes.find((c) => c.id === id);
    setChangeId(id);
    setSelected(next?.impacts[0]?.path ?? null);
  }

  const impact = change.impacts.find((i) => i.path === selected) ?? null;
  const file = impact ? fileByPath.get(impact.path) : undefined;
  const evidence = impact && file ? locateEvidence(file.code, impact.evidence) : null;
  const counts = Object.fromEntries(
    LEVEL_ORDER.map((l) => [l, change.impacts.filter((i) => i.level === l).length]),
  ) as Record<string, number>;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">ScopeCheck</h1>
            <p className="text-sm text-slate-500">See what a code change touches, with proof.</p>
          </div>
          <span className="ml-auto rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-300">
            Demo project · sample analysis, not live
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-5 py-5">
        <section aria-label="Pick a change" className="flex flex-wrap gap-3">
          {changes.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pickChange(c.id)}
              aria-pressed={c.id === change.id}
              className={`rounded-xl px-4 py-3 text-left ring-1 transition ${
                c.id === change.id
                  ? "bg-slate-900 text-white ring-slate-900"
                  : "bg-white text-slate-800 ring-slate-200 hover:ring-slate-400"
              }`}
            >
              <div className="font-semibold">{c.title}</div>
              <div className={`text-xs ${c.id === change.id ? "text-slate-300" : "text-slate-500"}`}>
                {c.impacts.length} files touched
              </div>
            </button>
          ))}
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 min-w-0">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">The change</h2>
              <p className="mt-1 text-slate-800">{change.summary}</p>
              <p className="mt-2 font-mono text-xs text-slate-500">{change.path}</p>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-rose-700">Before</div>
              <CodeView lines={change.before.split("\n")} tone="removed" />
              <div className="text-xs font-semibold text-emerald-700">After</div>
              <CodeView lines={change.after.split("\n")} tone="added" />
            </div>
            <div className="grid grid-cols-4 gap-2 pt-1">
              {LEVEL_ORDER.map((l) => (
                <div key={l} className={`rounded-lg px-2 py-2 text-center ring-1 ring-inset ${LEVELS[l].chip}`}>
                  <div className="text-2xl font-black">{counts[l]}</div>
                  <div className="text-[11px] font-semibold leading-tight">{LEVELS[l].label}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 min-w-0">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">What it affects</h2>
              <span className="text-xs text-slate-400">Click a file to see the evidence</span>
            </div>
            <ImpactMap change={change} selected={selected} onSelect={setSelected} />
          </section>
        </div>

        {impact && (
          <section className="min-w-0 rounded-2xl bg-white p-5 ring-1 ring-slate-200" aria-label="Evidence">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className={LEVELS[impact.level].chip}>{LEVELS[impact.level].label}</Badge>
              <span className="font-mono text-sm font-semibold">{impact.path}</span>
              <span className="text-xs text-slate-400">{LEVELS[impact.level].hint}</span>
            </div>
            <p className="mt-2 text-lg text-slate-800">{impact.why}</p>
            {evidence && (
              <div className="mt-3">
                <CodeView lines={evidence.lines} highlight={evidence.found} />
              </div>
            )}
            {(!file || (evidence && evidence.missing.length > 0)) && (
              <p className="mt-2 text-sm font-semibold text-rose-700">
                Evidence could not be found in the file, so this impact is not verified.
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
