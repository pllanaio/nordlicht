import { NextResponse } from "next/server";
import { VideoRequestError } from "./validation";

export function videoError(error: unknown) {
  if (error instanceof VideoRequestError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  // Never log provider payloads, credentials, or SQL parameters.
  console.error("Video workspace operation failed");
  return NextResponse.json({ error: "Der Video-Dienst ist gerade nicht verfügbar. Bitte später erneut versuchen." }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
