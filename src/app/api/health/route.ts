import { NextResponse } from "next/server";
import { checkDatabaseConnection } from "@/lib/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET() {
  const startedAt = Date.now();

  try {
    const database = await checkDatabaseConnection();
    return NextResponse.json(
      {
        status: "healthy",
        services: { database: "connected" },
        database: database?.database,
        responseTimeMs: Date.now() - startedAt,
      },
      { headers: noStoreHeaders },
    );
  } catch (cause) {
    console.error("Database health check failed", cause instanceof Error ? cause.message : "Unknown database error");
    return NextResponse.json(
      {
        status: "unhealthy",
        services: { database: "unavailable" },
        responseTimeMs: Date.now() - startedAt,
      },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
