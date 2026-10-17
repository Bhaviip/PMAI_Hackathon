// Loads a project's text files from an uploaded folder or a public GitHub pull
// request. Everything runs in the browser; nothing is sent to a ScopeCheck server.

import type { Edit, ProjectFile, PullRequest } from "@/fixtures/codeChangeDemo";
import { kindOf } from "./analyze";

export const MAX_FILES = 400;
const MAX_BYTES = 200_000;
const TEXT_EXT =
  /\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|rs|java|kt|swift|c|h|cc|cpp|hpp|cs|php|scala|vue|svelte|css|scss|html|json|ya?ml|toml|md|mdx|txt|rst|sql|sh|graphql|proto)$/i;
const SKIP_DIR = /(^|\/)(node_modules|\.git|\.next|dist|build|out|coverage|vendor|__pycache__|\.venv|venv|target)\//;
const SKIP_FILE = /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.min\.(js|css))$/;

export const isProjectText = (path: string, size = 0) =>
  TEXT_EXT.test(path) && !SKIP_DIR.test(path) && !SKIP_FILE.test(path) && size <= MAX_BYTES;

// Files picked with a folder input carry webkitRelativePath ("my-app/src/a.ts"); drop the top folder.
export async function readFolder(list: FileList): Promise<{ name: string; files: ProjectFile[]; skipped: number }> {
  const all = [...list];
  const rel = (f: File) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
  const name = rel(all[0] ?? new File([], "project")).split("/")[0] || "project";
  const strip = (p: string) => (p.includes("/") ? p.slice(p.indexOf("/") + 1) : p);
  const wanted = all.filter((f) => isProjectText(strip(rel(f)), f.size));
  const picked = wanted.slice(0, MAX_FILES);
  const files = await Promise.all(
    picked.map(async (f) => {
      const path = strip(rel(f));
      return { path, kind: kindOf(path), code: await f.text() };
    }),
  );
  return { name, files, skipped: all.length - picked.length };
}

const GH = "https://api.github.com";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (res.status === 403 || res.status === 429) throw new Error("GitHub rate limit reached. Wait a few minutes or upload the folder instead.");
  if (res.status === 404) throw new Error("Pull request not found. Only public repositories work without signing in.");
  if (!res.ok) throw new Error(`GitHub returned ${res.status}.`);
  return res.json() as Promise<T>;
}

async function getText(url: string): Promise<string | null> {
  const res = await fetch(url);
  return res.ok ? res.text() : null;
}

export function parsePrUrl(url: string) {
  const m = url.trim().match(/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/);
  return m ? { owner: m[1], repo: m[2], number: Number(m[3]) } : null;
}

type PrInfo = {
  title: string;
  body: string | null;
  user: { login: string };
  head: { ref: string; sha: string; repo: { full_name: string } | null };
  base: { ref: string; sha: string; repo: { full_name: string } };
};
type PrFile = { filename: string; status: string; previous_filename?: string };
type Tree = { tree: { path: string; type: string; size?: number }[]; truncated: boolean };

// Reads a public pull request: the changed files before and after, plus the rest
// of the repository at the base commit so the scan can find what connects to them.
export async function readPullRequest(
  url: string,
  onProgress: (msg: string) => void,
): Promise<{ title: string; summary: string; pr: PullRequest; files: ProjectFile[]; edits: Edit[] }> {
  const ref = parsePrUrl(url);
  if (!ref) throw new Error("That doesn't look like a pull request link. It should end in /pull/123.");
  const api = `${GH}/repos/${ref.owner}/${ref.repo}`;

  onProgress("Reading the pull request");
  const info = await getJson<PrInfo>(`${api}/pulls/${ref.number}`);
  const changed = await getJson<PrFile[]>(`${api}/pulls/${ref.number}/files?per_page=100`);

  onProgress("Listing the repository");
  const tree = await getJson<Tree>(`${api}/git/trees/${info.base.sha}?recursive=1`);
  const blobs = tree.tree.filter((t) => t.type === "blob" && isProjectText(t.path, t.size ?? 0));
  const changedPaths = new Set(changed.map((c) => c.previous_filename ?? c.filename));
  // Read the changed files first, then as many others as the cap allows.
  const order = [...blobs.filter((b) => changedPaths.has(b.path)), ...blobs.filter((b) => !changedPaths.has(b.path))];
  const toRead = order.slice(0, Math.min(MAX_FILES, 250));

  const raw = (repo: string, sha: string, path: string) =>
    `https://raw.githubusercontent.com/${repo}/${sha}/${path.split("/").map(encodeURIComponent).join("/")}`;

  const files: ProjectFile[] = [];
  for (let i = 0; i < toRead.length; i += 20) {
    onProgress(`Reading files ${i + 1}–${Math.min(i + 20, toRead.length)} of ${toRead.length}`);
    const batch = await Promise.all(
      toRead.slice(i, i + 20).map(async (b) => {
        const code = await getText(raw(info.base.repo.full_name, info.base.sha, b.path));
        return code === null ? null : { path: b.path, kind: kindOf(b.path), code };
      }),
    );
    files.push(...batch.filter((f): f is ProjectFile => f !== null));
  }

  onProgress("Reading the changed files");
  const byPath = new Map(files.map((f) => [f.path, f.code]));
  const headRepo = info.head.repo?.full_name ?? info.base.repo.full_name;
  const edits: Edit[] = [];
  for (const c of changed.filter((c) => isProjectText(c.filename))) {
    const beforePath = c.previous_filename ?? c.filename;
    const before = c.status === "added" ? "" : (byPath.get(beforePath) ?? (await getText(raw(info.base.repo.full_name, info.base.sha, beforePath))) ?? "");
    const after = c.status === "removed" ? "" : ((await getText(raw(headRepo, info.head.sha, c.filename))) ?? "");
    edits.push({ path: c.filename, before, after });
  }
  if (!edits.length) throw new Error("This pull request doesn't change any text files ScopeCheck can read.");

  const firstLine = (info.body ?? "").split("\n").find((l) => l.trim() && !l.startsWith("<!--"))?.trim();
  return {
    title: info.title,
    summary: firstLine && firstLine.length < 240 ? firstLine : `${edits.length} file${edits.length === 1 ? "" : "s"} changed in ${ref.owner}/${ref.repo}.`,
    pr: { repo: `${ref.owner}/${ref.repo}`, number: ref.number, author: info.user.login, branch: info.head.ref, base: info.base.ref },
    files,
    edits,
  };
}
