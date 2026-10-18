import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isPlanId, type PlanId } from "@/lib/plans";
import { getMolliePayment } from "@/lib/integrations/mollie";
import { firstPaymentAccessUntil } from "@/lib/billing-policy";

export const subscriptionCookieName = "contentdock_subscription";

export type SubscriptionEntitlement = {
  paymentId: string;
  plan: PlanId;
  expiresAt: number;
  source: "mollie" | "internal-test";
  displayName?: string;
  email?: string;
  accessUntil?: number;
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
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const signature = sign(`checkout:${paymentId}:${expiresAt}`);
  if (!signature) throw new Error("SUBSCRIPTION_SESSION_SECRET is not configured");
  return `${expiresAt}.${signature}`;
}

export function verifyCheckoutState(paymentId: string, state: string) {
  const [expiry, signature, extra] = state.split(".");
  const expiresAt = Number(expiry);
  if (!signature || extra || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + 24 * 60 * 60 * 1000) return false;
  const expected = sign(`checkout:${paymentId}:${expiry}`);
  return Boolean(expected && signaturesMatch(expected, signature));
}

export function createSubscriptionToken(input: {
  paymentId: string;
  plan: PlanId;
  source?: SubscriptionEntitlement["source"];
  displayName?: string;
  email?: string;
  accessUntil?: number;
}) {
  if (!isPlanId(input.plan)) throw new Error("Unknown subscription plan");

  const entitlement: SubscriptionEntitlement = {
    paymentId: input.paymentId,
    plan: input.plan,
    expiresAt: Math.min(Date.now() + 24 * 60 * 60 * 1000, input.accessUntil ?? Number.POSITIVE_INFINITY),
    source: input.source ?? "mollie",
    displayName: input.displayName?.slice(0, 80),
    email: input.email?.trim().toLocaleLowerCase("en-US").slice(0, 254),
    accessUntil: input.accessUntil,
  };
  const payload = Buffer.from(JSON.stringify(entitlement)).toString("base64url");
  const signature = sign(`entitlement:${payload}`);
  if (!signature) throw new Error("SUBSCRIPTION_SESSION_SECRET is not configured");
  return `${payload}.${signature}`;
}

function decodeSubscriptionToken(token: string): SubscriptionEntitlement | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra || token.length > 8192) return null;

  const expected = sign(`entitlement:${payload}`);
  if (!expected || !signaturesMatch(expected, signature)) return null;

  try {
    const entitlement = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<SubscriptionEntitlement>;
    const source = entitlement.source ?? "mollie";
    if (
      typeof entitlement.paymentId !== "string" ||
      !isPlanId(entitlement.plan) ||
      typeof entitlement.expiresAt !== "number" ||
      !Number.isFinite(entitlement.expiresAt) ||
      entitlement.expiresAt <= Date.now() ||
      (source !== "mollie" && source !== "internal-test") ||
      (entitlement.displayName !== undefined && typeof entitlement.displayName !== "string") ||
      (entitlement.email !== undefined && typeof entitlement.email !== "string")
      || (entitlement.accessUntil !== undefined && (typeof entitlement.accessUntil !== "number" || !Number.isFinite(entitlement.accessUntil) || entitlement.accessUntil <= Date.now()))
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
      accessUntil: entitlement.accessUntil,
    };
  } catch {
    return null;
  }
}

export async function getSubscriptionEntitlement() {
  const token = (await cookies()).get(subscriptionCookieName)?.value;
  const entitlement = token ? decodeSubscriptionToken(token) : null;
  if (!entitlement || entitlement.source === "internal-test") return entitlement;
  try {
    // The receipt and cookie alone are insufficient after a refund or chargeback.
    const payment = await getMolliePayment(entitlement.paymentId);
    const accessUntil = firstPaymentAccessUntil(payment);
    if (!accessUntil || payment.metadata?.plan !== entitlement.plan) return null;
    return { ...entitlement, accessUntil, expiresAt: Math.min(entitlement.expiresAt, accessUntil) };
  } catch {
    return null;
  }
}

export async function requireActiveSubscription() {
  const entitlement = await getSubscriptionEntitlement();
  if (!entitlement) redirect("/login?reason=subscription");
  return entitlement;
}
