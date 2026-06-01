/**
 * Provider sign-in buttons — one per configured OAuth provider. Server
 * component: each button is a form bound to the `signInWith` server action with
 * the provider baked in, so there is no client JS and no provider list leaks to
 * the browser beyond what's enabled.
 */

import type { ReactNode } from "react";
import { signInWith } from "@/app/auth-actions";
import { enabledProviders, type AuthProvider } from "@/auth";

const MARKS: Record<AuthProvider, ReactNode> = {
  github: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.73 1.27 3.4.97.1-.75.4-1.27.74-1.56-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.5 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  ),
  google: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M23.52 12.27c0-.82-.07-1.6-.2-2.36H12v4.48h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.1 3.57-5.18 3.57-8.75Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.27a12 12 0 0 0 0 10.75l4-3.11Z" />
      <path fill="#EA4335" d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.43-3.43A12 12 0 0 0 1.27 6.63l4 3.1C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  ),
  gitlab: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#E24329" d="m12 21.4 4.42-13.6H7.58L12 21.4Z" />
      <path fill="#FC6D26" d="M12 21.4 7.58 7.8H1.39L12 21.4Z" />
      <path fill="#FCA326" d="M1.39 7.8.05 11.92a.91.91 0 0 0 .33 1.02L12 21.4 1.39 7.8Z" />
      <path fill="#E24329" d="M1.39 7.8h6.19L4.92 1.61a.46.46 0 0 0-.86 0L1.39 7.8Z" />
      <path fill="#FC6D26" d="m12 21.4 4.42-13.6h6.19L12 21.4Z" />
      <path fill="#FCA326" d="m22.61 7.8 1.34 4.12a.91.91 0 0 1-.33 1.02L12 21.4 22.61 7.8Z" />
      <path fill="#E24329" d="M22.61 7.8h-6.19l2.66-6.19a.46.46 0 0 1 .86 0l2.67 6.19Z" />
    </svg>
  ),
};

const LABEL: Record<AuthProvider, string> = {
  github: "GitHub",
  google: "Google",
  gitlab: "GitLab",
};

export function AuthButtons({ redirectTo }: { redirectTo?: string }) {
  if (enabledProviders.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Sign-in isn&rsquo;t configured on this deployment yet.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {enabledProviders.map((p) => (
        <form key={p} action={signInWith.bind(null, p, redirectTo)}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:border-white/30 hover:bg-white/10"
          >
            {MARKS[p]}
            Continue with {LABEL[p]}
          </button>
        </form>
      ))}
    </div>
  );
}
