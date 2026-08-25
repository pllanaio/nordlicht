import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export const demoSessionCookieName = "contentdock_demo_session";

export async function getDemoSessionId() {
  return (await cookies()).get(demoSessionCookieName)?.value ?? null;
}

export async function getOrCreateDemoSessionId() {
  const cookieStore = await cookies();
  const current = cookieStore.get(demoSessionCookieName)?.value;
  if (current && current.length >= 32) return current;

  const sessionId = randomBytes(24).toString("base64url");
  cookieStore.set(demoSessionCookieName, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    priority: "high",
  });
  return sessionId;
}
