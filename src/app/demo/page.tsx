import type { Metadata } from "next";
import { DashboardApp, type DashboardView } from "@/components/dashboard/dashboard-app";
import { getSocialConnectorCards } from "@/lib/integrations/social-connectors";

export const metadata: Metadata = { title: "Live-Demo" };

const demoViewByQuery: Record<string, DashboardView> = {
  kalender: "Kalender",
  freigaben: "Freigaben",
  organisation: "Organisation",
  mediathek: "Mediathek",
  "ki-studio": "KI-Studio",
  trends: "Trends",
  integrations: "Integrationen",
  abrechnung: "Abrechnung",
};

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
      initialView={query.view ? demoViewByQuery[query.view] ?? "Übersicht" : "Übersicht"}
      connectorFeedback={query.connection_status ? { provider: query.provider, status: query.connection_status } : undefined}
    />
  );
}
