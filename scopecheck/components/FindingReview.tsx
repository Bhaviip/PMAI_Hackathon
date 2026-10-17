"use client";

import { Badge } from "./Badge";
import { KIND_LABEL, KIND_ORDER, KIND_STYLE, STATUS_STYLE } from "@/lib/labels";
import {
  STATUS_LABEL,
  canDecide,
  type ReviewAction,
  type ReviewState,
  type ReviewStatus,
} from "@/lib/reviewState";
import type { AnalysisResult, Artifact, Finding } from "@/lib/types";

type Props = {
  result: AnalysisResult;
  artifacts: Artifact[];
  constraints: string[];
  review: ReviewState;
  dispatch: (a: ReviewAction) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onFocusEvidence: (key: string) => void;
};

// Right pane: summary counts, the finding list, and the selected finding's detail.
export function FindingReview(props: Props) {
  const { result, artifacts, review, selectedId, onSelect } = props;
  const byArtifact = new Map(artifacts.map((a) => [a.id, a]));
  const counts = Object.fromEntries(
    KIND_ORDER.map((k) => [k, result.findings.filter((f) => f.kind === k).length]),
  ) as Record<string, number>;
  counts.question += result.open_questions.length;
  const selected = result.findings.find((f) => f.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-700">
        <span className="font-semibold">Change summary:</span> {result.change_summary}
      </p>

      <div className="grid grid-cols-4 gap-2">
        {KIND_ORDER.map((k) => (
          <div key={k} className={`rounded-md p-2 text-center ring-1 ring-inset ${KIND_STYLE[k]}`}>
            <div className="text-2xl font-bold">{counts[k]}</div>
            <div className="text-xs font-semibold">{KIND_LABEL[k]}</div>
          </div>
        ))}
      </div>

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-300 bg-white">
        {result.findings.map((f) => {
          const a = byArtifact.get(f.artifact_id);
          const r = review[f.id];
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onSelect(f.id)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  f.id === selectedId ? "bg-sky-50" : ""
                }`}
              >
                <Badge className={KIND_STYLE[f.kind]}>{KIND_LABEL[f.kind]}</Badge>
                <span className="font-mono text-xs text-slate-600">{f.artifact_id}</span>
                <span className="truncate text-slate-900">{a?.title ?? "Unknown artifact"}</span>
                {r && <Badge className={`ml-auto shrink-0 ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</Badge>}
              </button>
            </li>
          );
        })}
      </ul>

      {selected ? (
        <FindingDetail {...props} finding={selected} artifact={byArtifact.get(selected.artifact_id)} />
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          Select a finding to inspect its source evidence and decide.
        </p>
      )}

      {result.open_questions.length > 0 && (
        <section className="rounded-lg border border-purple-300 bg-purple-50 p-3">
          <h3 className="text-sm font-semibold text-purple-900">Open questions</h3>
          <ul className="mt-2 space-y-2 text-sm text-slate-800">
            {result.open_questions.map((q, i) => (
              <li key={i}>
                <p>{q.question}</p>
                <p className="text-xs text-slate-500">
                  {q.artifact_ids.join(", ")} · suggested owner: {q.suggested_owner}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const DECISIONS: { status: ReviewStatus; label: string; style: string }[] = [
  { status: "accepted", label: "Accept", style: "bg-emerald-600 text-white hover:bg-emerald-700" },
  { status: "rejected", label: "Reject", style: "bg-rose-600 text-white hover:bg-rose-700" },
  { status: "needs_clarification", label: "Needs clarification", style: "bg-amber-400 text-amber-950 hover:bg-amber-500" },
  { status: "pending", label: "Back to pending", style: "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50" },
];

function FindingDetail({
  finding: f,
  artifact,
  constraints,
  review,
  dispatch,
  onFocusEvidence,
}: Props & { finding: Finding; artifact: Artifact | undefined }) {
  const r = review[f.id];
  if (!r) return null;
  const isUpdate = f.kind === "update";
  const edit = (field: "reviewer_role" | "reviewer_note" | "edited_revision", value: string) =>
    dispatch({ type: "edit", findingId: f.id, field, value });

  return (
    <section className="space-y-3 rounded-lg border border-slate-300 bg-white p-4">
      <header className="flex flex-wrap items-center gap-2">
        <Badge className={KIND_STYLE[f.kind]}>{KIND_LABEL[f.kind]}</Badge>
        <span className="font-mono text-xs text-slate-600">{f.artifact_id}</span>
        <span className="font-semibold text-slate-900">{artifact?.title}</span>
        <span className="text-xs text-slate-500">owner: {artifact?.owner}</span>
        <Badge className={`ml-auto ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</Badge>
      </header>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source evidence</h4>
        {f.evidence.map((e) => (
          <button
            key={e.section_id}
            type="button"
            onClick={() => onFocusEvidence(`${f.artifact_id}/${e.section_id}`)}
            className="mt-1 block w-full rounded border-l-4 border-yellow-400 bg-yellow-50 px-3 py-2 text-left text-sm text-slate-800 hover:bg-yellow-100"
            title="Show in the packet"
          >
            <span className="mr-2 font-mono text-xs text-slate-500">{e.section_id}</span>“{e.quote}”
          </button>
        ))}
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Explanation</h4>
        <p className="text-sm text-slate-800">{f.explanation}</p>
      </div>

      {f.protected_constraint_ids.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Protected rules involved</h4>
          <ul className="text-sm text-slate-800">
            {f.protected_constraint_ids.map((i) => (
              <li key={i}>
                <span className="mr-1 font-mono text-xs text-slate-500">C{i}</span>
                {constraints[i]}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isUpdate && (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current text</h4>
            <p className="mt-1 rounded bg-slate-100 p-2 text-sm text-slate-700">
              {f.evidence.map((e) => e.quote).join(" ")}
            </p>
          </div>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested wording (editable)</span>
            <textarea
              value={r.edited_revision}
              onChange={(e) => edit("edited_revision", e.target.value)}
              rows={5}
              className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
            />
            {r.edited_revision !== f.proposed_revision && (
              <span className="text-xs text-amber-700">Edited by reviewer</span>
            )}
          </label>
        </div>
      )}

      <div className="grid gap-3 border-t border-slate-200 pt-3 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your role</span>
          <input
            value={r.reviewer_role}
            onChange={(e) => edit("reviewer_role", e.target.value)}
            placeholder="e.g. PM, Engineering lead"
            className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Note</span>
          <input
            value={r.reviewer_note}
            onChange={(e) => edit("reviewer_note", e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {DECISIONS.map((d) => {
          const allowed = canDecide(r, d.status);
          return (
            <button
              key={d.status}
              type="button"
              disabled={!allowed || r.status === d.status}
              onClick={() => dispatch({ type: "decide", findingId: f.id, status: d.status })}
              className={`rounded px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${d.style}`}
            >
              {d.label}
            </button>
          );
        })}
        {!canDecide(r, "accepted") && (
          <span className="text-xs text-slate-500">Enter your role to accept.</span>
        )}
      </div>
    </section>
  );
}
