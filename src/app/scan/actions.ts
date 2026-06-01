"use server";

import { scanPastedConfig, type ScanReport } from "@/lib/scan";

export interface ScanState {
  report?: ScanReport;
  error?: string;
}

/** Server action for the pasted-config path (input is never stored). */
export async function scanConfigAction(
  _prev: ScanState | null,
  formData: FormData,
): Promise<ScanState> {
  const config = String(formData.get("config") ?? "").trim();
  if (!config) return { error: "Paste an MCP config to scan." };
  if (config.length > 200_000) return { error: "That config is too large to scan." };
  try {
    const report = await scanPastedConfig(config);
    return { report };
  } catch {
    return { error: "Could not parse that config. Expected JSON with an mcpServers/servers key." };
  }
}
