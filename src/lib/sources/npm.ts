/**
 * npm static source (REGISTRY-DESIGN.md §2 static-seeded band).
 *
 * Ported from ax-ray's enrichment: packument + weekly downloads, best-effort.
 * Adds per-version publish times so the catalog can show version history and
 * pinning. Public data only — re-verifiable by anyone.
 */

const REGISTRY = "https://registry.npmjs.org";
const DOWNLOADS = "https://api.npmjs.org/downloads/point/last-week";

interface RawPackument {
  name?: string;
  description?: string;
  versions?: Record<string, unknown>;
  time?: Record<string, string>;
  "dist-tags"?: { latest?: string };
  repository?: { url?: string; directory?: string } | string;
  homepage?: string;
  license?: string;
}

export interface NpmFacts {
  name: string;
  description?: string;
  latest?: string;
  license?: string;
  homepage?: string;
  /** Raw repository url + optional monorepo subdirectory. */
  repositoryUrl?: string;
  repositoryDir?: string;
  weeklyDownloads?: number;
  versions: { version: string; publishedAt?: string }[];
}

export async function fetchNpmFacts(
  pkg: string,
  signal?: AbortSignal,
): Promise<NpmFacts | undefined> {
  const [packument, weekly] = await Promise.all([
    fetchJson<RawPackument>(`${REGISTRY}/${pkg}`, signal),
    fetchWeeklyDownloads(pkg, signal),
  ]);
  if (!packument && weekly === undefined) return undefined;

  const repo =
    typeof packument?.repository === "string"
      ? packument.repository
      : packument?.repository?.url;
  const repositoryDir =
    typeof packument?.repository === "object"
      ? packument.repository?.directory
      : undefined;

  const time = packument?.time ?? {};
  const versions = packument?.versions
    ? Object.keys(packument.versions).map((version) => ({
        version,
        publishedAt: time[version],
      }))
    : [];

  const facts: NpmFacts = {
    name: packument?.name ?? pkg,
    versions,
  };
  if (packument?.description) facts.description = packument.description;
  if (packument?.["dist-tags"]?.latest) facts.latest = packument["dist-tags"].latest;
  if (packument?.license) facts.license = packument.license;
  if (packument?.homepage) facts.homepage = packument.homepage;
  if (repo) facts.repositoryUrl = repo;
  if (repositoryDir) facts.repositoryDir = repositoryDir;
  if (weekly !== undefined) facts.weeklyDownloads = weekly;
  return facts;
}

/**
 * Discover candidate MCP server packages from npm search. Best-effort seed
 * input; the seed script resolves identity and dedups.
 */
export async function searchNpmServers(
  query: string,
  size = 100,
  signal?: AbortSignal,
): Promise<string[]> {
  const url = `${REGISTRY}/-/v1/search?text=${encodeURIComponent(query)}&size=${size}`;
  const body = await fetchJson<{ objects?: { package?: { name?: string } }[] }>(
    url,
    signal,
  );
  return (body?.objects ?? [])
    .map((o) => o.package?.name)
    .filter((n): n is string => typeof n === "string");
}

async function fetchWeeklyDownloads(
  pkg: string,
  signal?: AbortSignal,
): Promise<number | undefined> {
  const body = await fetchJson<{ downloads?: number }>(`${DOWNLOADS}/${pkg}`, signal);
  return typeof body?.downloads === "number" ? body.downloads : undefined;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T | undefined> {
  try {
    const init: RequestInit = { headers: { Accept: "application/json" } };
    if (signal) init.signal = signal;
    const r = await fetch(url, init);
    if (!r.ok) return undefined;
    return (await r.json()) as T;
  } catch {
    return undefined;
  }
}
