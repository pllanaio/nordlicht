const planPrices: Record<string, string> = {
  starter: "39.00",
  studio: "89.00",
  pro: "179.00",
};

type MollieCustomer = { id: string };
export type MolliePayment = {
  id: string;
  status: string;
  customerId?: string;
  metadata?: { plan?: string; customerId?: string };
  _links?: { checkout?: { href?: string } };
};

async function mollieFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) throw new Error("MOLLIE_API_KEY is not configured");
  const response = await fetch(`https://api.mollie.com/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Mollie ${response.status}: ${(await response.text()).slice(0, 400)}`);
  return response.json() as Promise<T>;
}

export async function createFirstMolliePayment(input: {
  plan: string;
  email: string;
  name: string;
  redirectUrl: string;
  webhookUrl: string;
}) {
  const value = planPrices[input.plan];
  if (!value) throw new Error("Unknown plan");

  const customer = await mollieFetch<MollieCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({ name: input.name, email: input.email, metadata: { source: "contentdock" } }),
  });
  const payment = await mollieFetch<MolliePayment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      amount: { currency: "EUR", value },
      customerId: customer.id,
      sequenceType: "first",
      description: `ContentDock ${input.plan}`,
      redirectUrl: input.redirectUrl,
      webhookUrl: input.webhookUrl,
      metadata: { plan: input.plan, customerId: customer.id },
    }),
  });
  const checkoutUrl = payment._links?.checkout?.href;
  if (!checkoutUrl) throw new Error("Mollie returned no checkout URL");
  return { checkoutUrl, paymentId: payment.id, customerId: customer.id };
}

export function getMolliePayment(paymentId: string) {
  if (!/^tr_[A-Za-z0-9]+$/.test(paymentId)) throw new Error("Invalid Mollie payment id");
  return mollieFetch<MolliePayment>(`/payments/${paymentId}`);
}
