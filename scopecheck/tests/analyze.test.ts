import { describe, expect, it } from "vitest";
import { analyze, blockCommentLines } from "@/lib/analyze";
import type { Edit, ProjectFile } from "@/fixtures/codeChangeDemo";

const run = (files: ProjectFile[], edits: Edit[]) =>
  analyze({ id: "t", title: "t", summary: "t", pr: { repo: "r", author: "a" }, files, edits });

describe("blockCommentLines", () => {
  it("includes doc-comment lines that have no leading star", () => {
    const set = blockCommentLines("/**\nReturns a value. Also throws if empty.\n*/\nconst x = 1;");
    expect(set.has("Returns a value. Also throws if empty.")).toBe(true);
    expect(set.has("const x = 1;")).toBe(false);
  });

  it("ignores one-line comments that close on the same line", () => {
    expect(blockCommentLines("/* short */ const y = 2;\nconst z = 3;").size).toBe(0);
  });

  it("handles Python docstrings", () => {
    expect(blockCommentLines('def f():\n    """\n    Raises if empty.\n    """\n    return 1').has("    Raises if empty.")).toBe(true);
  });
});

describe("analyze", () => {
  it("does not treat words removed from a doc comment as removed code names", () => {
    // Regression: sindresorhus/ky#877 reworded "Also, .json() throws if ..." in a doc
    // comment, and every file using the word "throws" was flagged as Breaks.
    const before = "/**\nReturns a Response. Also, json() throws if the body is empty.\n*/\nexport type ResponsePromise = Promise<Response>;";
    const after = "/**\nReturns a Response. Note that json() will fail on an empty body.\n*/\nexport type ResponsePromise = Promise<Response>;";
    const files: ProjectFile[] = [
      { path: "src/types.ts", kind: "code", code: before },
      { path: "test/a.ts", kind: "test", code: "t.throws(() => run());" },
      { path: "test/b.ts", kind: "test", code: "await t.throwsAsync(x);\nt.throws(y);" },
    ];
    const change = run(files, [{ path: "src/types.ts", before, after }]);
    expect(change.impacts.filter((i) => i.level === "breaks")).toEqual([]);
  });

  it("ignores ordinary words inside strings, such as a removed test's name", () => {
    // Regression: ky#877 removed test('... does not call parseJson'), and files using "call" were flagged.
    const before = "test('json does not call parseJson', async t => {\n  t.pass();\n});\nexport const keep = 1;";
    const after = "export const keep = 1;";
    const files: ProjectFile[] = [
      { path: "test/main.ts", kind: "test", code: before },
      { path: "src/options.ts", kind: "code", code: "fn.call(this, request);" },
      { path: "src/hooks.ts", kind: "code", code: "hook.call(null);" },
    ];
    expect(run(files, [{ path: "test/main.ts", before, after }]).impacts).toEqual([]);
  });

  it("ignores local variables inside function and test bodies", () => {
    const before = "test('a', async t => {\n  const server = await start(t);\n  t.is(1, 1);\n});";
    const after = "test('a', async t => {\n  const server = await start(t, {fast: true});\n  t.is(1, 1);\n});";
    const files: ProjectFile[] = [
      { path: "test/a.ts", kind: "test", code: before },
      { path: "test/b.ts", kind: "test", code: "const server = await start(t);" },
      { path: "test/c.ts", kind: "test", code: "server.get('/', handler);" },
    ];
    expect(run(files, [{ path: "test/a.ts", before, after }]).impacts.filter((i) => i.level !== "check")).toEqual([]);
  });

  it("doesn't treat a test file's data values as something other tests depend on", () => {
    // Regression: ky#877 and ky#867 edited test URLs and values, and other tests using the same strings were flagged.
    const before = "test('a', async t => {\n  await ky('https://example.com', {retry: 2});\n});";
    const after = "test('a', async t => {\n  await ky('https://example.com', {retry: 3});\n  t.pass();\n});";
    const files: ProjectFile[] = [
      { path: "test/a.ts", kind: "test", code: before },
      { path: "test/b.ts", kind: "test", code: "await ky('https://example.com', {retry: 1});" },
      { path: "src/ky.ts", kind: "code", code: "const retry = options.retry;" },
    ];
    expect(run(files, [{ path: "test/a.ts", before, after }]).impacts).toEqual([]);
  });

  it("still flags a caller of a renamed function", () => {
    const before = "export function canSend(m) {\n  return m.ok;\n}";
    const after = "export function mayDeliver(m) {\n  return m.ok;\n}";
    const files: ProjectFile[] = [
      { path: "src/send.ts", kind: "code", code: before },
      { path: "src/worker.ts", kind: "code", code: "import { canSend } from './send';\nif (canSend(msg)) deliver(msg);" },
      { path: "src/other.ts", kind: "code", code: "export const unrelated = 1;" },
    ];
    const change = run(files, [{ path: "src/send.ts", before, after }]);
    expect(change.impacts.map((i) => [i.path, i.level])).toEqual([["src/worker.ts", "breaks"]]);
    expect(change.impacts[0].evidence[0]).toBe("if (canSend(msg)) deliver(msg);");
  });
});
