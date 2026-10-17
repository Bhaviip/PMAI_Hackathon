import type { FindingKind } from "./types";
import type { ReviewStatus } from "./reviewState";

// Every classification and status is shown as a text label; color only reinforces it.
export const KIND_LABEL: Record<FindingKind, string> = {
  update: "Update",
  question: "Question",
  preserve: "Preserve",
  unaffected: "Unaffected",
};

export const KIND_STYLE: Record<FindingKind, string> = {
  update: "bg-blue-100 text-blue-900 ring-blue-300",
  question: "bg-purple-100 text-purple-900 ring-purple-300",
  preserve: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  unaffected: "bg-slate-100 text-slate-700 ring-slate-300",
};

export const STATUS_STYLE: Record<ReviewStatus, string> = {
  pending: "bg-white text-slate-700 ring-slate-300",
  accepted: "bg-emerald-600 text-white ring-emerald-700",
  rejected: "bg-rose-600 text-white ring-rose-700",
  needs_clarification: "bg-amber-400 text-amber-950 ring-amber-500",
};

export const KIND_ORDER: FindingKind[] = ["update", "question", "preserve", "unaffected"];
