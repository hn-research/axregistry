"use client";

import { useActionState } from "react";
import { scanConfigAction, type ScanState } from "./actions";
import { ScanReportView } from "@/components/ScanReportView";

export function ScanForm() {
  const [state, action, pending] = useActionState<ScanState, FormData>(scanConfigAction, {});

  return (
    <div>
      <form action={action}>
        <label htmlFor="config" className="block text-sm font-medium">
          …or paste a config
        </label>
        <p className="mb-1.5 text-xs text-zinc-500">
          Your <code>.mcp.json</code>, <code>claude_desktop_config.json</code>,{" "}
          <code>.cursor/mcp.json</code>, etc. It is parsed in-request for server identity
          only — nothing is stored, and env values are never read.
        </p>
        <textarea
          id="config"
          name="config"
          rows={8}
          placeholder={'{\n  "mcpServers": {\n    "filesystem": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "."] }\n  }\n}'}
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "Scanning…" : "Scan config"}
        </button>
      </form>

      {state.error && <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">{state.error}</p>}
      {state.report && <ScanReportView report={state.report} />}
    </div>
  );
}
