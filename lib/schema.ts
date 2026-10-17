// Zod contracts for ScopeCheck.
// Model output mirrors scopecheck/contracts/analysis.schema.json.
// Request shape mirrors scopecheck/fixtures/demo_packet.json.
import { z } from "zod";

export const MAX_ARTIFACTS = 8;
export const MAX_INPUT_CHARS = 30_000;

// ---------- Request (what the browser sends to /api/analyze) ----------

export const SectionSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
});

export const ArtifactSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  kind: z.string(),
  owner: z.string().min(1),
  feature_id: z.string().optional(),
  sections: z.array(SectionSchema).min(1),
});

export const ChangeRequestSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  proposed_change: z.string().min(1),
  protected_constraints: z.array(z.string()),
  boundary_note: z.string().optional(),
});

/** Counts every user-supplied string the model will see. */
export function countInputChars(req: {
  change_request: z.infer<typeof ChangeRequestSchema>;
  artifacts: z.infer<typeof ArtifactSchema>[];
}): number {
  const cr = req.change_request;
  let n =
    cr.id.length +
    cr.title.length +
    cr.proposed_change.length +
    (cr.boundary_note?.length ?? 0) +
    cr.protected_constraints.reduce((sum, c) => sum + c.length, 0);
  for (const a of req.artifacts) {
    n += a.id.length + a.title.length + a.kind.length + a.owner.length;
    n += a.feature_id?.length ?? 0;
    for (const s of a.sections) n += s.id.length + s.text.length;
  }
  return n;
}

export const AnalyzeRequestSchema = z
  .object({
    change_request: ChangeRequestSchema,
    artifacts: z.array(ArtifactSchema).min(1).max(MAX_ARTIFACTS),
  })
  .superRefine((req, ctx) => {
    const artifactIds = new Set<string>();
    req.artifacts.forEach((a, i) => {
      if (artifactIds.has(a.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["artifacts", i, "id"],
          message: `Duplicate artifact id ${a.id}`,
        });
      }
      artifactIds.add(a.id);
      const sectionIds = new Set<string>();
      a.sections.forEach((s, j) => {
        if (sectionIds.has(s.id)) {
          ctx.addIssue({
            code: "custom",
            path: ["artifacts", i, "sections", j, "id"],
            message: `Duplicate section id ${s.id} in ${a.id}`,
          });
        }
        sectionIds.add(s.id);
      });
    });
    const chars = countInputChars(req);
    if (chars > MAX_INPUT_CHARS) {
      ctx.addIssue({
        code: "custom",
        path: [],
        message: `Input is ${chars} characters; the limit is ${MAX_INPUT_CHARS}`,
      });
    }
  });

export type Section = z.infer<typeof SectionSchema>;
export type Artifact = z.infer<typeof ArtifactSchema>;
export type ChangeRequest = z.infer<typeof ChangeRequestSchema>;
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

// ---------- Model response (strict: no extra fields such as approval state) ----------

export const FindingKindSchema = z.enum(["update", "question", "preserve", "unaffected"]);

export const EvidenceSchema = z.strictObject({
  section_id: z.string(),
  quote: z.string(),
});

export const FindingSchema = z.strictObject({
  id: z.string().min(1),
  artifact_id: z.string().min(1),
  kind: FindingKindSchema,
  evidence: z.array(EvidenceSchema).min(1),
  explanation: z.string(),
  proposed_revision: z.string(),
  protected_constraint_ids: z.array(z.number().int().min(0)),
});

export const OpenQuestionSchema = z.strictObject({
  question: z.string(),
  artifact_ids: z.array(z.string()),
  suggested_owner: z.string(),
});

export const AnalysisSchema = z.strictObject({
  change_summary: z.string(),
  findings: z.array(FindingSchema),
  open_questions: z.array(OpenQuestionSchema),
});

export type FindingKind = z.infer<typeof FindingKindSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type OpenQuestion = z.infer<typeof OpenQuestionSchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;
