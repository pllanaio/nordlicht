import "server-only";

import { scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { isPlanId, type PlanId } from "@/lib/plans";

const scryptAsync = promisify(scrypt);
const hashPattern = /^scrypt\$([A-Za-z0-9_-]{16,})\$([A-Za-z0-9_-]{32,})$/;

type InternalTestAccountConfig = {
  email: string;
  name: string;
  passwordHash: string;
  plan: PlanId;
};

export type InternalTestAccount = Pick<InternalTestAccountConfig, "email" | "name" | "plan">;

function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function readInternalTestAccounts(): InternalTestAccountConfig[] {
  const encoded = process.env.INTERNAL_TEST_ACCOUNTS;
  if (!encoded) return [];

  try {
    const parsed = JSON.parse(encoded) as unknown;
    if (!Array.isArray(parsed)) throw new Error("Expected an array");

    return parsed.map((entry, index) => {
      if (!entry || typeof entry !== "object") throw new Error(`Entry ${index} is not an object`);
      const candidate = entry as Record<string, unknown>;
      if (
        typeof candidate.email !== "string" ||
        typeof candidate.name !== "string" ||
        typeof candidate.passwordHash !== "string" ||
        !hashPattern.test(candidate.passwordHash) ||
        !isPlanId(candidate.plan)
      ) {
        throw new Error(`Entry ${index} is invalid`);
      }

      return {
        email: normalizeEmail(candidate.email),
        name: candidate.name.trim().slice(0, 80) || "Testkonto",
        passwordHash: candidate.passwordHash,
        plan: candidate.plan,
      };
    });
  } catch (cause) {
    console.error(
      "INTERNAL_TEST_ACCOUNTS could not be parsed",
      cause instanceof Error ? cause.message : "Unknown configuration error",
    );
    return [];
  }
}

async function verifyPassword(password: string, encodedHash: string) {
  const match = hashPattern.exec(encodedHash);
  if (!match) return false;

  const salt = Buffer.from(match[1], "base64url");
  const expected = Buffer.from(match[2], "base64url");
  const derived = (await scryptAsync(password, salt, expected.length)) as Buffer;
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export function hasInternalTestAccounts() {
  return readInternalTestAccounts().length > 0;
}

export async function authenticateInternalTestAccount(
  email: string,
  password: string,
): Promise<InternalTestAccount | null> {
  if (email.length > 254 || password.length < 12 || password.length > 256) return null;

  const account = readInternalTestAccounts().find((candidate) => candidate.email === normalizeEmail(email));
  if (!account || !(await verifyPassword(password, account.passwordHash))) return null;

  return { email: account.email, name: account.name, plan: account.plan };
}
