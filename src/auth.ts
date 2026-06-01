/**
 * Authentication — Auth.js v5 (NextAuth) with JWT sessions and multiple OAuth
 * providers. Sign in with GitHub, Google, or GitLab; any provider that has
 * credentials configured is offered, the rest are simply not shown.
 *
 * Why JWT (not a database adapter): sessions are signed cookies, so a logged-in
 * request never touches Neon. That keeps the compute budget for the data we
 * actually serve, and means login needs no adapter tables. Saved-state features
 * (watchlist, saved scans) key off the stable `uid` carried in the token.
 *
 * GitHub is the anchor for the *claim* flow specifically: proving you own
 * `repo:github.com/you/...` needs a GitHub handle, which we capture as
 * `githubLogin` only when the visitor signed in with GitHub.
 *
 * Graceful degradation: if NO provider has credentials (e.g. a fresh clone, or
 * a preview deploy without secrets) we register none. `auth()` then returns
 * null, the UI shows the signed-out state, and public views keep working.
 */

import NextAuth, { type NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import GitLab from "next-auth/providers/gitlab";

export type AuthProvider = "github" | "google" | "gitlab";

const providers: NextAuthConfig["providers"] = [];
const enabled: AuthProvider[] = [];

const githubId = process.env.AUTH_GITHUB_ID;
const githubSecret = process.env.AUTH_GITHUB_SECRET;
if (githubId && githubSecret) {
  providers.push(GitHub({ clientId: githubId, clientSecret: githubSecret }));
  enabled.push("github");
}

const googleId = process.env.AUTH_GOOGLE_ID;
const googleSecret = process.env.AUTH_GOOGLE_SECRET;
if (googleId && googleSecret) {
  providers.push(Google({ clientId: googleId, clientSecret: googleSecret }));
  enabled.push("google");
}

const gitlabId = process.env.AUTH_GITLAB_ID;
const gitlabSecret = process.env.AUTH_GITLAB_SECRET;
if (gitlabId && gitlabSecret) {
  providers.push(GitLab({ clientId: gitlabId, clientSecret: gitlabSecret }));
  enabled.push("gitlab");
}

/** Providers with credentials present, in display order. */
export const enabledProviders: readonly AuthProvider[] = enabled;
/** Login is wired up when at least one provider is configured. */
export const authConfigured = providers.length > 0;
/** Claiming a server needs a GitHub handle — only offered when GitHub is on. */
export const githubConfigured = enabled.includes("github");

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Trust the deployment host (Vercel + custom domain). Auth.js needs this to
  // build correct callback URLs behind a proxy / on a non-inferred origin.
  trustHost: true,
  // No adapter: JWT-only sessions keep every authed request off the database.
  session: { strategy: "jwt" },
  // AUTH_SECRET signs the session cookie. When login is unconfigured there are
  // no sessions to protect, so a throwaway placeholder just keeps the endpoints
  // from 500-ing. A real secret is required (and must be set) once login is on.
  secret: process.env.AUTH_SECRET ?? "ax-registry-dev-unconfigured-placeholder",
  providers,
  callbacks: {
    // At sign-in, stamp a stable per-account user id + the provider, and (only
    // for GitHub) the numeric id + login handle the claim flow keys off.
    async jwt({ token, profile, account }) {
      if (account) {
        token.uid = `${account.provider}:${account.providerAccountId}`;
        token.provider = account.provider as AuthProvider;
      }
      if (account?.provider === "github" && profile) {
        token.githubId = String(profile.id);
        token.githubLogin = (profile.login as string) ?? null;
      }
      return token;
    },
    // Surface those onto the session object the app reads.
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? session.user.id;
        session.user.provider = (token.provider as AuthProvider) ?? null;
        session.user.githubId = (token.githubId as string) ?? null;
        session.user.githubLogin = (token.githubLogin as string) ?? null;
      }
      return session;
    },
  },
});
