import type { Metadata } from "next";
import { DashboardApp } from "@/components/dashboard/dashboard-app";

export const metadata: Metadata = { title: "Live-Demo" };

export default function DemoPage() {
  return <DashboardApp mode="demo" />;
}
