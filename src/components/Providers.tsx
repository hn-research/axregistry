"use client";

/**
 * Client providers. SessionProvider lets nav + per-page auth UI read the session
 * CLIENT-side (useSession) instead of the root layout calling server `auth()` —
 * which previously forced every route to render dynamically (no ISR/caching).
 * Crawlers don't run JS, so they never trigger the session fetch and get pure
 * static/ISR HTML.
 */

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
