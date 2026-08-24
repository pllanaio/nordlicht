"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CheckoutButton({
  plan,
  featured = false,
  children,
}: {
  plan: string;
  featured?: boolean;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function startCheckout() {
    setLoading(true);
    try {
      const response = await fetch("/api/mollie/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const result = (await response.json()) as { checkoutUrl?: string; demoUrl?: string };
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      router.push(result.demoUrl ?? `/login?plan=${plan}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className={`price-button${featured ? " price-button--featured" : ""}`} onClick={startCheckout} disabled={loading}>
      {loading ? "Wird vorbereitet …" : children}
    </button>
  );
}
