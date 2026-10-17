import { describe, expect, it } from "vitest";
import { buildReviewRequest, checkReply, mergeReview, REPLY_JSON_SCHEMA, type ReviewReply } from "@/lib/aiReview";
import type { CodeChange, ProjectFile } from "@/fixtures/codeChangeDemo";

const files: ProjectFile[] = [
  { path: "src/send.ts", kind: "code", code: "export function canSend(m) {\n  return m.ok;\n}" },
  { path: "src/worker.ts", kind: "code", code: "import { canSend } from './send';\nif (canSend(msg)) deliver(msg);" },
  { path: "src/events.ts", kind: "code", code: "import { canSend } from './send';\nlog({ reviewer: msg.approval.reviewer });" },
  { path: "test/x.ts", kind: "test", code: "t.throws(() => go());" },
];

const change: CodeChange = {
  id: "c",
  title: "Rename canSend",
  summary: "s",
  pr: { repo: "r", author: "a" },
  edits: [{ path: "src/send.ts", before: files[0].code, after: files[0].code.replace("canSend", "mayDeliver") }],
  impacts: [
    { path: "src/worker.ts", level: "breaks", why: "uses canSend", evidence: ["if (canSend(msg)) deliver(msg);"] },
    { path: "test/x.ts", level: "breaks", why: "uses throws", evidence: ["t.throws(() => go());"] },
  ],
};

const reply = (files: ReviewReply["files"]): ReviewReply => ({ summary: "One caller breaks.", files });

describe("buildReviewRequest", () => {
  it("sends the scan's files plus importers the scan missed, with excerpts and a diff", () => {
    const req = buildReviewRequest(change, files);
    expect(req.files.map((f) => [f.path, f.scan?.level ?? null])).toEqual([
      ["src/worker.ts", "breaks"],
      ["test/x.ts", "breaks"],
      ["src/events.ts", null],
    ]);
    expect(req.edits[0].diff).toContain("+ export function mayDeliver(m) {");
    expect(req.files[0].excerpt).toContain("if (canSend(msg)) deliver(msg);");
  });
});

describe("checkReply", () => {
  const req = buildReviewRequest(change, files);

  it("keeps verdicts whose quotes are in the file", () => {
    const r = checkReply(req, reply([
      { path: "src/worker.ts", level: "breaks", why: "Calls the renamed function.", evidence: ["if (canSend(msg)) deliver(msg);"] },
      { path: "test/x.ts", level: "safe", why: "Only shares the word throws.", evidence: [] },
      { path: "src/events.ts", level: "check", why: "Imports the changed file.", evidence: ["import { canSend } from './send';"] },
    ]));
    expect(r.verdicts.map((v) => v.level)).toEqual(["breaks", "safe", "check"]);
    expect(r.withheld).toEqual([]);
  });

  it("withholds a verdict that quotes a line not in the file", () => {
    const r = checkReply(req, reply([
      { path: "src/worker.ts", level: "breaks", why: "x", evidence: ["if (mayDeliver(msg)) deliver(msg);"] },
    ]));
    expect(r.verdicts).toEqual([]);
    expect(r.withheld.find((w) => w.path === "src/worker.ts")?.reason).toMatch(/not in the file/);
  });

  it("withholds unknown files, duplicates, and unproven non-safe verdicts", () => {
    const r = checkReply(req, reply([
      { path: "src/invented.ts", level: "breaks", why: "x", evidence: ["anything"] },
      { path: "test/x.ts", level: "breaks", why: "x", evidence: [] },
      { path: "src/worker.ts", level: "breaks", why: "x", evidence: ["if (canSend(msg)) deliver(msg);"] },
      { path: "src/worker.ts", level: "safe", why: "x", evidence: [] },
    ]));
    expect(r.verdicts.map((v) => v.path)).toEqual(["src/worker.ts"]);
    const reasons = Object.fromEntries(r.withheld.map((w) => [w.path, w.reason]));
    expect(reasons["src/invented.ts"]).toMatch(/Not one of the files/);
    expect(reasons["test/x.ts"]).toMatch(/No quoted line/);
    expect(reasons["src/events.ts"]).toMatch(/no verdict/);
  });
});

describe("mergeReview", () => {
  it("replaces confirmed scan verdicts, keeps unconfirmed ones as keyword matches, and adds AI finds", () => {
    const req = buildReviewRequest(change, files);
    const result = checkReply(req, reply([
      { path: "test/x.ts", level: "safe", why: "Only shares a word.", evidence: [] },
      { path: "src/events.ts", level: "check", why: "Imports the changed file.", evidence: ["import { canSend } from './send';"] },
    ]));
    const merged = mergeReview(change, result, "test-model");
    const by = Object.fromEntries(merged.impacts.map((i) => [i.path, i]));
    expect(by["test/x.ts"]).toMatchObject({ level: "safe", source: "ai", scanLevel: "breaks" });
    expect(by["src/worker.ts"]).toMatchObject({ level: "breaks", source: "scan" });
    expect(by["src/events.ts"]).toMatchObject({ level: "check", source: "ai" });
    expect(merged.impacts.map((i) => i.level)).toEqual(["breaks", "check", "safe"]);
    expect(merged.review).toMatchObject({ status: "ai", model: "test-model" });
  });
});

describe("REPLY_JSON_SCHEMA", () => {
  it("is strict so structured output can't add fields", () => {
    expect(REPLY_JSON_SCHEMA.additionalProperties).toBe(false);
    expect(REPLY_JSON_SCHEMA.properties.files.items.additionalProperties).toBe(false);
  });
});
