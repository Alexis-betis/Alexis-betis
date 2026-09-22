import http from "node:http";
import { loadConfig, ConfigError } from "./config.js";
import { openDatabase } from "./db.js";
import { RecallClient } from "./recall/client.js";
import { createApp } from "./app.js";
import { startWorker } from "./services/webhooks.js";

/** Structured logs: event name + non-secret fields only (never bodies, headers or keys). */
export function log(event, fields = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...fields, event }));
}

/** Wire the production object graph from configuration. */
export function buildContext(config, { fetch = globalThis.fetch, sleep } = {}) {
  const db = openDatabase(config.databasePath);
  const recall = new RecallClient({ baseUrl: config.recall.baseUrl, apiKey: config.recall.apiKey, fetch, sleep, log });
  return { db, recall, config, log };
}

export function startServer(ctx) {
  const server = http.createServer(createApp(ctx));
  const stopWorker = startWorker(ctx);
  server.on("close", stopWorker);
  return server;
}

async function main() {
  if (process.argv.includes("--smoke")) {
    const { runSmoke } = await import("./smoke.js");
    process.exit((await runSmoke()) ? 0 : 1);
  }
  let config;
  try {
    config = loadConfig(process.env);
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`Configuration error: ${err.message}`);
      process.exit(2);
    }
    throw err;
  }
  const ctx = buildContext(config);
  const server = startServer(ctx);
  server.listen(config.port, "0.0.0.0", () =>
    log("server.started", { port: config.port, region: config.recall.region, webhook_url: `${config.publicBaseUrl}/webhooks/recall` }),
  );
  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
