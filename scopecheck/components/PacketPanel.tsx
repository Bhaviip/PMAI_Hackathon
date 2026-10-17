"use client";

import { useEffect, useRef } from "react";
import type { Packet } from "@/lib/types";

type Props = {
  packet: Packet;
  // Sections cited by the selected finding, keyed `${artifactId}/${sectionId}`.
  highlighted: Set<string>;
  focusKey: string | null;
};

// Left pane: the planning packet. Original text is immutable and rendered as text.
export function PacketPanel({ packet, highlighted, focusKey }: Props) {
  const { change_request: cr, artifacts } = packet;
  const refs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (focusKey) refs.current[focusKey]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusKey]);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-300 bg-white p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Change request</h2>
          <span className="font-mono text-xs text-slate-500">{cr.id}</span>
        </div>
        <p className="mt-1 text-lg font-semibold text-slate-900">{cr.title}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-800">{cr.proposed_change}</p>
        <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Protected rules</h3>
        <ol className="mt-1 space-y-1 text-sm text-slate-800">
          {cr.protected_constraints.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-mono text-xs text-slate-500">C{i}</span>
              <span>{c}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs italic text-slate-500">{cr.boundary_note}</p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Source artifacts ({artifacts.length})
        </h2>
        <div className="space-y-3">
          {artifacts.map((a) => (
            <article key={a.id} className="rounded-lg border border-slate-300 bg-white p-3">
              <header className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-xs font-semibold text-slate-700">{a.id}</span>
                <span className="font-medium text-slate-900">{a.title}</span>
                <span className="ml-auto text-xs text-slate-500">
                  {a.kind} · owner: {a.owner}
                </span>
              </header>
              <div className="mt-2 space-y-1.5">
                {a.sections.map((s) => {
                  const key = `${a.id}/${s.id}`;
                  const on = highlighted.has(key);
                  return (
                    <p
                      key={s.id}
                      ref={(el) => {
                        refs.current[key] = el;
                      }}
                      className={`rounded px-2 py-1 text-sm leading-relaxed ${
                        on ? "bg-yellow-100 ring-2 ring-yellow-400" : "text-slate-700"
                      }`}
                    >
                      <span className="mr-2 font-mono text-xs text-slate-400">{s.id}</span>
                      {s.text}
                    </p>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
