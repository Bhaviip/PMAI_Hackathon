// Application-owned review state (contracts/review_state.json). The model never
// sets these fields. Persistence and run invalidation arrive in task 4.

import type { Finding } from "./types";

export type ReviewStatus = "pending" | "accepted" | "rejected" | "needs_clarification";

export type FindingReview = {
  status: ReviewStatus;
  reviewer_role: string;
  reviewer_note: string;
  edited_revision: string;
};

export type ReviewState = Record<string, FindingReview>;

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: "Pending",
  accepted: "Accepted proposal",
  rejected: "Rejected",
  needs_clarification: "Needs clarification",
};

export function initialReviewState(findings: Finding[]): ReviewState {
  return Object.fromEntries(
    findings.map((f) => [
      f.id,
      { status: "pending", reviewer_role: "", reviewer_note: "", edited_revision: f.proposed_revision },
    ]),
  );
}

export type ReviewAction =
  | { type: "edit"; findingId: string; field: "reviewer_role" | "reviewer_note" | "edited_revision"; value: string }
  | { type: "decide"; findingId: string; status: ReviewStatus }
  | { type: "reset"; findings: Finding[] };

export function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case "reset":
      return initialReviewState(action.findings);
    case "edit": {
      const current = state[action.findingId];
      if (!current) return state;
      const next = { ...current, [action.field]: action.value };
      // Editing accepted wording withdraws the acceptance; the reviewer must accept again.
      if (action.field === "edited_revision" && current.status === "accepted") next.status = "pending";
      return { ...state, [action.findingId]: next };
    }
    case "decide": {
      const current = state[action.findingId];
      if (!current) return state;
      if (!canDecide(current, action.status)) return state;
      return { ...state, [action.findingId]: { ...current, status: action.status } };
    }
  }
}

// Accepting a proposal requires a reviewer role (a demo label, not authentication).
export function canDecide(review: FindingReview, status: ReviewStatus): boolean {
  if (status === "accepted") return review.reviewer_role.trim().length > 0;
  return true;
}

export function countByStatus(state: ReviewState): Record<ReviewStatus, number> {
  const counts: Record<ReviewStatus, number> = { pending: 0, accepted: 0, rejected: 0, needs_clarification: 0 };
  for (const r of Object.values(state)) counts[r.status]++;
  return counts;
}
