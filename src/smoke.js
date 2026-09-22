// Non-destructive smoke run of the production entrypoint. Uses a fake,
// clearly-labelled Recall backend and fake configuration; it never contacts
// Recall and never reads real credentials.
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { loadConfig } from "./config.js";
import { buildContext, startServer } from "./index.js";
import { signForTest } from "./recall/verify.js";
import { drainInbox } from "./services/webhooks.js";
import { createFakeRecall } from "./testing/fake-recall.js";

export async function runSmoke() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "profilr-smoke-"));
  const secret = `whsec_${Buffer.from(crypto.randomBytes(24)).toString("base64")}`;
  const fake = createFakeRecall();
  const config = loadConfig({
    RECALL_REGION: "eu-central-1",
    RECALL_API_KEY: fake.apiKey,
    RECALL_WEBHOOK_VERIFICATION_SECRET: secret,
    PUBLIC_API_BASE_URL: "https://smoke.profilr.example",
    APP_ACCESS_TOKEN: "smoke-token-0123456789",
    DATABASE_PATH: path.join(dir, "smoke.sqlite"),
  });
  const ctx = buildContext(config, { fetch: fake.fetch, sleep: async () => {} });
  const server = startServer(ctx);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const auth = { authorization: `Bearer ${config.accessToken}`, "content-type": "application/json" };
  const checks = [];
  const check = (name, ok) => (checks.push({ name, ok }), ok);

  try {
    check("GET / serves UI", (await fetch(`${base}/`)).status === 200);
    check("API requires token", (await fetch(`${base}/api/meetings`)).status === 401);

    const created = await fetch(`${base}/api/meetings`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ meeting_url: "https://meet.google.com/abc-defg-hij", request_key: "smoke-1" }),
    });
    const { meeting } = await created.json();
    check("launch bot -> 201 scheduled with bot id", created.status === 201 && meeting.status === "scheduled" && Boolean(meeting.bot_id));

    const recordingId = crypto.randomUUID();
    const deliver = async (payload) => {
      const raw = JSON.stringify(payload);
      return fetch(`${base}/webhooks/recall`, { method: "POST", headers: { "content-type": "application/json", ...signForTest({ secret, payload: raw }) }, body: raw });
    };
    const botRef = { id: meeting.bot_id, metadata: { profilr_meeting_id: meeting.id } };
    const status = (code) => ({ code, sub_code: null, updated_at: new Date().toISOString() });
    check("signed webhook accepted", (await deliver({ event: "bot.in_call_recording", data: { data: status("in_call_recording"), bot: botRef } })).status === 200);
    check(
      "unsigned webhook rejected",
      (await fetch(`${base}/webhooks/recall`, { method: "POST", body: "{}", headers: { "content-type": "application/json" } })).status === 401,
    );
    await deliver({ event: "recording.done", data: { data: status("done"), bot: botRef, recording: { id: recordingId, metadata: {} } } });
    await drainInbox(ctx);
    const transcriptId = [...fake.state.transcripts.keys()][0];
    fake.state.transcripts.get(transcriptId).content = [
      { participant: { id: 1, name: "Smoke Fixture" }, words: [{ text: "Fixture", start_timestamp: { relative: 0 } }, { text: "transcript." }] },
    ];
    await deliver({ event: "transcript.done", data: { data: status("done"), bot: botRef, recording: { id: recordingId }, transcript: { id: transcriptId } } });
    await drainInbox(ctx);

    const detail = await (await fetch(`${base}/api/meetings/${meeting.id}`, { headers: auth })).json();
    check("lifecycle + transcript visible", detail.meeting.status === "in_call_recording" && detail.meeting.transcript?.[0]?.text === "Fixture transcript.");
  } finally {
    await new Promise((r) => server.close(r));
    ctx.db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }

  for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
  return checks.every((c) => c.ok);
}
