/**
 * Module augmentation: carry the identity we stash in the JWT through to the
 * typed `session.user` the app consumes. See src/auth.ts callbacks.
 *
 * `id` is a stable per-account key (`<provider>:<accountId>`) used for
 * watchlist / saved-scan ownership. `githubLogin` is present only for visitors
 * who signed in with GitHub, and gates the claim flow.
 */
import type { DefaultSession } from "next-auth";

type AuthProvider = "github" | "google" | "gitlab";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      provider: AuthProvider | null;
      githubId: string | null;
      githubLogin: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    provider?: AuthProvider;
    githubId?: string | null;
    githubLogin?: string | null;
  }
}
