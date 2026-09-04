"use server";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authenticateInternalTestAccount } from "@/lib/internal-test-accounts";
import {
  createSubscriptionToken,
  subscriptionCookieName,
} from "@/lib/subscription-access";

export type LoginState = { error?: string };

const invalidCredentialsMessage = "E-Mail-Adresse oder Passwort ist nicht korrekt.";

export async function loginInternalTestAccount(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string") {
    return { error: invalidCredentialsMessage };
  }

  const account = await authenticateInternalTestAccount(email, password);
  if (!account) return { error: invalidCredentialsMessage };

  const accountId = createHash("sha256").update(account.email).digest("base64url").slice(0, 24);
  const token = createSubscriptionToken({
    paymentId: `internal-test:${accountId}`,
    plan: account.plan,
    source: "internal-test",
    displayName: account.name,
    email: account.email,
  });

  (await cookies()).set(subscriptionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60,
    path: "/",
  });

  redirect("/dashboard");
}

export async function logout() {
  (await cookies()).delete(subscriptionCookieName);
  redirect("/login");
}
