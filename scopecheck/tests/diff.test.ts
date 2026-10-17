import { describe, expect, it } from "vitest";
import { diffLines, type DiffLine } from "@/lib/diff";

const count = (d: DiffLine[], type: DiffLine["type"]) => d.filter((l) => l.type === type).length;
const rebuild = (d: DiffLine[], side: "before" | "after") =>
  d.filter((l) => l.type === "same" || l.type === (side === "before" ? "del" : "add")).map((l) => l.text).join("\n");

describe("diffLines", () => {
  it("marks a one-line change as one deletion and one addition", () => {
    const d = diffLines("a\nb\nc", "a\nB\nc");
    expect(count(d, "del")).toBe(1);
    expect(count(d, "add")).toBe(1);
    expect(count(d, "same")).toBe(2);
  });

  it("keeps a small edit small in a large file", () => {
    // Regression: sindresorhus/ky#877 changed ~40 lines of a 2,341-line test file,
    // and the old diff showed the whole file as deleted and re-added.
    const before = Array.from({ length: 2400 }, (_, i) => `line ${i}`);
    const after = [...before];
    after.splice(1200, 40);
    after.splice(300, 0, "added one", "added two");
    after[2000] = "changed";
    const d = diffLines(before.join("\n"), after.join("\n"));
    expect(count(d, "del")).toBe(41);
    expect(count(d, "add")).toBe(3);
  });

  it("reconstructs both versions exactly", () => {
    const before = "x\ny\nz\nshared\nold tail";
    const after = "y\nnew\nz\nshared\nnew tail\nmore";
    const d = diffLines(before, after);
    expect(rebuild(d, "before")).toBe(before);
    expect(rebuild(d, "after")).toBe(after);
  });

  it("handles added and removed files", () => {
    expect(count(diffLines("", "a\nb"), "add")).toBe(2);
    expect(count(diffLines("a\nb", ""), "del")).toBe(2);
  });
});
