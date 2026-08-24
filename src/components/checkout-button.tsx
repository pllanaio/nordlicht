import Link from "next/link";

export function CheckoutButton({
  plan,
  featured = false,
  children,
}: {
  plan: string;
  featured?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link className={`price-button${featured ? " price-button--featured" : ""}`} href={`/subscribe?plan=${plan}`}>
      {children}
    </Link>
  );
}
