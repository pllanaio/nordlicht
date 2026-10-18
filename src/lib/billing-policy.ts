// Until recurring subscriptions are provisioned, a first payment grants exactly
// one initial 30-day period. Replaying the checkout receipt cannot extend it.
export type PaidPayment = {
  status: string; paidAt?: string;
  amountRefunded?: { value: string };
  amountChargedBack?: { value: string };
};

export function firstPaymentAccessUntil(payment: PaidPayment, now = Date.now()): number | null {
  if (payment.status !== "paid" || !payment.paidAt) return null;
  const paidAt = Date.parse(payment.paidAt);
  if (!Number.isFinite(paidAt) || paidAt > now + 60_000) return null;
  for (const amount of [payment.amountRefunded, payment.amountChargedBack]) {
    if (amount && (!Number.isFinite(Number(amount.value)) || Number(amount.value) !== 0)) return null;
  }
  const until = paidAt + 30 * 24 * 60 * 60 * 1000;
  return until > now ? until : null;
}
