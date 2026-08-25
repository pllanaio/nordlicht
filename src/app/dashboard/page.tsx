import type { Metadata } from "next";
import { DashboardApp } from "@/components/dashboard/dashboard-app";
import { requireActiveSubscription } from "@/lib/subscription-access";
import { getSocialConnectorCards } from "@/lib/integrations/social-connectors";

export const metadata: Metadata = { title: "Workspace" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; provider?: string; connection_status?: string }>;
}) {
  await requireActiveSubscription();
  const [connectors, query] = await Promise.all([getSocialConnectorCards(), searchParams]);
  return (
    <DashboardApp
      connectors={connectors}
      initialView={query.view === "integrations" ? "Integrationen" : "Übersicht"}
      connectorFeedback={query.connection_status ? { provider: query.provider, status: query.connection_status } : undefined}
    />
  );
}
