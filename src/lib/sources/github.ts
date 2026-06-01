/**
 * GitHub static source (REGISTRY-DESIGN.md §2 static-seeded band).
 *
 * Public repo metadata only: stars and whether a SECURITY.md is present.
 * Unauthenticated calls are rate-limited (60/hr); set GITHUB_TOKEN in the
 * environment to raise the limit for bulk seeds. Best-effort — any failure
 * yields undefined and the static band simply omits the GitHub signals.
 */

const API = "https://api.github.com";

export interface GitHubFacts {
  stars?: number;
  hasSecurityMd?: boolean;
  description?: string;
  homepage?: string;
}

/** Extract owner/name from a `repo:host/owner/name[#subpath]` canonical id. */
export function ownerRepoFromRepoId(repoId: string): { owner: string; repo: string } | undefined {
  const m = repoId.match(/^repo:[^/]+\/([^/]+)\/([^/#]+)/);
  if (!m) return undefined;
  return { owner: m[1], repo: m[2] };
}

export async function fetchGitHubFacts(
  owner: string,
  repo: string,
  signal?: AbortSignal,
): Promise<GitHubFacts | undefined> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const repoData = await fetchJson<{
    stargazers_count?: number;
    description?: string;
    homepage?: string;
  }>(`${API}/repos/${owner}/${repo}`, headers, signal);
  if (!repoData) return undefined;

  const hasSecurityMd = await securityFileExists(owner, repo, headers, signal);

  const facts: GitHubFacts = { hasSecurityMd };
  if (typeof repoData.stargazers_count === "number") facts.stars = repoData.stargazers_count;
  if (repoData.description) facts.description = repoData.description;
  if (repoData.homepage) facts.homepage = repoData.homepage;
  return facts;
}

async function securityFileExists(
  owner: string,
  repo: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<boolean> {
  // GitHub serves SECURITY.md from repo root, /docs, or /.github.
  for (const path of ["SECURITY.md", ".github/SECURITY.md", "docs/SECURITY.md"]) {
    const r = await rawOk(`${API}/repos/${owner}/${repo}/contents/${path}`, headers, signal);
    if (r) return true;
  }
  return false;
}

async function rawOk(
  url: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const init: RequestInit = { headers };
    if (signal) init.signal = signal;
    const r = await fetch(url, init);
    return r.ok;
  } catch {
    return false;
  }
}

async function fetchJson<T>(
  url: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<T | undefined> {
  try {
    const init: RequestInit = { headers };
    if (signal) init.signal = signal;
    const r = await fetch(url, init);
    if (!r.ok) return undefined;
    return (await r.json()) as T;
  } catch {
    return undefined;
  }
}
