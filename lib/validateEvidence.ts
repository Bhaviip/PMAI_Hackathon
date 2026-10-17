// Checks model output against the packet that was actually sent.
// Only findings in `valid` may be offered for approval; everything else is
// withheld with a reason so the UI can show why.
import {
  AnalysisSchema,
  type AnalyzeRequest,
  type Finding,
  type OpenQuestion,
} from "./schema";

export const UNASSIGNED = "Unassigned";

export type WithheldFinding = { finding: Finding; reasons: string[] };
export type WithheldQuestion = { question: OpenQuestion; reasons: string[] };

export type ValidationResult = {
  /** False when the response could not be parsed at all. */
  parsed: boolean;
  change_summary: string;
  valid: Finding[];
  withheld: WithheldFinding[];
  open_questions: OpenQuestion[];
  withheld_questions: WithheldQuestion[];
  /** Supplied artifacts that received no valid classification. */
  missing_artifact_ids: string[];
  /** Response-level problems (parse errors, missing classifications). */
  errors: string[];
};

/** Accepts a raw model string or already-parsed JSON. */
export function validateAnalysis(raw: unknown, request: AnalyzeRequest): ValidationResult {
  const result: ValidationResult = {
    parsed: false,
    change_summary: "",
    valid: [],
    withheld: [],
    open_questions: [],
    withheld_questions: [],
    missing_artifact_ids: request.artifacts.map((a) => a.id),
    errors: [],
  };

  let json: unknown = raw;
  if (typeof raw === "string") {
    try {
      json = JSON.parse(raw);
    } catch {
      result.errors.push("Model response is not valid JSON");
      return result;
    }
  }

  const parsed = AnalysisSchema.safeParse(json);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      result.errors.push(`Schema: ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    return result;
  }
  result.parsed = true;
  result.change_summary = parsed.data.change_summary;

  const artifacts = new Map(request.artifacts.map((a) => [a.id, a]));
  const constraintCount = request.change_request.protected_constraints.length;
  const seenFindingIds = new Set<string>();
  const classified = new Set<string>();

  for (const f of parsed.data.findings) {
    const reasons: string[] = [];
    const artifact = artifacts.get(f.artifact_id);

    if (seenFindingIds.has(f.id)) reasons.push(`Duplicate finding id ${f.id}`);
    seenFindingIds.add(f.id);

    if (!artifact) {
      reasons.push(`Unknown artifact_id ${f.artifact_id}`);
    } else {
      if (classified.has(f.artifact_id)) {
        reasons.push(`Artifact ${f.artifact_id} already has a finding`);
      }
      const sections = new Map(artifact.sections.map((s) => [s.id, s.text]));
      for (const e of f.evidence) {
        const text = sections.get(e.section_id);
        if (text === undefined) {
          reasons.push(`Unknown section_id ${e.section_id} in ${f.artifact_id}`);
        } else if (e.quote.trim() === "") {
          reasons.push(`Empty quote for ${f.artifact_id}/${e.section_id}`);
        } else if (!text.includes(e.quote)) {
          reasons.push(`Quote not found verbatim in ${f.artifact_id}/${e.section_id}`);
        }
      }
    }

    const hasRevision = f.proposed_revision.trim() !== "";
    if (f.kind === "update" && !hasRevision) {
      reasons.push("Update finding has no proposed_revision");
    }
    if (f.kind !== "update" && hasRevision) {
      reasons.push(`${f.kind} finding must have an empty proposed_revision`);
    }

    for (const id of f.protected_constraint_ids) {
      if (id >= constraintCount) reasons.push(`Unknown protected_constraint_id ${id}`);
    }

    if (reasons.length > 0) {
      result.withheld.push({ finding: f, reasons });
    } else {
      result.valid.push(f);
      classified.add(f.artifact_id);
    }
  }

  result.missing_artifact_ids = request.artifacts
    .map((a) => a.id)
    .filter((id) => !classified.has(id));
  for (const id of result.missing_artifact_ids) {
    result.errors.push(`No valid classification for artifact ${id}`);
  }

  const owners = new Set(request.artifacts.map((a) => a.owner));
  for (const q of parsed.data.open_questions) {
    const reasons: string[] = [];
    for (const id of q.artifact_ids) {
      if (!artifacts.has(id)) reasons.push(`Unknown artifact_id ${id}`);
    }
    if (q.suggested_owner !== UNASSIGNED && !owners.has(q.suggested_owner)) {
      reasons.push(`Owner ${q.suggested_owner} is not in artifact metadata`);
    }
    if (reasons.length > 0) result.withheld_questions.push({ question: q, reasons });
    else result.open_questions.push(q);
  }

  return result;
}
