import type { Metadata } from "next";
import { DashboardApp, type DashboardView } from "@/components/dashboard/dashboard-app";
import { requireActiveSubscription } from "@/lib/subscription-access";
import { getSocialConnectorCards } from "@/lib/integrations/social-connectors";
import { loadWorkspaceData } from "@/lib/workspace-store";

export const metadata: Metadata = { title: "Workspace" };

const dashboardViewByQuery: Record<string, DashboardView> = {
  kalender: "Kalender",
  freigaben: "Freigaben",
  organisation: "Organisation",
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
  const [entitlement, query] = await Promise.all([requireActiveSubscription(), searchParams]);
  const [connectors, workspaceData] = await Promise.all([
    getSocialConnectorCards({ mode: "workspace", entitlement }),
    loadWorkspaceData(entitlement),
  ]);
  return (
    <DashboardApp
      connectors={connectors}
      displayName={entitlement.displayName}
      internalTest={entitlement.source === "internal-test"}
      plan={entitlement.plan}
      initialWorkspaceData={workspaceData}
      initialView={query.view ? dashboardViewByQuery[query.view] ?? "Übersicht" : "Übersicht"}
      connectorFeedback={query.connection_status ? { provider: query.provider, status: query.connection_status } : undefined}
    />
  );
}
