import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "pg";
import { VideoQueue, processJob } from "./video/queue.mjs";

export async function runWorker({ once = false, env = process.env } = {}) {
  if (env.VIDEO_GENERATION_ENABLED !== "true") throw new Error("Video generation is disabled. Set VIDEO_GENERATION_ENABLED=true to start the worker.");
  if (!env.PEXELS_API_KEY || Buffer.from(env.WORKSPACE_DATA_ENCRYPTION_KEY ?? "", "base64").length !== 32) throw new Error("Video worker requires PEXELS_API_KEY and a 32-byte WORKSPACE_DATA_ENCRYPTION_KEY.");
  const config = { application_name: "contentdock-video-worker", connectionTimeoutMillis: 10_000, query_timeout: 20_000, statement_timeout: 15_000 };
  if (env.DATABASE_URL) config.connectionString = env.DATABASE_URL;
  const client = new Client(config);
  const controlClient = new Client(config);
  const workerId = `${hostname()}:${randomUUID()}`;
  const shutdown = new AbortController();
  const stop = () => shutdown.abort();
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  client.on("error", stop);
  controlClient.on("error", stop);
  let heartbeat;
  let heartbeatRunning = false;
  try {
    await client.connect();
    await controlClient.connect();
    // Keep heartbeat/lease writes outside the completion transaction.
    const control = new VideoQueue(controlClient);
    const queue = new VideoQueue(client);
    queue.renew = (job) => control.renew(job);
    await control.heartbeat(workerId);
    heartbeat = setInterval(async () => {
      if (heartbeatRunning) return;
      heartbeatRunning = true;
      try { await control.heartbeat(workerId); }
      catch { shutdown.abort(); }
      finally { heartbeatRunning = false; }
    }, 15_000);
    process.stdout.write("Contentdock video worker ready (concurrency: 1).\n");
    do {
      await queue.expire();
      const job = await queue.claim();
      if (job) {
        const result = await processJob(queue, job, { encryptionKey: env.WORKSPACE_DATA_ENCRYPTION_KEY, pexelsKey: env.PEXELS_API_KEY, signal: shutdown.signal });
        process.stdout.write(`Video job ${job.id}: ${result.status}${result.code ? ` (${result.code})` : ""}.\n`);
      }
      if (once || shutdown.signal.aborted) break;
      if (!job) await delay(3000, undefined, { signal: shutdown.signal }).catch(() => undefined);
    } while (!shutdown.signal.aborted);
  } finally {
    clearInterval(heartbeat);
    process.removeListener("SIGTERM", stop);
    process.removeListener("SIGINT", stop);
    await controlClient.query("delete from video_worker where id = $1", [workerId]).catch(() => undefined);
    await Promise.allSettled([client.end(), controlClient.end()]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runWorker({ once: process.argv.includes("--once") }).catch(() => {
    // Never print pg errors, connection strings, API keys or provider bodies.
    process.stderr.write("Video worker stopped. Check database availability, migrations and required video worker settings.\n");
    process.exitCode = 1;
  });
}
