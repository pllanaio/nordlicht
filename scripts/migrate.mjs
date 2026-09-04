import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";

const migrationsDirectory = join(process.cwd(), "database", "migrations");
const client = new Client({ application_name: "contentdock-migrations", connectionTimeoutMillis: 10_000 });

try {
  await client.connect();
  await client.query("select pg_advisory_lock(hashtext('contentdock-schema-migrations'))");
  await client.query(`
    create table if not exists schema_migration (
      version text primary key,
      checksum_sha256 text not null,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(migrationsDirectory)).filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name)).sort();
  for (const file of files) {
    const sql = await readFile(join(migrationsDirectory, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const applied = await client.query("select checksum_sha256 from schema_migration where version = $1", [file]);
    if (applied.rows[0]) {
      if (applied.rows[0].checksum_sha256 !== checksum) throw new Error(`Applied migration ${file} was modified`);
      continue;
    }

    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migration (version, checksum_sha256) values ($1, $2)", [file, checksum]);
      await client.query("commit");
      process.stdout.write(`Applied ${file}\n`);
    } catch (cause) {
      await client.query("rollback");
      throw cause;
    }
  }
} finally {
  await client.query("select pg_advisory_unlock(hashtext('contentdock-schema-migrations'))").catch(() => undefined);
  await client.end().catch(() => undefined);
}
