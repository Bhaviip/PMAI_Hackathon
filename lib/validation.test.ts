import { describe, expect, it } from "vitest";
import demoPacket from "../scopecheck/fixtures/demo_packet.json";
import illustrative from "../scopecheck/fixtures/illustrative_review_NOT_MODEL_OUTPUT.json";
import {
  AnalyzeRequestSchema,
  MAX_INPUT_CHARS,
  type Analysis,
  type AnalyzeRequest,
} from "./schema";
import { validateAnalysis } from "./validateEvidence";

const request: AnalyzeRequest = AnalyzeRequestSchema.parse(demoPacket);

// The illustrative review is hand-authored, not model output. It is used here
// only as a well-formed response shape; its label fields are stripped.
function goodResponse(): Analysis {
  const { illustrative_only: _i, note: _n, ...rest } = structuredClone(illustrative);
  return rest as Analysis;
}

function cloneRequest(): AnalyzeRequest {
  return structuredClone(request);
}

describe("request validation", () => {
  it("accepts the demo packet", () => {
    expect(AnalyzeRequestSchema.safeParse(demoPacket).success).toBe(true);
  });

  it("rejects more than 8 artifacts", () => {
    const req = cloneRequest();
    req.artifacts.push({ ...req.artifacts[0], id: "EXTRA-01" });
    expect(req.artifacts).toHaveLength(9);
    expect(AnalyzeRequestSchema.safeParse(req).success).toBe(false);
  });

  it("rejects input over 30000 characters", () => {
    const req = cloneRequest();
    req.artifacts[0].sections[0].text = "x".repeat(MAX_INPUT_CHARS);
    const r = AnalyzeRequestSchema.safeParse(req);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/limit is 30000/);
  });

  it("counts change request and constraints toward the limit", () => {
    const req = cloneRequest();
    req.change_request.protected_constraints.push("y".repeat(MAX_INPUT_CHARS));
    expect(AnalyzeRequestSchema.safeParse(req).success).toBe(false);
  });

  it("rejects duplicate artifact ids", () => {
    const req = cloneRequest();
    req.artifacts[1].id = req.artifacts[0].id;
    expect(AnalyzeRequestSchema.safeParse(req).success).toBe(false);
  });

  it("rejects duplicate section ids within an artifact", () => {
    const req = cloneRequest();
    req.artifacts[0].sections[1].id = req.artifacts[0].sections[0].id;
    expect(AnalyzeRequestSchema.safeParse(req).success).toBe(false);
  });
});

describe("analysis validation", () => {
  it("accepts a well-formed response with all eight artifacts classified", () => {
    const r = validateAnalysis(goodResponse(), request);
    expect(r.errors).toEqual([]);
    expect(r.withheld).toEqual([]);
    expect(r.valid).toHaveLength(8);
    expect(r.open_questions).toHaveLength(2);
  });

  it("accepts the response as a raw JSON string", () => {
    const r = validateAnalysis(JSON.stringify(goodResponse()), request);
    expect(r.valid).toHaveLength(8);
  });

  it("reports malformed JSON without findings", () => {
    const r = validateAnalysis("{not json", request);
    expect(r.parsed).toBe(false);
    expect(r.valid).toEqual([]);
    expect(r.errors[0]).toMatch(/not valid JSON/);
  });

  it("rejects a response that breaks the schema", () => {
    const bad = goodResponse() as unknown as { findings: { kind: string }[] };
    bad.findings[0].kind = "fixed";
    const r = validateAnalysis(bad, request);
    expect(r.parsed).toBe(false);
    expect(r.valid).toEqual([]);
  });

  it("rejects model-emitted approval fields", () => {
    const bad = goodResponse() as unknown as { findings: Record<string, unknown>[] };
    bad.findings[0].status = "accepted";
    expect(validateAnalysis(bad, request).parsed).toBe(false);
  });

  it("withholds a finding with an unknown artifact id", () => {
    const res = goodResponse();
    res.findings[2].artifact_id = "BE-99";
    const r = validateAnalysis(res, request);
    expect(r.withheld.map((w) => w.finding.id)).toEqual(["F-03"]);
    expect(r.withheld[0].reasons.join()).toMatch(/Unknown artifact_id BE-99/);
    expect(r.missing_artifact_ids).toEqual(["BE-18"]);
  });

  it("withholds a finding whose quote is not in the cited section", () => {
    const res = goodResponse();
    res.findings[2].evidence[0].quote = "The outbound worker sends every message automatically.";
    const r = validateAnalysis(res, request);
    expect(r.withheld[0].finding.id).toBe("F-03");
    expect(r.withheld[0].reasons.join()).toMatch(/not found verbatim/);
  });

  it("withholds a finding that cites a section from another artifact", () => {
    const res = goodResponse();
    res.findings[2].evidence[0].section_id = "P1";
    const r = validateAnalysis(res, request);
    expect(r.withheld[0].reasons.join()).toMatch(/Unknown section_id P1 in BE-18/);
  });

  it("reports an artifact with no classification", () => {
    const res = goodResponse();
    res.findings = res.findings.filter((f) => f.artifact_id !== "BILL-07");
    const r = validateAnalysis(res, request);
    expect(r.missing_artifact_ids).toEqual(["BILL-07"]);
    expect(r.errors).toContain("No valid classification for artifact BILL-07");
  });

  it("withholds a second finding for the same artifact", () => {
    const res = goodResponse();
    res.findings.push({ ...res.findings[7], id: "F-09" });
    const r = validateAnalysis(res, request);
    expect(r.withheld.map((w) => w.finding.id)).toEqual(["F-09"]);
  });

  it("withholds duplicate finding ids", () => {
    const res = goodResponse();
    res.findings[1].id = "F-01";
    const r = validateAnalysis(res, request);
    expect(r.withheld.map((w) => w.finding.artifact_id)).toEqual(["FE-12"]);
  });

  it("requires a revision on update findings only", () => {
    const res = goodResponse();
    res.findings[0].proposed_revision = "";
    res.findings[5].proposed_revision = "Let the assistant send refunds.";
    const r = validateAnalysis(res, request);
    expect(r.withheld.map((w) => w.finding.id)).toEqual(["F-01", "F-06"]);
  });

  it("withholds unknown protected constraint ids", () => {
    const res = goodResponse();
    res.findings[0].protected_constraint_ids = [0, 9];
    const r = validateAnalysis(res, request);
    expect(r.withheld[0].reasons.join()).toMatch(/protected_constraint_id 9/);
  });

  it("withholds open questions with invented owners or unknown artifacts", () => {
    const res = goodResponse();
    res.open_questions[0].suggested_owner = "Priya from Legal";
    res.open_questions[1].artifact_ids = ["XYZ-1"];
    res.open_questions.push({ question: "Who decides?", artifact_ids: [], suggested_owner: "Unassigned" });
    const r = validateAnalysis(res, request);
    expect(r.withheld_questions).toHaveLength(2);
    expect(r.open_questions.map((q) => q.question)).toEqual(["Who decides?"]);
  });
});
