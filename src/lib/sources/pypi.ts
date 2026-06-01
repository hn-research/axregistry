/**
 * PyPI static source. Discovers Python MCP servers from PyPI search and pulls
 * per-package facts from the JSON API, plus recent download counts from
 * pypistats. Best-effort: any failure yields empty/undefined and the seed moves
 * on. Public data only.
 */

const SEARCH = "https://pypi.org/search/";
const JSON_API = "https://pypi.org/pypi";
const STATS = "https://pypistats.org/api/packages";
const UA = "ax-registry-seed/0.1 (+https://axregistry.com)";

export interface PypiFacts {
  name: string;
  summary?: string;
  version?: string;
  license?: string;
  homepage?: string;
  repositoryUrl?: string;
  weeklyDownloads?: number;
}

/** Package names from one page of PyPI search (HTML — no JSON search exists). */
export async function searchPypiServers(
  query: string,
  page = 1,
  signal?: AbortSignal,
): Promise<string[]> {
  try {
    const url = `${SEARCH}?q=${encodeURIComponent(query)}&page=${page}`;
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      ...(signal ? { signal } : {}),
    });
    if (!r.ok) return [];
    const html = await r.text();
    const names: string[] = [];
    const re = /package-snippet__name">([^<]+)</g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) names.push(m[1].trim());
    return names;
  } catch {
    return [];
  }
}

interface PypiJson {
  info?: {
    name?: string;
    summary?: string | null;
    version?: string | null;
    license?: string | null;
    home_page?: string | null;
    project_urls?: Record<string, string> | null;
    classifiers?: string[] | null;
  };
}

function pickRepoUrl(urls: Record<string, string> | null | undefined, home?: string | null): string | undefined {
  const candidates = [...Object.values(urls ?? {}), home ?? ""];
  for (const u of candidates) {
    if (/github\.com|gitlab\.com|bitbucket\.org/i.test(u)) return u;
  }
  return undefined;
}

function licenseFrom(license?: string | null, classifiers?: string[] | null): string | undefined {
  const cls = (classifiers ?? []).find((c) => c.startsWith("License :: "));
  if (cls) {
    const tail = cls.split("::").pop()?.trim();
    if (tail && tail !== "OSI Approved") return tail.replace(/ License$/, "");
  }
  if (license && license.length > 0 && license.length <= 40 && !/\n/.test(license)) return license;
  return undefined;
}

export async function fetchPypiFacts(
  name: string,
  signal?: AbortSignal,
): Promise<PypiFacts | undefined> {
  try {
    const r = await fetch(`${JSON_API}/${encodeURIComponent(name)}/json`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      ...(signal ? { signal } : {}),
    });
    if (!r.ok) return undefined;
    const body = (await r.json()) as PypiJson;
    const info = body.info;
    if (!info?.name) return undefined;
    return {
      name: info.name,
      summary: info.summary ?? undefined,
      version: info.version ?? undefined,
      license: licenseFrom(info.license, info.classifiers),
      homepage: info.home_page ?? undefined,
      repositoryUrl: pickRepoUrl(info.project_urls, info.home_page),
      weeklyDownloads: await fetchPypiWeeklyDownloads(name, signal),
    };
  } catch {
    return undefined;
  }
}

/** Recent weekly downloads via pypistats (best-effort). */
async function fetchPypiWeeklyDownloads(
  name: string,
  signal?: AbortSignal,
): Promise<number | undefined> {
  try {
    const r = await fetch(`${STATS}/${encodeURIComponent(name.toLowerCase())}/recent`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      ...(signal ? { signal } : {}),
    });
    if (!r.ok) return undefined;
    const body = (await r.json()) as { data?: { last_week?: number } };
    return typeof body.data?.last_week === "number" ? body.data.last_week : undefined;
  } catch {
    return undefined;
  }
}
