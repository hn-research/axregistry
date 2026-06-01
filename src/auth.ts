/**
 * Authentication — Auth.js v5 (NextAuth) with the GitHub provider and JWT
 * sessions.
 *
 * Why JWT (not a database adapter): sessions are signed cookies, so a logged-in
 * request never touches Neon. That keeps the compute budget for the data we
 * actually serve, and means login needs no adapter tables. Saved-state features
 * (watchlists, saved stacks) key off the GitHub user id carried in the token.
 *
 * Graceful degradation: if the GitHub OAuth credentials are absent (e.g. a
 * fresh clone, or a preview deploy without secrets) we register no providers.
 * `auth()` then simply returns null and the UI shows the signed-out state —
 * nothing throws, public views keep working.
 */

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

const githubId = process.env.AUTH_GITHUB_ID;
const githubSecret = process.env.AUTH_GITHUB_SECRET;

/** Login is only wired up when the GitHub OAuth app credentials are present. */
export const authConfigured = Boolean(githubId && githubSecret);

export const { handlers, auth, signIn, signOut } = NextAuth({
  // No adapter: JWT-only sessions keep every authed request off the database.
  session: { strategy: "jwt" },
  // AUTH_SECRET signs the session cookie. When login is unconfigured there are
  // no sessions to protect, so a throwaway placeholder just keeps the endpoints
  // from 500-ing. A real secret is required (and must be set) once login is on.
  secret: process.env.AUTH_SECRET ?? "ax-registry-dev-unconfigured-placeholder",
  providers: authConfigured
    ? [
        GitHub({
          clientId: githubId,
          clientSecret: githubSecret,
        }),
      ]
    : [],
  callbacks: {
    // Persist the GitHub numeric id + login handle into the token at sign-in.
    async jwt({ token, profile }) {
      if (profile) {
        token.githubId = String(profile.id);
        token.githubLogin = (profile.login as string) ?? null;
      }
      return token;
    },
    // Surface those onto the session object the app reads.
    async session({ session, token }) {
      if (session.user) {
        session.user.githubId = (token.githubId as string) ?? null;
        session.user.githubLogin = (token.githubLogin as string) ?? null;
      }
      return session;
    },
  },
});
