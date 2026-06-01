/**
 * Map a parsed MCP client config entry to a canonical catalog id (§11.1).
 *
 * This is where the non-npm identity kinds light up: consumer configs launch
 * servers via npx, uvx, docker, python -m, or a remote url — not just npm.
 *   npx <pkg> / npm exec        → npm:<pkg>
 *   uvx <pkg> / uv tool run     → pypi:<pkg>
 *   pipx run <pkg>              → pypi:<pkg>
 *   python -m <module>          → pypi:<module>   (best-effort)
 *   docker|podman run <image>   → oci:<image>
 *   url (http/sse)              → remote:<origin>
 *   anything else               → cmd:sha256(…)   (privacy-safe last resort)
 */

import {
  cmdId,
  npmId,
  ociId,
  pypiId,
  remoteId,
  type CanonicalId,
} from "./identity";
import type { McpSpec } from "./mcp-config";

const basename = (s: string): string => s.replace(/^.*[/\\]/, "");

/** Strip a trailing @version (preserving scoped @scope/name). */
function stripVersion(pkg: string): string {
  if (pkg.startsWith("@")) {
    const at = pkg.indexOf("@", 1);
    return at > 0 ? pkg.slice(0, at) : pkg;
  }
  const at = pkg.indexOf("@");
  return at > 0 ? pkg.slice(0, at) : pkg;
}

/** First arg that isn't an option flag, starting at index `from`. */
function firstPositional(args: string[], from = 0): string | undefined {
  for (let i = from; i < args.length; i++) {
    const tok = args[i];
    if (tok === "--") return args[i + 1];
    if (!tok.startsWith("-")) return tok;
  }
  return undefined;
}

// docker/podman flags that consume the following token.
const VALUED_FLAGS = new Set([
  "-e", "--env", "-v", "--volume", "-p", "--publish", "--name", "-w",
  "--workdir", "--network", "--mount", "--label", "-l", "--user", "-u",
]);

function dockerImage(args: string[]): string | undefined {
  const runIdx = args.indexOf("run");
  let i = runIdx >= 0 ? runIdx + 1 : 0;
  while (i < args.length) {
    const tok = args[i];
    if (VALUED_FLAGS.has(tok)) {
      i += 2;
      continue;
    }
    if (tok.startsWith("-")) {
      i += 1;
      continue;
    }
    return tok; // first positional after run = image
  }
  return undefined;
}

export function specToCanonicalId(spec: McpSpec): CanonicalId {
  // Remote transport → remote origin.
  if (spec.url) {
    return remoteId(spec.url) ?? fallbackCmd(spec);
  }

  const cmd = spec.command ? basename(spec.command) : "";
  const args = spec.args ?? [];

  if (cmd === "npx" || cmd === "npm") {
    const from = cmd === "npm" && args[0] === "exec" ? 1 : 0;
    const pkg = firstPositional(args, from);
    if (pkg) return npmId(stripVersion(pkg));
  }

  if (cmd === "uvx") {
    const pkg = firstPositional(args);
    if (pkg) return pypiId(stripVersion(pkg));
  }

  if (cmd === "uv" && args[0] === "tool" && args[1] === "run") {
    const pkg = firstPositional(args, 2);
    if (pkg) return pypiId(stripVersion(pkg));
  }

  if (cmd === "pipx" && args[0] === "run") {
    const pkg = firstPositional(args, 1);
    if (pkg) return pypiId(stripVersion(pkg));
  }

  if (cmd === "python" || cmd === "python3") {
    const mIdx = args.indexOf("-m");
    if (mIdx >= 0 && args[mIdx + 1]) {
      // top-level module → best-effort dist name
      return pypiId(args[mIdx + 1].split(".")[0]);
    }
  }

  if (cmd === "docker" || cmd === "podman") {
    const image = dockerImage(args);
    if (image) return ociId(image);
  }

  return fallbackCmd(spec);
}

function fallbackCmd(spec: McpSpec): CanonicalId {
  return cmdId(spec.command ?? spec.url ?? spec.name, spec.args ?? [], spec.envKeys);
}
