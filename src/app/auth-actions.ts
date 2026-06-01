"use server";

/** Server actions for the sign-in / sign-out controls in the nav. */

import { signIn, signOut } from "@/auth";

export async function signInWithGitHub() {
  await signIn("github");
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
