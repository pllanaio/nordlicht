import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { Client, Pool } from "pg";
import ts from "typescript";

// Compile the actual server module without a Next server. Only the framework's
// server-only marker and database dependency are supplied by this fixture; the
// application functions and SQL run unchanged against an isolated real schema.
async function loadWorkspaceStore(pool) {
  const source = await readFile(new URL("../src/lib/workspace-store.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const fixtureModule = { exports: {} };
  const require = createRequire(import.meta.url);
  runInNewContext(compiled, { module: fixtureModule, exports: fixtureModule.exports, Buffer, console,
    require: (name) => {
      if (name === "server-only") return {};
      if (name === "@/lib/database") return { getDatabasePool: () => pool };
      if (name === "@/lib/workspace-types") return { storedSecretPlaceholder: "••••••••••••" };
      if (name === "@/lib/workspace-secrets") return { decryptWorkspaceSecret: () => null, encryptWorkspaceSecret: () => { throw new Error("SMTP is not part of this test"); } };
      return require(name);
    },
  });
  return fixtureModule.exports;
}

test("workspace saves revoke/demote real members, preserve owner/self and close denied transactions", { skip: !process.env.VIDEO_TEST_DATABASE_URL, timeout: 30_000 }, async () => {
  const connection = new URL(process.env.VIDEO_TEST_DATABASE_URL);
  assert.ok(["localhost", "127.0.0.1"].includes(connection.hostname), "Use a local disposable database");
  const schema = `workspace_permissions_${randomUUID().replaceAll("-", "")}`;
  const administration = new Client({ connectionString: connection.href });
  const pool = new Pool({ connectionString: connection.href, max: 1, options: `-c search_path=${schema}` });
  const workspaceId = randomUUID();
  const identities = Object.fromEntries(["owner", "actor", "demote", "remove", "reviewer", "outsider"].map((name) => [name, { id: randomUUID(), name, email: `${name}@permissions.test` }]));
  const entitlement = (name) => ({ paymentId: identities[name].id, source: "internal-test", plan: "pro", expiresAt: Date.now() + 300_000, email: identities[name].email, displayName: `${name} Test` });
  const entry = (name, role = "Manager", extra = {}) => ({ ...identities[name], firstName: name, lastName: "Test", role, status: "Aktiv", ...extra });
  try {
    await administration.connect();
    await administration.query(`create schema ${schema}`);
    await administration.query(`set search_path to ${schema}`);
    await administration.query(await readFile(new URL("../database/migrations/001_initial.sql", import.meta.url), "utf8"));
    const store = await loadWorkspaceStore(pool);
    for (const identity of Object.values(identities)) {
      await pool.query("insert into app_user(id, external_auth_id, email, display_name, first_name, last_name) values ($1, $2, $3, $4, $4, 'Test')", [identity.id, `internal-test:${identity.id}`, identity.email, identity.name]);
    }
    await pool.query("insert into workspace(id, name, slug) values ($1, 'Permissions test', 'permissions-test')", [workspaceId]);
    for (const [name, role] of [["owner", "owner"], ["actor", "admin"], ["demote", "admin"], ["remove", "editor"], ["reviewer", "reviewer"]]) {
      await pool.query("insert into workspace_member(workspace_id, user_id, role) values ($1, $2, $3)", [workspaceId, identities[name].id, role]);
    }
    const pendingId = randomUUID();
    await pool.query("insert into workspace_invite(id, workspace_id, email, first_name, last_name, role) values ($1, $2, 'pending@permissions.test', 'Pending', 'Test', 'editor')", [pendingId, workspaceId]);
    const input = {
      revision: 0, items: [], profile: { firstName: "actor", lastName: "Test", email: identities.actor.email, avatarUrl: "" },
      organization: { id: workspaceId, name: "Updated workspace", smtp: { host: "", port: "587", username: "", password: "", fromEmail: "", encryption: "STARTTLS" },
        members: [entry("demote", "Manager", { email: "untrusted-edited-email@permissions.test" }), entry("reviewer"),
          entry("remove", "Administrator", { id: randomUUID() }), // Email alone cannot keep or grant membership.
          entry("outsider", "Administrator", { id: randomUUID() }),
          { id: pendingId, firstName: "Pending", lastName: "Test", email: "pending@permissions.test", role: "Manager", status: "Aktiv" }],
      },
    };
    const saved = await store.saveWorkspaceState(entitlement("actor"), input);
    assert.equal(saved.conflict, false);
    assert.equal(saved.revision, 1);
    const membership = (await pool.query("select user_id, role from workspace_member where workspace_id=$1", [workspaceId])).rows;
    const roles = new Map(membership.map((row) => [row.user_id, row.role]));
    assert.equal(roles.get(identities.owner.id), "owner", "omitted owner remains a member");
    assert.equal(roles.get(identities.actor.id), "admin", "acting admin cannot remove themselves by omission");
    assert.equal(roles.get(identities.demote.id), "editor", "role changes bind to user id, not editable email");
    assert.equal(roles.get(identities.reviewer.id), "reviewer", "unchanged UI label cannot promote reviewers");
    assert.equal(roles.has(identities.remove.id), false);
    assert.equal(roles.has(identities.outsider.id), false, "invitation never grants membership to an existing account");
    const invitations = (await pool.query("select id, email, status from workspace_invite where workspace_id=$1 order by email", [workspaceId])).rows;
    assert.equal(invitations.length, 2, "retained real members and removed members have no shadow invitations");
    assert.ok(invitations.every((row) => row.status === "invited"));
    assert.equal(invitations.find((row) => row.email === "pending@permissions.test").id, pendingId, "pending invitation identity survives saves");

    await assert.rejects(store.saveWorkspaceState(entitlement("reviewer"), { ...input, revision: 1, profile: { ...input.profile, firstName: "Changed", email: identities.reviewer.email } }), { code: "workspace_forbidden" });
    assert.equal((await pool.query("select first_name from app_user where id=$1", [identities.reviewer.id])).rows[0].first_name, "reviewer");
    assert.equal((await pool.query("select data_revision::int as revision from workspace where id=$1", [workspaceId])).rows[0].revision, 1);

    for (let i = 0; i < 3; i += 1) assert.equal(await store.getWorkspaceInvitationSettings(entitlement("demote")), null);
    const connectionState = (await pool.query("select txid_current_if_assigned() is null as clean, (select count(*)::int from pg_locks where locktype='advisory' and pid=pg_backend_pid()) as locks")).rows[0];
    assert.deepEqual(connectionState, { clean: true, locks: 0 }, "denied invitation settings must not release a pooled connection with an open transaction");

    const client = await pool.connect();
    try {
      await client.query("begin");
      const removedContext = await store.ensureWorkspaceContext(client, entitlement("remove"));
      await client.query("commit");
      assert.notEqual(removedContext.workspaceId, workspaceId);
      assert.equal(removedContext.role, "owner");
      assert.equal((await client.query("select count(*)::int as n from workspace_member where workspace_id=$1 and user_id=$2", [workspaceId, identities.remove.id])).rows[0].n, 0);
    } finally { client.release(); }

    await store.saveWorkspaceState(entitlement("actor"), { ...input, revision: 1, organization: null });
    const remaining = (await pool.query("select user_id from workspace_member where workspace_id=$1", [workspaceId])).rows.map((row) => row.user_id).sort();
    assert.deepEqual(remaining, [identities.owner.id, identities.actor.id].sort(), "removing the organization also revokes other real memberships");
  } finally {
    await pool.end();
    await administration.query(`drop schema if exists ${schema} cascade`).catch(() => undefined);
    await administration.end();
  }
});
