import dns from "node:dns/promises";
import net from "node:net";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { getSubscriptionEntitlement } from "@/lib/subscription-access";

type InviteRequest = {
  organizationName?: string;
  member?: { firstName?: string; lastName?: string; email?: string; role?: "Administrator" | "Manager" };
  smtp?: { host?: string; port?: string; username?: string; password?: string; fromEmail?: string; encryption?: "STARTTLS" | "SSL/TLS" };
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
  const organizationName = clean(body.organizationName, 100);
  const firstName = clean(body.member?.firstName, 80);
  const lastName = clean(body.member?.lastName, 80);
  const recipient = clean(body.member?.email, 200).toLowerCase();
  const role = body.member?.role === "Administrator" ? "Administrator" : "Manager";
  const host = clean(body.smtp?.host, 253).toLowerCase();
  const username = clean(body.smtp?.username, 250);
  const password = body.smtp?.password?.slice(0, 500) ?? "";
  const fromEmail = clean(body.smtp?.fromEmail, 200).toLowerCase();
  const port = Number(body.smtp?.port);

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
      secure: body.smtp?.encryption === "SSL/TLS",
      requireTLS: body.smtp?.encryption !== "SSL/TLS",
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
      text: `Hallo ${firstName}, du wurdest als ${role} zu ${organizationName} in ContentDock eingeladen. Melde dich mit dieser E-Mail-Adresse bei ContentDock an, sobald dein Konto aktiviert wurde.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px"><h1 style="font-size:26px">Einladung zu ${safeOrganization}</h1><p>Hallo ${safeName},</p><p>du wurdest als <strong>${role}</strong> zur Organisation <strong>${safeOrganization}</strong> in ContentDock eingeladen.</p><p>Melde dich mit dieser E-Mail-Adresse bei ContentDock an, sobald dein Konto aktiviert wurde.</p></div>`,
    });
    transport.close();
    return NextResponse.json({ sent: true });
  } catch (cause) {
    console.error("SMTP invitation failed", cause instanceof Error ? cause.message : "Unknown SMTP error");
    return NextResponse.json({ error: "Die SMTP-Verbindung oder der Versand ist fehlgeschlagen. Bitte Zugangsdaten und Verschlüsselung prüfen." }, { status: 502 });
  }
}
