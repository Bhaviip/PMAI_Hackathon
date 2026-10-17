"use client";

import { useMemo, useReducer, useState } from "react";
import demoPacket from "@/fixtures/demo_packet.json";
import sampleReview from "@/fixtures/illustrative_review_NOT_MODEL_OUTPUT.json";
import { PacketPanel } from "@/components/PacketPanel";
import { FindingReview } from "@/components/FindingReview";
import { ExportSummary } from "@/components/ExportSummary";
import { reviewReducer } from "@/lib/reviewState";
import type { AnalysisResult, Packet } from "@/lib/types";

const packet = demoPacket as Packet;
// Manually authored illustrative review. Only ever shown under the Sample review label.
const sample = sampleReview as AnalysisResult;

type Step = "setup" | "review" | "export";
const STEPS: { id: Step; label: string }[] = [
  { id: "setup", label: "1 · Setup" },
  { id: "review", label: "2 · Review" },
  { id: "export", label: "3 · Export" },
];

export default function Home() {
  const [step, setStep] = useState<Step>("setup");
  // Only sample mode exists until the live /api/analyze route is built (task 3).
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [review, dispatch] = useReducer(reviewReducer, {});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const selected = result?.findings.find((f) => f.id === selectedId);
  const highlighted = useMemo(
    () => new Set(selected?.evidence.map((e) => `${selected.artifact_id}/${e.section_id}`) ?? []),
    [selected],
  );

  function openSample() {
    setResult(sample);
    dispatch({ type: "reset", findings: sample.findings });
    setSelectedId(sample.findings[0]?.id ?? null);
    setStep("review");
  }

  function resetRun() {
    setResult(null);
    dispatch({ type: "reset", findings: [] });
    setSelectedId(null);
    setFocusKey(null);
    setStep("setup");
  }

  function select(id: string) {
    setSelectedId(id);
    const f = result?.findings.find((x) => x.id === id);
    if (f?.evidence[0]) setFocusKey(`${f.artifact_id}/${f.evidence[0].section_id}`);
  }

  const isSample = result === sample;

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900">
      <header className="flex flex-wrap items-center gap-4 border-b border-slate-300 bg-white px-5 py-3">
        <div>
          <h1 className="text-xl font-bold">ScopeCheck</h1>
          <p className="text-xs text-slate-500">Review a proposed AI behavior change against its planning packet</p>
        </div>
        <nav className="flex gap-1" aria-label="Steps">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              disabled={s.id !== "setup" && !result}
              aria-current={step === s.id ? "step" : undefined}
              className={`rounded px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                step === s.id ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={resetRun}
          className="ml-auto rounded px-3 py-1.5 text-sm text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100"
        >
          Reset
        </button>
      </header>

      {isSample && (
        <div role="status" className="border-b-2 border-amber-500 bg-amber-100 px-5 py-2 text-sm text-amber-950">
          <strong className="mr-2 rounded bg-amber-500 px-2 py-0.5 text-xs uppercase tracking-wide text-white">
            Sample review
          </strong>
          Illustrative and manually written for UI development. This is <strong>not</strong> a live model result
          and has not been run against any API.
        </div>
      )}

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <section className="min-h-0 overflow-y-auto border-r border-slate-300 p-5" aria-label="Planning packet">
          <PacketPanel packet={packet} highlighted={highlighted} focusKey={focusKey} />
        </section>

        <section className="min-h-0 overflow-y-auto p-5" aria-label="Review">
          {step === "setup" || !result ? (
            <SetupPane onSample={openSample} hasResult={!!result} onContinue={() => setStep("review")} />
          ) : step === "review" ? (
            <FindingReview
              result={result}
              artifacts={packet.artifacts}
              constraints={packet.change_request.protected_constraints}
              review={review}
              dispatch={dispatch}
              selectedId={selectedId}
              onSelect={select}
              onFocusEvidence={setFocusKey}
            />
          ) : (
            <ExportSummary result={result} artifacts={packet.artifacts} review={review} isSample={isSample} />
          )}
        </section>
      </main>
    </div>
  );
}

function SetupPane({
  onSample,
  hasResult,
  onContinue,
}: {
  onSample: () => void;
  hasResult: boolean;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Review impact</h2>
      <p className="text-sm text-slate-700">
        The packet on the left holds the proposed change, its protected rules and {packet.artifacts.length} fictional
        planning artifacts. A live analysis checks every artifact against the change and returns evidence-linked
        findings for you to decide on.
      </p>

      <div className="rounded-lg border border-slate-300 bg-white p-4">
        <button
          type="button"
          disabled
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Run live analysis
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Not connected yet. The server analysis route is the next build step, so no live result is available.
        </p>
      </div>

      <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4">
        <button
          type="button"
          onClick={onSample}
          className="rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
        >
          Open sample review
        </button>
        <p className="mt-2 text-xs text-amber-900">
          Loads a hand-written illustrative review of this packet. It is labeled Sample review everywhere it
          appears and is never presented as model output.
        </p>
      </div>

      {hasResult && (
        <button type="button" onClick={onContinue} className="text-sm font-semibold text-sky-700 underline">
          Continue to review
        </button>
      )}
    </div>
  );
}
