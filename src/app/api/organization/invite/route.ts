import dns from "node:dns/promises";
import net from "node:net";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { getSubscriptionEntitlement } from "@/lib/subscription-access";
import { getWorkspaceInvitationSettings } from "@/lib/workspace-store";

type InviteRequest = {
  member?: { firstName?: string; lastName?: string; email?: string; role?: "Administrator" | "Manager" };
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPrivateAddress(address: string) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

function clean(value: string | undefined, maxLength: number) {
  return value?.trim().replace(/[\r\n]/g, " ").slice(0, maxLength) ?? "";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] ?? character);
}

export async function POST(request: Request) {
  const entitlement = await getSubscriptionEntitlement();
  if (!entitlement) return NextResponse.json({ error: "Für Einladungen ist ein aktives Abo erforderlich." }, { status: 403 });

  const body = (await request.json()) as InviteRequest;
  const settings = await getWorkspaceInvitationSettings(entitlement);
  if (!settings) return NextResponse.json({ error: "SMTP ist nicht vollständig konfiguriert oder du hast keine Administratorrechte." }, { status: 403 });
  const organizationName = clean(settings.organizationName, 100);
  const firstName = clean(body.member?.firstName, 80);
  const lastName = clean(body.member?.lastName, 80);
  const recipient = clean(body.member?.email, 200).toLowerCase();
  const role = body.member?.role === "Administrator" ? "Administrator" : "Manager";
  const host = clean(settings.host, 253).toLowerCase();
  const username = clean(settings.username, 250);
  const password = settings.password.slice(0, 500);
  const fromEmail = clean(settings.fromEmail, 200).toLowerCase();
  const port = settings.port;

  if (!organizationName || !firstName || !lastName || !emailPattern.test(recipient) || !emailPattern.test(fromEmail) || !host || !username || !password || !Number.isInteger(port) || port < 1 || port > 65_535) {
    return NextResponse.json({ error: "Einladung oder SMTP-Konfiguration ist unvollständig." }, { status: 400 });
  }
  if (host === "localhost" || host.endsWith(".local") || host.includes("metadata")) return NextResponse.json({ error: "Dieser SMTP-Host ist nicht erlaubt." }, { status: 400 });

  try {
    const addresses = await dns.lookup(host, { all: true });
    const publicAddress = addresses.find(({ address }) => !isPrivateAddress(address));
    if (!publicAddress) return NextResponse.json({ error: "Der SMTP-Host verweist nicht auf eine öffentliche Adresse." }, { status: 400 });

    const transport = nodemailer.createTransport({
      host: publicAddress.address,
      port,
      secure: settings.encryption === "SSL/TLS",
      requireTLS: settings.encryption !== "SSL/TLS",
      auth: { user: username, pass: password },
      tls: { servername: host, rejectUnauthorized: true },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

    const safeOrganization = escapeHtml(organizationName);
    const safeName = escapeHtml(firstName);
    await transport.sendMail({
      from: `ContentDock <${fromEmail}>`,
      to: recipient,
      subject: `Einladung zu ${organizationName}`,
      text: `ContentDock\n\nHallo ${firstName},\n\ndu wurdest zu ${organizationName} eingeladen. Deine vorgesehene Rolle: ${role}.\n\nNächster Schritt: Wende dich an die Person, die dich eingeladen hat, um deinen Zugang abzustimmen. Diese Einladung allein schaltet noch keinen Teamzugang frei.\n\nDu hast keine Einladung erwartet? Dann kannst du diese Nachricht ignorieren.`,
      html: `<!doctype html><html lang="de"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>Einladung zu ContentDock</title></head>
        <body style="margin:0;background:#f5f5f7;color:#22252a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:16px;line-height:1.6">
          <table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:24px 16px">
            <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e3e7;border-radius:16px;padding:28px">
              <p style="margin:0 0 28px;font-size:20px;font-weight:700;color:#bc3b30">ContentDock</p>
              <h1 style="margin:0 0 20px;font-size:28px;line-height:1.2">Du bist eingeladen.</h1>
              <p>Hallo ${safeName},</p><p>du wurdest zur Organisation <strong>${safeOrganization}</strong> eingeladen.</p>
              <p style="padding:16px;background:#f5f5f7;border-radius:10px">Deine vorgesehene Rolle<br><strong>${role}</strong></p>
              <h2 style="font-size:18px;margin:24px 0 8px">Dein nächster Schritt</h2>
              <p>Wende dich an die Person, die dich eingeladen hat, um deinen Zugang abzustimmen. Diese Einladung allein schaltet noch keinen Teamzugang frei.</p>
              <p style="margin:28px 0 0;color:#60646d;font-size:14px">Du hast keine Einladung erwartet? Dann kannst du diese Nachricht ignorieren.</p>
            </div>
          </td></tr></table>
        </body></html>`,
    });
    transport.close();
    return NextResponse.json({ sent: true });
  } catch (cause) {
    console.error("SMTP invitation failed", cause instanceof Error ? cause.message : "Unknown SMTP error");
    return NextResponse.json({ error: "Die SMTP-Verbindung oder der Versand ist fehlgeschlagen. Bitte Zugangsdaten und Verschlüsselung prüfen." }, { status: 502 });
  }
}
