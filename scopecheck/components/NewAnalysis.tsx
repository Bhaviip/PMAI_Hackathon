"use client";

import { useMemo, useState } from "react";
import type { CodeChange, ProjectFile } from "@/fixtures/codeChangeDemo";
import { analyze } from "@/lib/analyze";
import { diffLines } from "@/lib/diff";
import { MAX_FILES, readFolder, readPullRequest } from "@/lib/sources";

export type Analysis = { change: CodeChange; files: ProjectFile[] };

type Tab = "folder" | "github";

// Two ways in: upload a project folder and edit a file here, or paste a public pull request link.
export function NewAnalysis({ onDone }: { onDone: (a: Analysis) => void }) {
  const [tab, setTab] = useState<Tab>("folder");
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Analyze your code</h1>
      <p className="mt-1 text-sm text-slate-500">Files stay in your browser. Nothing is uploaded to a server.</p>
      <div className="mt-5 inline-flex rounded-xl bg-slate-100 p-1" role="tablist">
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
              tab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
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

function FolderFlow({ onDone }: { onDone: (a: Analysis) => void }) {
  const [project, setProject] = useState<{ name: string; files: ProjectFile[]; skipped: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [path, setPath] = useState("");
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState("");

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

  function run() {
    if (!project || !path) return;
    const change = analyze({
      id: `local-${Date.now()}`,
      title: title.trim() || `Edit to ${path.split("/").pop()}`,
      summary: `Your edit to ${path}, checked against ${project.files.length} files in ${project.name}.`,
      pr: { repo: project.name, author: "You" },
      files: project.files,
      edits: [{ path, before: original, after: draft }],
    });
    onDone({ change, files: project.files });
  }

  return (
    <div className="space-y-5">
      <Step n={1} title="Pick your project folder">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 px-4 py-7 text-center hover:border-indigo-400 hover:bg-indigo-50/40">
          <span className="text-sm font-semibold text-indigo-600">{loading ? "Reading files…" : "Choose a folder"}</span>
          <span className="text-xs text-slate-500">Code, tests and docs are read. node_modules, builds and lock files are skipped.</span>
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
          <p className="mt-2 text-sm text-slate-600">
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
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
              <ul className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-slate-200 text-sm">
                {shown.map((f) => (
                  <li key={f.path}>
                    <button
                      type="button"
                      onClick={() => choose(f.path)}
                      className={`block w-full truncate px-3 py-1.5 text-left font-mono text-xs ${
                        f.path === path ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50"
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
                    <span className="truncate font-mono text-slate-600">{path}</span>
                    <span className={changedLines ? "font-semibold text-indigo-600" : "text-slate-400"}>
                      {changedLines ? `${changedLines} lines changed` : "Edit the code below"}
                    </span>
                  </div>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    spellCheck={false}
                    className="mt-1 h-72 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs leading-5"
                  />
                </>
              ) : (
                <div className="grid h-full min-h-40 place-items-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-400">
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
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={!changedLines}
              onClick={run}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              Find affected files
            </button>
          </div>
        </Step>
      )}
    </div>
  );
}

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
      const change = analyze({ id: `gh-${Date.now()}`, ...pr });
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
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
          />
          <button
            type="submit"
            disabled={!url.trim() || busy !== null}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            {busy ? "Working…" : "Analyze"}
          </button>
        </form>
        {busy && <p className="mt-2 text-sm text-slate-500">{busy}…</p>}
        {error && <p className="mt-2 text-sm font-medium text-rose-700">{error}</p>}
        <p className="mt-2 text-xs text-slate-400">
          Works with public repositories. GitHub allows about 60 requests an hour without signing in.
        </p>
      </Step>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-600">{n}</span>
      <div className="min-w-0 flex-1">
        <h2 className="mb-2 mt-0.5 text-sm font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
