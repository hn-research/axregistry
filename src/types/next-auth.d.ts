/**
 * Module augmentation: carry the GitHub identity we stash in the JWT through to
 * the typed `session.user` the app consumes. See src/auth.ts callbacks.
 */
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      githubId: string | null;
      githubLogin: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    githubId?: string | null;
    githubLogin?: string | null;
  }
}
