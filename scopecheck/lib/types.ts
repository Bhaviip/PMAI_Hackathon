// Shapes of the planning packet (fixtures/demo_packet.json) and the analysis
// result (contracts/analysis.schema.json). Runtime validation with Zod comes in
// task 2; these types only describe trusted, bundled fixtures for now.

export type Section = { id: string; text: string };

export type Artifact = {
  id: string;
  title: string;
  kind: string;
  owner: string;
  feature_id: string;
  sections: Section[];
};

export type ChangeRequest = {
  id: string;
  title: string;
  proposed_change: string;
  protected_constraints: string[];
  boundary_note: string;
};

export type Packet = {
  change_request: ChangeRequest;
  artifacts: Artifact[];
};

export type FindingKind = "update" | "question" | "preserve" | "unaffected";

export type Evidence = { section_id: string; quote: string };

export type Finding = {
  id: string;
  artifact_id: string;
  kind: FindingKind;
  evidence: Evidence[];
  explanation: string;
  proposed_revision: string;
  protected_constraint_ids: number[];
};

export type OpenQuestion = {
  question: string;
  artifact_ids: string[];
  suggested_owner: string;
};

export type AnalysisResult = {
  change_summary: string;
  findings: Finding[];
  open_questions: OpenQuestion[];
};
