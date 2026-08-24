import type { Metadata } from "next";
import { DashboardApp } from "@/components/dashboard/dashboard-app";
import { requireActiveSubscription } from "@/lib/subscription-access";

export const metadata: Metadata = { title: "Workspace" };

export default async function DashboardPage() {
  await requireActiveSubscription();
  return <DashboardApp />;
}
