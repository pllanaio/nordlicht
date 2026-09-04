import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getDatabasePool } from "@/lib/database";
import type { ScheduleItem, ScheduleStatus } from "@/lib/data";
import type { PlanId } from "@/lib/plans";
import type { SubscriptionEntitlement } from "@/lib/subscription-access";
import { decryptWorkspaceSecret, encryptWorkspaceSecret } from "@/lib/workspace-secrets";
import {
  storedSecretPlaceholder,
  type MediaAsset,
  type Organization,
  type OrganizationMember,
  type OrganizationRole,
  type SmtpSettings,
  type UserProfile,
  type WorkspaceDashboardData,
  type WorkspaceStateInput,
} from "@/lib/workspace-types";

type MembershipRole = "owner" | "admin" | "editor" | "reviewer";

export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  role: MembershipRole;
  configured: boolean;
  revision: number;
  timezone: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const channels = new Set(["Instagram", "TikTok", "LinkedIn", "YouTube"]);
const statuses = new Set(["Entwurf", "Freigabe", "Geplant"]);

function cleanString(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function splitDisplayName(displayName: string | undefined) {
  const names = (displayName ?? "ContentDock User").trim().split(/\s+/).filter(Boolean);
  return { firstName: names[0] || "ContentDock", lastName: names.slice(1).join(" ") || "User" };
}

function fallbackEmail(entitlement: SubscriptionEntitlement) {
  const subjectHash = createHash("sha256").update(`${entitlement.source}:${entitlement.paymentId}`).digest("hex").slice(0, 24);
  return `account-${subjectHash}@users.contentdock.invalid`;
}

function slugFor(name: string) {
  const base = name.toLocaleLowerCase("de").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "workspace";
  return `${base}-${randomUUID().slice(0, 8)}`;
}

function toOrganizationRole(role: MembershipRole): OrganizationRole {
  return role === "owner" || role === "admin" ? "Administrator" : "Manager";
}

function toMembershipRole(role: OrganizationRole): MembershipRole {
  return role === "Administrator" ? "admin" : "editor";
}

function toDatabaseStatus(status: ScheduleStatus) {
  return status === "Geplant" ? "scheduled" : status === "Freigabe" ? "review" : "draft";
}

function fromDatabaseStatus(status: string): ScheduleStatus {
  return status === "scheduled" ? "Geplant" : status === "review" ? "Freigabe" : "Entwurf";
}

export async function ensureWorkspaceContext(client: PoolClient, entitlement: SubscriptionEntitlement): Promise<WorkspaceContext> {
  const externalAuthId = `${entitlement.source}:${entitlement.paymentId}`;
  const names = splitDisplayName(entitlement.displayName);
  const email = entitlement.email && emailPattern.test(entitlement.email) ? entitlement.email.toLocaleLowerCase("en-US") : fallbackEmail(entitlement);
  const displayName = `${names.firstName} ${names.lastName}`.trim();

  await client.query(
    `insert into app_user (external_auth_id, email, display_name, first_name, last_name)
     values ($1, $2, $3, $4, $5)
     on conflict (external_auth_id) do nothing`,
    [externalAuthId, email, displayName, names.firstName, names.lastName],
  );
  const userResult = await client.query<{ id: string }>("select id from app_user where external_auth_id = $1", [externalAuthId]);
  const userId = userResult.rows[0]?.id;
  if (!userId) throw new Error("Workspace user could not be resolved");

  let membership = await client.query<WorkspaceContext>(
    `select wm.user_id as "userId", wm.workspace_id as "workspaceId", wm.role,
            w.configured, w.data_revision::integer as revision, w.timezone
       from workspace_member wm
       join workspace w on w.id = wm.workspace_id
      where wm.user_id = $1
      order by w.created_at
      limit 1`,
    [userId],
  );

  if (!membership.rows[0]) {
    const workspaceName = `${names.firstName}s Workspace`;
    const workspace = await client.query<{ id: string }>(
      "insert into workspace (name, slug) values ($1, $2) returning id",
      [workspaceName, slugFor(workspaceName)],
    );
    const workspaceId = workspace.rows[0].id;
    await client.query("insert into workspace_member (workspace_id, user_id, role) values ($1, $2, 'owner')", [workspaceId, userId]);
    membership = await client.query<WorkspaceContext>(
      `select $1::uuid as "userId", id as "workspaceId", 'owner'::membership_role as role,
              configured, data_revision::integer as revision, timezone
         from workspace where id = $2`,
      [userId, workspaceId],
    );
  }

  const context = membership.rows[0];
  await client.query(
    `insert into subscription (workspace_id, plan, status, mollie_first_payment_id)
     values ($1, $2, 'active', $3)
     on conflict (workspace_id) do update set plan = excluded.plan, status = 'active', updated_at = now()`,
    [context.workspaceId, entitlement.plan satisfies PlanId, entitlement.source === "mollie" ? entitlement.paymentId : null],
  );
  return context;
}

export async function loadWorkspaceData(entitlement: SubscriptionEntitlement): Promise<WorkspaceDashboardData> {
  const client = await getDatabasePool().connect();
  try {
    await client.query("begin");
    const context = await ensureWorkspaceContext(client, entitlement);
    const [workspaceResult, userResult, contentResult, mediaResult, memberResult, inviteResult, smtpResult] = await Promise.all([
      client.query<{ id: string; name: string; configured: boolean; revision: number }>(
        `select id, name, configured, data_revision::integer as revision from workspace where id = $1`,
        [context.workspaceId],
      ),
      client.query<{ firstName: string; lastName: string; email: string; hasAvatar: boolean }>(
        `select first_name as "firstName", last_name as "lastName", email, avatar_data is not null as "hasAvatar"
           from app_user where id = $1`,
        [context.userId],
      ),
      client.query<{ id: string; date: string; time: string; title: string; caption: string; channel: ScheduleItem["channel"]; status: string; image: string }>(
        `select ci.id, to_char(ci.scheduled_at at time zone w.timezone, 'YYYY-MM-DD') as date,
                to_char(ci.scheduled_at at time zone w.timezone, 'HH24:MI') as time,
                ci.title, ci.caption, ci.channel, ci.status, ci.image_url as image
           from content_item ci join workspace w on w.id = ci.workspace_id
          where ci.workspace_id = $1 order by ci.scheduled_at, ci.created_at`,
        [context.workspaceId],
      ),
      client.query<{ id: string; name: string; kind: "image" | "video"; size: string; uploadedAt: string }>(
        `select id, name, case when content_type like 'video/%' then 'video' else 'image' end as kind,
                bytes::text as size, to_char(created_at at time zone 'Europe/Berlin', 'DD.MM.YYYY') as "uploadedAt"
           from media_asset where workspace_id = $1 order by created_at desc`,
        [context.workspaceId],
      ),
      client.query<{ id: string; firstName: string; lastName: string; email: string; role: MembershipRole }>(
        `select u.id, u.first_name as "firstName", u.last_name as "lastName", u.email, wm.role
           from workspace_member wm join app_user u on u.id = wm.user_id
          where wm.workspace_id = $1 order by u.created_at`,
        [context.workspaceId],
      ),
      client.query<{ id: string; firstName: string; lastName: string; email: string; role: MembershipRole; status: "invited" | "active" }>(
        `select id, first_name as "firstName", last_name as "lastName", email, role, status
           from workspace_invite where workspace_id = $1 order by created_at`,
        [context.workspaceId],
      ),
      client.query<{ host: string; port: number; username: string; encryptedPassword: Buffer; fromEmail: string; encryption: SmtpSettings["encryption"] }>(
        `select host, port, username, encrypted_password as "encryptedPassword", from_email as "fromEmail", encryption
           from workspace_smtp_settings where workspace_id = $1`,
        [context.workspaceId],
      ),
    ]);
    await client.query("commit");

    const workspace = workspaceResult.rows[0];
    const user = userResult.rows[0];
    if (!workspace || !user) throw new Error("Workspace data is incomplete");
    const items: ScheduleItem[] = contentResult.rows.map((item) => ({ ...item, status: fromDatabaseStatus(item.status) }));
    const mediaAssets: MediaAsset[] = mediaResult.rows.map((asset) => ({ ...asset, size: Number(asset.size), preview: `/api/workspace/media/${asset.id}` }));
    const members: OrganizationMember[] = [
      ...memberResult.rows.map((member) => ({ ...member, role: toOrganizationRole(member.role), status: "Aktiv" as const })),
      ...inviteResult.rows.map((member) => ({ ...member, role: toOrganizationRole(member.role), status: member.status === "active" ? "Aktiv" as const : "Eingeladen" as const })),
    ];
    const smtpRow = smtpResult.rows[0];
    const smtp: SmtpSettings = smtpRow && decryptWorkspaceSecret(smtpRow.encryptedPassword) !== null
      ? { host: smtpRow.host, port: String(smtpRow.port), username: smtpRow.username, password: storedSecretPlaceholder, fromEmail: smtpRow.fromEmail, encryption: smtpRow.encryption }
      : { host: "", port: "587", username: "", password: "", fromEmail: "", encryption: "STARTTLS" };
    const today = new Date().toISOString().slice(0, 10);

    return {
      revision: workspace.revision,
      role: toOrganizationRole(context.role),
      calendarAnchorDate: items[0]?.date ?? today,
      items,
      mediaAssets,
      organization: workspace.configured ? { id: workspace.id, name: workspace.name, members, smtp } : null,
      profile: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatarUrl: user.hasAvatar ? `/api/workspace/profile/avatar?v=${workspace.revision}` : "",
      },
    };
  } catch (cause) {
    await client.query("rollback").catch(() => undefined);
    throw cause;
  } finally {
    client.release();
  }
}

function parseProfile(value: unknown): UserProfile {
  if (!value || typeof value !== "object") throw new Error("Profil fehlt");
  const candidate = value as Record<string, unknown>;
  const firstName = cleanString(candidate.firstName, 80);
  const lastName = cleanString(candidate.lastName, 80);
  const email = cleanString(candidate.email, 254).toLocaleLowerCase("en-US");
  if (!firstName || !lastName || !emailPattern.test(email)) throw new Error("Profil ist ungültig");
  return { firstName, lastName, email, avatarUrl: cleanString(candidate.avatarUrl, 400) };
}

function parseItems(value: unknown): ScheduleItem[] {
  if (!Array.isArray(value) || value.length > 500) throw new Error("Inhaltsliste ist ungültig");
  return value.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("Inhalt ist ungültig");
    const candidate = entry as Record<string, unknown>;
    const id = cleanString(candidate.id, 80);
    const date = cleanString(candidate.date, 10);
    const time = cleanString(candidate.time, 5);
    const title = cleanString(candidate.title, 160);
    const caption = cleanString(candidate.caption, 5_000);
    const channel = cleanString(candidate.channel, 20);
    const status = cleanString(candidate.status, 20);
    const image = cleanString(candidate.image, 500) || "/media/design-studio.webp";
    if (!id || !datePattern.test(date) || !timePattern.test(time) || !title || !channels.has(channel) || !statuses.has(status)) throw new Error("Inhalt ist unvollständig");
    return { id, date, time, title, caption, channel: channel as ScheduleItem["channel"], status: status as ScheduleStatus, image };
  });
}

function parseSmtp(value: unknown): SmtpSettings {
  const candidate = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const encryption = candidate.encryption === "SSL/TLS" ? "SSL/TLS" : "STARTTLS";
  return {
    host: cleanString(candidate.host, 253).toLocaleLowerCase("en-US"),
    port: cleanString(candidate.port, 5) || "587",
    username: cleanString(candidate.username, 250),
    password: typeof candidate.password === "string" ? candidate.password.slice(0, 500) : "",
    fromEmail: cleanString(candidate.fromEmail, 254).toLocaleLowerCase("en-US"),
    encryption,
  };
}

function parseOrganization(value: unknown): Organization | null {
  if (value === null) return null;
  if (!value || typeof value !== "object") throw new Error("Organisation ist ungültig");
  const candidate = value as Record<string, unknown>;
  const id = cleanString(candidate.id, 80);
  const name = cleanString(candidate.name, 100);
  if (!id || !name || !Array.isArray(candidate.members) || candidate.members.length > 100) throw new Error("Organisation ist unvollständig");
  const members: OrganizationMember[] = candidate.members.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("Mitglied ist ungültig");
    const member = entry as Record<string, unknown>;
    const email = cleanString(member.email, 254).toLocaleLowerCase("en-US");
    const role: OrganizationRole = member.role === "Administrator" ? "Administrator" : "Manager";
    const status: OrganizationMember["status"] = member.status === "Aktiv" ? "Aktiv" : "Eingeladen";
    const parsed = { id: cleanString(member.id, 80), firstName: cleanString(member.firstName, 80), lastName: cleanString(member.lastName, 80), email, role, status };
    if (!parsed.id || !parsed.firstName || !parsed.lastName || !emailPattern.test(parsed.email)) throw new Error("Mitglied ist unvollständig");
    return parsed;
  });
  return { id, name, members, smtp: parseSmtp(candidate.smtp) };
}

export function parseWorkspaceState(value: unknown): WorkspaceStateInput {
  if (!value || typeof value !== "object") throw new Error("Workspace-Daten fehlen");
  const candidate = value as Record<string, unknown>;
  const revision = Number(candidate.revision);
  if (!Number.isInteger(revision) || revision < 0) throw new Error("Workspace-Version ist ungültig");
  return { revision, items: parseItems(candidate.items), organization: parseOrganization(candidate.organization), profile: parseProfile(candidate.profile) };
}

export async function saveWorkspaceState(entitlement: SubscriptionEntitlement, input: WorkspaceStateInput) {
  const client = await getDatabasePool().connect();
  try {
    await client.query("begin");
    const context = await ensureWorkspaceContext(client, entitlement);
    const locked = await client.query<{ revision: number }>(
      "select data_revision::integer as revision from workspace where id = $1 for update",
      [context.workspaceId],
    );
    if (locked.rows[0]?.revision !== input.revision) {
      await client.query("rollback");
      return { conflict: true as const, revision: locked.rows[0]?.revision ?? context.revision };
    }

    await client.query(
      `update app_user set first_name = $2, last_name = $3, display_name = $2 || ' ' || $3, email = $4 where id = $1`,
      [context.userId, input.profile.firstName, input.profile.lastName, input.profile.email],
    );

    await client.query("delete from content_item where workspace_id = $1", [context.workspaceId]);
    for (const item of input.items) {
      const itemId = uuidPattern.test(item.id) ? item.id : randomUUID();
      await client.query(
        `insert into content_item (id, workspace_id, title, caption, channel, image_url, status, created_by, scheduled_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8,
           (($9::date + $10::time) at time zone (select timezone from workspace where id = $2)))`,
        [itemId, context.workspaceId, item.title, item.caption, item.channel, item.image, toDatabaseStatus(item.status), context.userId, item.date, item.time],
      );
    }

    const isAdministrator = context.role === "owner" || context.role === "admin";
    if (isAdministrator) {
      if (!input.organization) {
        await client.query("update workspace set configured = false where id = $1", [context.workspaceId]);
        await client.query("delete from workspace_invite where workspace_id = $1", [context.workspaceId]);
        await client.query("delete from workspace_smtp_settings where workspace_id = $1", [context.workspaceId]);
        await client.query("delete from media_asset where workspace_id = $1", [context.workspaceId]);
      } else {
        await client.query("update workspace set name = $2, configured = true where id = $1", [context.workspaceId, input.organization.name]);
        await client.query("delete from workspace_invite where workspace_id = $1", [context.workspaceId]);
        for (const member of input.organization.members.filter((member) => member.email !== input.profile.email)) {
          await client.query(
            `insert into workspace_invite (id, workspace_id, email, first_name, last_name, role, status)
             values ($1, $2, $3, $4, $5, $6, $7)`,
            [uuidPattern.test(member.id) ? member.id : randomUUID(), context.workspaceId, member.email, member.firstName, member.lastName, toMembershipRole(member.role), member.status === "Aktiv" ? "active" : "invited"],
          );
        }

        const smtp = input.organization.smtp;
        const smtpComplete = Boolean(smtp.host && smtp.username && smtp.fromEmail && Number(smtp.port));
        if (!smtpComplete) {
          await client.query("delete from workspace_smtp_settings where workspace_id = $1", [context.workspaceId]);
        } else {
          const currentSecret = await client.query<{ encryptedPassword: Buffer }>(
            `select encrypted_password as "encryptedPassword" from workspace_smtp_settings where workspace_id = $1`,
            [context.workspaceId],
          );
          const encryptedPassword = smtp.password === storedSecretPlaceholder
            ? currentSecret.rows[0]?.encryptedPassword
            : smtp.password ? encryptWorkspaceSecret(smtp.password) : null;
          if (!encryptedPassword || !emailPattern.test(smtp.fromEmail)) throw new Error("SMTP-Konfiguration ist unvollständig");
          await client.query(
            `insert into workspace_smtp_settings (workspace_id, host, port, username, encrypted_password, from_email, encryption)
             values ($1, $2, $3, $4, $5, $6, $7)
             on conflict (workspace_id) do update set host = excluded.host, port = excluded.port,
               username = excluded.username, encrypted_password = excluded.encrypted_password,
               from_email = excluded.from_email, encryption = excluded.encryption, updated_at = now()`,
            [context.workspaceId, smtp.host, Number(smtp.port), smtp.username, encryptedPassword, smtp.fromEmail, smtp.encryption],
          );
        }
      }
    }

    const updated = await client.query<{ revision: number }>(
      "update workspace set data_revision = data_revision + 1 where id = $1 returning data_revision::integer as revision",
      [context.workspaceId],
    );
    await client.query("commit");
    return { conflict: false as const, revision: updated.rows[0].revision };
  } catch (cause) {
    await client.query("rollback").catch(() => undefined);
    throw cause;
  } finally {
    client.release();
  }
}

export async function getWorkspaceInvitationSettings(entitlement: SubscriptionEntitlement) {
  const client = await getDatabasePool().connect();
  try {
    await client.query("begin");
    const context = await ensureWorkspaceContext(client, entitlement);
    if (context.role !== "owner" && context.role !== "admin") return null;
    const result = await client.query<{ organizationName: string; host: string; port: number; username: string; encryptedPassword: Buffer; fromEmail: string; encryption: SmtpSettings["encryption"] }>(
      `select w.name as "organizationName", s.host, s.port, s.username,
              s.encrypted_password as "encryptedPassword", s.from_email as "fromEmail", s.encryption
         from workspace_smtp_settings s join workspace w on w.id = s.workspace_id
        where s.workspace_id = $1`,
      [context.workspaceId],
    );
    await client.query("commit");
    const row = result.rows[0];
    const password = row ? decryptWorkspaceSecret(row.encryptedPassword) : null;
    return row && password ? { organizationName: row.organizationName, host: row.host, port: row.port, username: row.username, password, fromEmail: row.fromEmail, encryption: row.encryption } : null;
  } catch (cause) {
    await client.query("rollback").catch(() => undefined);
    throw cause;
  } finally {
    client.release();
  }
}
