"use client";

/**
 * Save the current scan report to the signed-in user's account. The report is
 * already computed server-side and handed in as a prop; saving persists that
 * snapshot and lands on the dashboard. Signed-out visitors get a sign-in link
 * that returns them here.
 */

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { saveScan } from "@/lib/account-actions";
import type { ScanReport } from "@/lib/scan";

export function SaveScanButton({
  report,
  signedIn,
  returnPath,
}: {
  report: ScanReport;
  signedIn: boolean;
  returnPath: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  if (!signedIn) {
    return (
      <button
        type="button"
        onClick={() => router.push(`/signin?from=${encodeURIComponent(returnPath)}`)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10"
      >
        Sign in to save this scan
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(false);
            try {
              await saveScan(report);
            } catch {
              setError(true);
            }
          })
        }
        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-zinc-900 transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save this scan"}
      </button>
      {error && <span className="text-xs text-amber-400">Couldn’t save — try again.</span>}
    </div>
  );
}
