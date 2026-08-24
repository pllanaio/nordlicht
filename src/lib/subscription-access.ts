import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const subscriptionCookieName = "contentdock_subscription";

const allowedPlans = new Set(["starter", "studio", "pro"]);

export type SubscriptionEntitlement = {
  paymentId: string;
  plan: string;
  expiresAt: number;
};

function getSigningSecret() {
  const secret = process.env.SUBSCRIPTION_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

function sign(value: string) {
  const secret = getSigningSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function signaturesMatch(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export function createCheckoutState(paymentId: string) {
  const signature = sign(`checkout:${paymentId}`);
  if (!signature) throw new Error("SUBSCRIPTION_SESSION_SECRET is not configured");
  return signature;
}

export function verifyCheckoutState(paymentId: string, state: string) {
  const expected = sign(`checkout:${paymentId}`);
  return Boolean(expected && signaturesMatch(expected, state));
}

export function createSubscriptionToken(input: { paymentId: string; plan: string }) {
  if (!allowedPlans.has(input.plan)) throw new Error("Unknown subscription plan");

  const entitlement: SubscriptionEntitlement = {
    paymentId: input.paymentId,
    plan: input.plan,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  };
  const payload = Buffer.from(JSON.stringify(entitlement)).toString("base64url");
  const signature = sign(`entitlement:${payload}`);
  if (!signature) throw new Error("SUBSCRIPTION_SESSION_SECRET is not configured");
  return `${payload}.${signature}`;
}

function decodeSubscriptionToken(token: string): SubscriptionEntitlement | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(`entitlement:${payload}`);
  if (!expected || !signaturesMatch(expected, signature)) return null;

  try {
    const entitlement = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SubscriptionEntitlement;
    if (
      typeof entitlement.paymentId !== "string" ||
      !allowedPlans.has(entitlement.plan) ||
      typeof entitlement.expiresAt !== "number" ||
      entitlement.expiresAt <= Date.now()
    ) {
      return null;
    }
    return entitlement;
  } catch {
    return null;
  }
}

export async function getSubscriptionEntitlement() {
  const token = (await cookies()).get(subscriptionCookieName)?.value;
  return token ? decodeSubscriptionToken(token) : null;
}

export async function requireActiveSubscription() {
  const entitlement = await getSubscriptionEntitlement();
  if (!entitlement) redirect("/login?reason=subscription");
  return entitlement;
}
