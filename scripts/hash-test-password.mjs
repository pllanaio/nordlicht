import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error("Usage: npm run test-account:hash -- 'a-password-with-at-least-12-characters'");
  process.exitCode = 1;
} else {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  process.stdout.write(`scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}\n`);
}
