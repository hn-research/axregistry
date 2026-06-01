"use server";

/** Server actions for the sign-in / sign-out controls. */

import { signIn, signOut, type AuthProvider } from "@/auth";

export async function signInWith(provider: AuthProvider, redirectTo?: string) {
  await signIn(provider, redirectTo ? { redirectTo } : undefined);
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
