/**
 * Parse a committed MCP client config into normalized server specs
 * (demand-side discovery). Mirrors ax-ray's mcpServers parser and adds the
 * newer VS Code `servers` shape.
 *
 * Privacy (§10, extended to public data): we keep env KEY NAMES only — never
 * the values — and never the raw config beyond what's needed to identify the
 * server. We are not a secret scraper.
 */

export interface McpSpec {
  name: string;
  command?: string;
  args?: string[];
  /** Sorted, de-duplicated env key names. Values are intentionally dropped. */
  envKeys: string[];
  url?: string;
  transport: "stdio" | "http" | "sse";
}

/** Map a config file path to the client/host that owns that shape. */
export function clientForPath(path: string): string {
  const p = path.toLowerCase();
  if (p.includes("claude_desktop_config")) return "claude-desktop";
  if (p.includes(".cursor/")) return "cursor";
  if (p.includes(".vscode/")) return "vscode";
  if (p.endsWith(".mcp.json") || p.includes(".claude/")) return "claude-code";
  if (p.includes(".continue/")) return "continue";
  if (p.includes("cline")) return "cline";
  if (p.includes("kilocode")) return "kilocode";
  if (p.includes(".kiro/")) return "kiro";
  if (p.endsWith("mcp_config.json") || p.includes("windsurf") || p.includes(".codeium/"))
    return "windsurf";
  return "unknown";
}

/** Tolerant JSON parse: strips // and /* *​/ comments (VS Code allows JSONC). */
function parseJsonc(text: string): unknown {
  const noComments = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  try {
    return JSON.parse(noComments);
  } catch {
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function specFromEntry(name: string, v: Record<string, unknown>): McpSpec | undefined {
  const url = typeof v["url"] === "string" ? v["url"] : undefined;
  const command = typeof v["command"] === "string" ? v["command"] : undefined;
  if (!url && !command) return undefined;

  const args = Array.isArray(v["args"])
    ? v["args"].filter((a): a is string => typeof a === "string")
    : undefined;
  const envKeys = isObj(v["env"])
    ? [...new Set(Object.keys(v["env"]))].sort()
    : [];

  const transport: McpSpec["transport"] = url
    ? v["type"] === "http" || v["transport"] === "http"
      ? "http"
      : "sse"
    : "stdio";

  const spec: McpSpec = { name, envKeys, transport };
  if (command) spec.command = command;
  if (args) spec.args = args;
  if (url) spec.url = url;
  return spec;
}

/**
 * Extract specs from raw config content. Handles the two common shapes:
 *   { "mcpServers": { name: {...} } }   (Claude*, Cursor, Continue)
 *   { "servers":    { name: {...} } }   (VS Code .vscode/mcp.json)
 */
export function parseMcpConfig(content: string): McpSpec[] {
  const root = parseJsonc(content);
  if (!isObj(root)) return [];

  const out: McpSpec[] = [];
  for (const key of ["mcpServers", "servers"]) {
    const block = root[key];
    if (!isObj(block)) continue;
    for (const [name, value] of Object.entries(block)) {
      if (!isObj(value)) continue;
      const spec = specFromEntry(name, value);
      if (spec) out.push(spec);
    }
  }
  return out;
}
