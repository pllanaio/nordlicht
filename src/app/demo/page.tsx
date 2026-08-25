import type { Metadata } from "next";
import { DashboardApp } from "@/components/dashboard/dashboard-app";
import { getSocialConnectorCards } from "@/lib/integrations/social-connectors";

export const metadata: Metadata = { title: "Live-Demo" };

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; provider?: string; connection_status?: string }>;
}) {
  const [connectors, query] = await Promise.all([getSocialConnectorCards(), searchParams]);
  return (
    <DashboardApp
      mode="demo"
      connectors={connectors}
      initialView={query.view === "integrations" ? "Integrationen" : "Übersicht"}
      connectorFeedback={query.connection_status ? { provider: query.provider, status: query.connection_status } : undefined}
    />
  );
}
