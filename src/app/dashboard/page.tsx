import type { Metadata } from "next";
import { DashboardApp, type DashboardView } from "@/components/dashboard/dashboard-app";
import { requireActiveSubscription } from "@/lib/subscription-access";
import { getSocialConnectorCards } from "@/lib/integrations/social-connectors";

export const metadata: Metadata = { title: "Workspace" };

const dashboardViewByQuery: Record<string, DashboardView> = {
  kalender: "Kalender",
  freigaben: "Freigaben",
  mediathek: "Mediathek",
  "ki-studio": "KI-Studio",
  trends: "Trends",
  integrations: "Integrationen",
  abrechnung: "Abrechnung",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; provider?: string; connection_status?: string }>;
}) {
  const [entitlement, connectors, query] = await Promise.all([
    requireActiveSubscription(),
    getSocialConnectorCards(),
    searchParams,
  ]);
  return (
    <DashboardApp
      connectors={connectors}
      displayName={entitlement.displayName}
      internalTest={entitlement.source === "internal-test"}
      plan={entitlement.plan}
      initialView={query.view ? dashboardViewByQuery[query.view] ?? "Übersicht" : "Übersicht"}
      connectorFeedback={query.connection_status ? { provider: query.provider, status: query.connection_status } : undefined}
    />
  );
}
