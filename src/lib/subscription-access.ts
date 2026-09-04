import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isPlanId, type PlanId } from "@/lib/plans";

export const subscriptionCookieName = "contentdock_subscription";

export type SubscriptionEntitlement = {
  paymentId: string;
  plan: PlanId;
  expiresAt: number;
  source: "mollie" | "internal-test";
  displayName?: string;
  email?: string;
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

export function createSubscriptionToken(input: {
  paymentId: string;
  plan: PlanId;
  source?: SubscriptionEntitlement["source"];
  displayName?: string;
  email?: string;
}) {
  if (!isPlanId(input.plan)) throw new Error("Unknown subscription plan");

  const entitlement: SubscriptionEntitlement = {
    paymentId: input.paymentId,
    plan: input.plan,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    source: input.source ?? "mollie",
    displayName: input.displayName?.slice(0, 80),
    email: input.email?.trim().toLocaleLowerCase("en-US").slice(0, 254),
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
    const entitlement = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<SubscriptionEntitlement>;
    const source = entitlement.source ?? "mollie";
    if (
      typeof entitlement.paymentId !== "string" ||
      !isPlanId(entitlement.plan) ||
      typeof entitlement.expiresAt !== "number" ||
      entitlement.expiresAt <= Date.now() ||
      (source !== "mollie" && source !== "internal-test") ||
      (entitlement.displayName !== undefined && typeof entitlement.displayName !== "string") ||
      (entitlement.email !== undefined && typeof entitlement.email !== "string")
    ) {
      return null;
    }
    return {
      paymentId: entitlement.paymentId,
      plan: entitlement.plan,
      expiresAt: entitlement.expiresAt,
      source,
      displayName: entitlement.displayName,
      email: entitlement.email,
    };
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
