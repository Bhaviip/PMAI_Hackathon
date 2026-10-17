"use client";

import { useMemo, useState } from "react";
import type { CodeChange, ProjectFile } from "@/fixtures/codeChangeDemo";
import { analyze } from "@/lib/analyze";
import { runAiReview } from "@/lib/aiReview";
import { diffLines } from "@/lib/diff";
import { MAX_FILES, readFolder, readPullRequest } from "@/lib/sources";

// A finished analysis, plus the project's files so the page can show proof lines.
export type Analysis = { change: CodeChange; files: ProjectFile[] };

type Tab = "folder" | "github";

// Two ways in: upload a project folder and edit a file here, or paste a public pull request link.
export function NewAnalysis({ onDone }: { onDone: (a: Analysis) => void }) {
  const [tab, setTab] = useState<Tab>("folder");
  return (
    <section className="rounded-lg bg-card p-5 border border-line sm:p-6">
      <h1 className="font-serif text-[34px] font-semibold leading-tight tracking-tight">Analyze your code</h1>
      <p className="mt-1 text-sm text-muted">Files stay in your browser. Nothing is uploaded to a server.</p>
      <div className="mt-5 inline-flex rounded-lg bg-paper p-1" role="tablist">
        {(
          [
            ["folder", "Upload a folder"],
            ["github", "GitHub pull request"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              tab === id ? "bg-card text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-5">{tab === "folder" ? <FolderFlow onDone={onDone} /> : <GithubFlow onDone={onDone} />}</div>
    </section>
  );
}

// Folder tab, in three steps: read a folder (lib/sources.ts), edit one file in the
// browser, then scan that edit against the rest of the project (lib/analyze.ts).
function FolderFlow({ onDone }: { onDone: (a: Analysis) => void }) {
  const [project, setProject] = useState<{ name: string; files: ProjectFile[]; skipped: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [path, setPath] = useState("");
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState("");
  const [checking, setChecking] = useState(false);

  // The chosen file as uploaded, compared with the visitor's draft to count changed lines.
  const original = project?.files.find((f) => f.path === path)?.code ?? "";
  const changedLines = useMemo(() => diffLines(original, draft).filter((d) => d.type !== "same").length, [original, draft]);
  const shown = (project?.files ?? []).filter((f) => f.path.toLowerCase().includes(filter.toLowerCase())).slice(0, 200);

  async function pick(list: FileList | null) {
    if (!list?.length) return;
    setLoading(true);
    const p = await readFolder(list);
    setProject(p);
    setPath("");
    setDraft("");
    setLoading(false);
  }

  function choose(p: string) {
    setPath(p);
    setDraft(project?.files.find((f) => f.path === p)?.code ?? "");
  }

  async function run() {
    if (!project || !path) return;
    const scanned = analyze({
      id: `local-${Date.now()}`,
      title: title.trim() || `Edit to ${path.split("/").pop()}`,
      summary: `Your edit to ${path}, checked against ${project.files.length} files in ${project.name}.`,
      pr: { repo: project.name, author: "You" },
      files: project.files,
      edits: [{ path, before: original, after: draft }],
    });
    setChecking(true);
    const change = await runAiReview(scanned, project.files);
    setChecking(false);
    onDone({ change, files: project.files });
  }

  return (
    <div className="space-y-5">
      <Step n={1} title="Pick your project folder">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line px-4 py-7 text-center hover:border-ink hover:bg-paper">
          <span className="text-sm font-semibold text-accent">{loading ? "Reading files…" : "Choose a folder"}</span>
          <span className="text-xs text-muted">Code, tests and docs are read. node_modules, builds and lock files are skipped.</span>
          <input
            type="file"
            className="sr-only"
            multiple
            // Folder picking is a non-standard attribute supported by all major browsers.
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            onChange={(e) => pick(e.target.files)}
          />
        </label>
        {project && (
          <p className="mt-2 text-sm text-muted">
            <span className="font-semibold">{project.name}</span> · {project.files.length} files read
            {project.files.length >= MAX_FILES && ` (first ${MAX_FILES})`}
          </p>
        )}
      </Step>

      {project && (
        <Step n={2} title="Make a change">
          <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="min-w-0">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Find a file"
                className="w-full rounded-lg border border-line px-3 py-1.5 text-sm"
              />
              <ul className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-line text-sm">
                {shown.map((f) => (
                  <li key={f.path}>
                    <button
                      type="button"
                      onClick={() => choose(f.path)}
                      className={`block w-full truncate px-3 py-1.5 text-left font-mono text-xs ${
                        f.path === path ? "bg-highlight text-accent" : "hover:bg-paper"
                      }`}
                    >
                      {f.path}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="min-w-0">
              {path ? (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-mono text-muted">{path}</span>
                    <span className={changedLines ? "font-semibold text-accent" : "text-faint"}>
                      {changedLines ? `${changedLines} lines changed` : "Edit the code below"}
                    </span>
                  </div>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    spellCheck={false}
                    className="mt-1 h-72 w-full rounded-lg border border-line bg-paper p-3 font-mono text-xs leading-5"
                  />
                </>
              ) : (
                <div className="grid h-full min-h-40 place-items-center rounded-lg border border-dashed border-line text-sm text-faint">
                  Choose a file to edit
                </div>
              )}
            </div>
          </div>
        </Step>
      )}

      {project && path && (
        <Step n={3} title="See what it affects">
          <div className="flex flex-wrap gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name this change (optional)"
              className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={!changedLines || checking}
              onClick={run}
              className="rounded-lg bg-ink px-5 py-2 text-sm font-semibold text-white hover:bg-accent disabled:opacity-40"
            >
              {checking ? "Checking with AI…" : "Find affected files"}
            </button>
          </div>
        </Step>
      )}
    </div>
  );
}

// GitHub tab: fetch a public pull request (lib/sources.ts), then scan it (lib/analyze.ts).
// busy holds the current progress message while it runs.
function GithubFlow({ onDone }: { onDone: (a: Analysis) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setBusy("Starting");
    try {
      const pr = await readPullRequest(url, setBusy);
      setBusy("Scanning for affected files");
      const scanned = analyze({ id: `gh-${Date.now()}`, ...pr });
      setBusy(`Checking ${scanned.impacts.length} files with AI`);
      const change = await runAiReview(scanned, pr.files);
      onDone({ change, files: pr.files });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong reading that pull request.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <Step n={1} title="Paste a public pull request link">
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo/pull/123"
            className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 font-mono text-sm"
          />
          <button
            type="submit"
            disabled={!url.trim() || busy !== null}
            className="rounded-lg bg-ink px-5 py-2 text-sm font-semibold text-white hover:bg-accent disabled:opacity-40"
          >
            {busy ? "Working…" : "Analyze"}
          </button>
        </form>
        {busy && <p className="mt-2 text-sm text-muted">{busy}…</p>}
        {error && <p className="mt-2 text-sm font-medium text-brick">{error}</p>}
        <p className="mt-2 text-xs text-faint">
          Works with public repositories. GitHub allows about 60 requests an hour without signing in.
        </p>
      </Step>
    </div>
  );
}

// A numbered step with a title, used by both tabs.
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-highlight text-sm font-bold text-accent">{n}</span>
      <div className="min-w-0 flex-1">
        <h2 className="mb-2 mt-0.5 text-sm font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
