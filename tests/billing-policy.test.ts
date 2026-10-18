import assert from "node:assert/strict";
import { test } from "node:test";
import { firstPaymentAccessUntil } from "../src/lib/billing-policy";

const now = Date.UTC(2026, 9, 18);
const paid = { status: "paid", paidAt: new Date(now - 1000).toISOString() };
test("first payment receipt cannot renew access past its original period", () => {
  const until = firstPaymentAccessUntil(paid, now)!;
  assert.equal(until, Date.parse(paid.paidAt) + 30 * 86400000);
  assert.equal(firstPaymentAccessUntil(paid, until), null);
  assert.equal(firstPaymentAccessUntil(paid, until + 86400000), null);
});
test("refunds, chargebacks, unpaid and unverifiable payments fail closed", () => {
  for (const payment of [{ ...paid, status: "open" }, { ...paid, amountRefunded: { value: "1.00" } }, { ...paid, amountChargedBack: { value: "39.00" } }, { ...paid, amountRefunded: { value: "invalid" } }, { status: "paid" }, { ...paid, paidAt: "invalid" }, { ...paid, paidAt: new Date(now + 120000).toISOString() }]) assert.equal(firstPaymentAccessUntil(payment, now), null);
  assert.ok(firstPaymentAccessUntil({ ...paid, amountRefunded: { value: "0.00" } }, now));
});
