import { NextResponse } from "next/server";
import { getSubscriptionEntitlement } from "@/lib/subscription-access";
import { parseWorkspaceState, saveWorkspaceState } from "@/lib/workspace-store";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  const entitlement = await getSubscriptionEntitlement();
  if (!entitlement) return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });

  try {
    const input = parseWorkspaceState(await request.json());
    const result = await saveWorkspaceState(entitlement, input);
    if (result.conflict) {
      return NextResponse.json(
        { error: "Der Workspace wurde zwischenzeitlich geändert. Bitte lade die Seite neu.", revision: result.revision },
        { status: 409 },
      );
    }
    return NextResponse.json({ saved: true, revision: result.revision });
  } catch (cause) {
    const duplicateEmail = Boolean(cause && typeof cause === "object" && "code" in cause && cause.code === "23505");
    console.error("Workspace persistence failed", cause instanceof Error ? cause.message : "Unknown workspace error");
    return NextResponse.json(
      { error: duplicateEmail ? "Diese E-Mail-Adresse wird bereits verwendet." : "Workspace-Daten konnten nicht gespeichert werden." },
      { status: duplicateEmail ? 409 : 400 },
    );
  }
}
