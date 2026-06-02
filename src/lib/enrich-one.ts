/**
 * Enrich a single server discovered via an ax-ray submission (§5 edge case):
 * when ingest sees a server we didn't have, it creates a thin stub, then this
 * runs ASYNCHRONOUSLY (via `after()`, off the ingest response path) to backfill
 * real static facts from the public source. Servers with no public source
 * (pure `cmd:` / `remote:`) have nothing to pull — they stay as ax-ray-only
 * pages, which is signal we could get no other way.
 *
 * Best-effort: any failure is swallowed; the stub remains and the daily enrich
 * job can try again later.
 */

import { parseKind, repoId } from "@/lib/identity";
import { fetchNpmFacts } from "@/lib/sources/npm";
import { fetchPypiFacts } from "@/lib/sources/pypi";
import { fetchGitHubFacts, ownerRepoFromRepoId } from "@/lib/sources/github";
import { upsertFromNpm, upsertFromPypi, upsertRepoServer } from "@/lib/catalog";

export async function enrichServerById(id: string): Promise<void> {
  try {
    const kind = parseKind(id);
    if (kind === "npm") {
      const npm = await fetchNpmFacts(id.slice("npm:".length));
      if (!npm) return;
      let gh;
      if (npm.repositoryUrl) {
        const r = repoId(npm.repositoryUrl, npm.repositoryDir);
        const or = r ? ownerRepoFromRepoId(r.id) : undefined;
        if (or) gh = await fetchGitHubFacts(or.owner, or.repo);
      }
      await upsertFromNpm(npm, gh);
    } else if (kind === "pypi") {
      const py = await fetchPypiFacts(id.slice("pypi:".length));
      if (!py) return;
      let gh;
      if (py.repositoryUrl) {
        const r = repoId(py.repositoryUrl);
        const or = r ? ownerRepoFromRepoId(r.id) : undefined;
        if (or) gh = await fetchGitHubFacts(or.owner, or.repo);
      }
      await upsertFromPypi(py, gh);
    } else if (kind === "repo") {
      const or = ownerRepoFromRepoId(id);
      if (!or) return;
      const gh = await fetchGitHubFacts(or.owner, or.repo);
      if (!gh) return;
      await upsertRepoServer(
        { id, kind: "repo" },
        {
          displayName: `${or.owner}/${or.repo}`,
          description: gh.description,
          homepage: gh.homepage,
          repoUrl: `https://github.com/${or.owner}/${or.repo}`,
          stars: gh.stars,
        },
      );
    }
    // oci / remote / cmd: no public source to enrich — leave the ax-ray stub as-is.
  } catch {
    /* best-effort; the daily enrich job will retry */
  }
}
