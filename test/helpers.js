import crypto from "node:crypto";
import http from "node:http";
import { loadConfig } from "../src/config.js";
import { buildContext } from "../src/index.js";
import { createApp } from "../src/app.js";
import { createFakeRecall } from "../src/testing/fake-recall.js";
import { signForTest } from "../src/recall/verify.js";

export const SECRET = `whsec_${crypto.randomBytes(24).toString("base64")}`;
export const TOKEN = "test-access-token-123456";

export function setup() {
  const fake = createFakeRecall();
  const config = loadConfig({
    RECALL_REGION: "eu-central-1",
    RECALL_API_KEY: fake.apiKey,
    RECALL_WEBHOOK_VERIFICATION_SECRET: SECRET,
    PUBLIC_API_BASE_URL: "https://notetaker.profilr.example",
    APP_ACCESS_TOKEN: TOKEN,
    DATABASE_PATH: ":memory:",
  });
  const logs = [];
  const ctx = buildContext(config, { fetch: fake.fetch, sleep: async () => {} });
  ctx.log = (event, fields) => logs.push({ event, ...fields });
  ctx.recall.log = ctx.log;
  return { ctx, fake, config, logs };
}

/** Start the real HTTP handler on a loopback port. */
export async function serve(ctx) {
  const server = http.createServer(createApp(ctx));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, { method = "GET", body, headers = {}, auth = true } = {}) =>
    fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${TOKEN}` } : {}), ...headers },
      body: body == null ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
  const deliver = (payload, { msgId } = {}) => {
    const raw = JSON.stringify(payload);
    return call("/webhooks/recall", { method: "POST", body: raw, auth: false, headers: signForTest({ secret: SECRET, payload: raw, msgId }) });
  };
  return { base, call, deliver, close: () => new Promise((r) => server.close(r)) };
}

export const statusData = (code, extra = {}) => ({ code, sub_code: null, updated_at: new Date().toISOString(), ...extra });
