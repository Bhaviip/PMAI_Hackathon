"use client";

import { STATUS_LABEL, countByStatus, type ReviewState } from "@/lib/reviewState";
import type { AnalysisResult, Artifact } from "@/lib/types";

type Props = { result: AnalysisResult; artifacts: Artifact[]; review: ReviewState; isSample: boolean };

// On-screen preview of where each decision lands. Markdown download is task 4.
export function ExportSummary({ result, artifacts, review, isSample }: Props) {
  const title = new Map(artifacts.map((a) => [a.id, a.title]));
  const counts = countByStatus(review);
  const approved = result.findings.filter((f) => f.kind === "update" && review[f.id]?.status === "accepted");
  const preserved = result.findings.filter((f) => f.kind === "preserve");
  const unresolved = result.findings.filter(
    (f) => f.kind !== "unaffected" && f.kind !== "preserve" && review[f.id]?.status !== "accepted" && review[f.id]?.status !== "rejected",
  );
  const rejected = result.findings.filter((f) => review[f.id]?.status === "rejected");

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Export preview{isSample && " (sample review)"}</h2>
      <p className="text-sm text-slate-600">
        This is a proposed change packet. It does not update any external ticket and does not mean the change is
        ready to release.
      </p>

      <Block title={`Approved proposals (${approved.length})`}>
        {approved.length === 0 ? (
          <Empty>No accepted update proposals yet.</Empty>
        ) : (
          approved.map((f) => (
            <div key={f.id} className="text-sm">
              <p className="font-medium">
                {f.artifact_id} · {title.get(f.artifact_id)}{" "}
                <span className="text-xs text-slate-500">accepted by {review[f.id].reviewer_role}</span>
              </p>
              <p className="text-slate-800">{review[f.id].edited_revision}</p>
            </div>
          ))
        )}
      </Block>

      <Block title={`Protected rules (${preserved.length})`}>
        {preserved.map((f) => (
          <p key={f.id} className="text-sm">
            {f.artifact_id} · {f.evidence[0]?.quote}
          </p>
        ))}
      </Block>

      <Block title={`Open questions and unresolved items (${result.open_questions.length + unresolved.length})`}>
        {result.open_questions.map((q, i) => (
          <p key={i} className="text-sm">
            {q.question} <span className="text-xs text-slate-500">({q.suggested_owner})</span>
          </p>
        ))}
        {unresolved.map((f) => (
          <p key={f.id} className="text-sm">
            {f.artifact_id} · {STATUS_LABEL[review[f.id]?.status ?? "pending"]}
          </p>
        ))}
      </Block>

      {rejected.length > 0 && (
        <Block title={`Decision history: rejected (${rejected.length})`}>
          {rejected.map((f) => (
            <p key={f.id} className="text-sm">
              {f.artifact_id} · {title.get(f.artifact_id)}
            </p>
          ))}
        </Block>
      )}

      <Block title="Review summary">
        <p className="text-sm">
          {counts.accepted} accepted · {counts.rejected} rejected · {counts.needs_clarification} need clarification ·{" "}
          {counts.pending} pending
        </p>
      </Block>

      <button
        type="button"
        disabled
        className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        Download Markdown
      </button>
      <p className="text-xs text-slate-500">Markdown download is not built yet.</p>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-lg border border-slate-300 bg-white p-3">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm italic text-slate-500">{children}</p>;
}
