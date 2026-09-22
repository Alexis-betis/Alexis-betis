// End-to-end through the real HTTP boundary: user enters a meeting URL ->
// Create Bot -> persisted intent + bot id -> lifecycle webhooks -> transcript.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { setup, serve, statusData } from "./helpers.js";
import { drainInbox } from "../src/services/webhooks.js";

test("user launches a bot and later sees lifecycle + transcript", async (t) => {
  const { ctx, fake } = setup();
  const app = await serve(ctx);
  t.after(app.close);

  const res = await app.call("/api/meetings", { method: "POST", body: { meeting_url: "https://meet.google.com/abc-defg-hij", request_key: "k1" } });
  assert.equal(res.status, 201);
  const { meeting } = await res.json();
  assert.equal(meeting.status, "scheduled");

  const create = fake.state.requests.find((r) => r.method === "POST" && r.path === "/api/v1/bot/");
  assert.equal(create.body.meeting_url, "https://meet.google.com/abc-defg-hij");
  assert.ok(create.body.join_at, "join_at always passed through the scheduling path");
  assert.equal(create.body.bot_name, "Profilr Notetaker");
  assert.equal(create.body.metadata.profilr_meeting_id, meeting.id);
  assert.equal(create.body.chat.on_bot_join.send_to, "everyone");
  const row = ctx.db.prepare("SELECT * FROM meetings WHERE id = ?").get(meeting.id);
  assert.equal(row.bot_id, meeting.bot_id);

  // Double submit with the same request key -> no second bot.
  const again = await (await app.call("/api/meetings", { method: "POST", body: { meeting_url: "https://meet.google.com/abc-defg-hij", request_key: "k1" } })).json();
  assert.equal(again.meeting.id, meeting.id);
  assert.equal(fake.state.requests.filter((r) => r.path === "/api/v1/bot/").length, 1);

  const bot = { id: meeting.bot_id, metadata: { profilr_meeting_id: meeting.id } };
  const recording = { id: crypto.randomUUID(), metadata: {} };
  for (const code of ["joining_call", "in_waiting_room", "in_call_recording"]) {
    assert.equal((await app.deliver({ event: `bot.${code}`, data: { data: statusData(code), bot } })).status, 200);
  }
  await drainInbox(ctx);
  let list = await (await app.call("/api/meetings")).json();
  assert.equal(list.meetings[0].status, "in_call_recording");

  // recording.done delivered twice (retry) -> exactly one transcript job.
  const recDone = { event: "recording.done", data: { data: statusData("done"), bot, recording } };
  await app.deliver(recDone, { msgId: "msg_rec" });
  await app.deliver(recDone, { msgId: "msg_rec" });
  await app.deliver(recDone, { msgId: "msg_rec_redelivery_new_id" });
  await drainInbox(ctx);
  const jobs = fake.state.requests.filter((r) => r.path.endsWith("/create_transcript/"));
  assert.equal(jobs.length, 1);
  assert.deepEqual(jobs[0].body.provider, { recallai_async: { language_code: "auto" } });
  assert.equal(jobs[0].path, `/api/v1/recording/${recording.id}/create_transcript/`);

  const transcriptId = [...fake.state.transcripts.keys()][0];
  fake.state.transcripts.get(transcriptId).content = [
    { participant: { id: 1, name: "Alexis" }, words: [{ text: "Welcome", start_timestamp: { relative: 1.5 } }, { text: "Sam" }, { text: "." }] },
    { participant: { id: 1, name: "Alexis" }, words: [{ text: "Shall", start_timestamp: { relative: 4 } }, { text: "we", start_timestamp: { relative: 4.2 } }, { text: "start?" }] },
    { participant: { id: 2, name: "Sam" }, words: [{ text: "Yes", start_timestamp: { relative: 6 } }] },
  ];
  await app.deliver({ event: "bot.done", data: { data: statusData("done"), bot } });
  await app.deliver({ event: "transcript.done", data: { data: statusData("done"), bot, recording, transcript: { id: transcriptId, metadata: {} } } });
  await drainInbox(ctx);

  const detail = await (await app.call(`/api/meetings/${meeting.id}`)).json();
  assert.equal(detail.meeting.status, "done");
  assert.equal(detail.meeting.transcript_status, "done");
  assert.deepEqual(detail.meeting.transcript, [
    { speaker: "Alexis", start: 1.5, text: "Welcome Sam. Shall we start?" },
    { speaker: "Sam", start: 6, text: "Yes" },
  ]);
});

test("webhooks: unsigned rejected, duplicates stored once, fatal + transcript failure are visible", async (t) => {
  const { ctx } = setup();
  const app = await serve(ctx);
  t.after(app.close);

  assert.equal((await app.call("/webhooks/recall", { method: "POST", body: { event: "bot.done" }, auth: false })).status, 401);
  assert.equal(ctx.db.prepare("SELECT COUNT(*) n FROM webhook_inbox").get().n, 0);

  const { meeting } = await (await app.call("/api/meetings", { method: "POST", body: { meeting_url: "https://zoom.us/j/123456789" } })).json();
  const bot = { id: meeting.bot_id, metadata: {} };
  await app.deliver({ event: "bot.fatal", data: { data: statusData("fatal", { sub_code: "meeting_not_found" }), bot } }, { msgId: "m1" });
  await app.deliver({ event: "bot.fatal", data: { data: statusData("fatal", { sub_code: "meeting_not_found" }), bot } }, { msgId: "m1" });
  assert.equal(ctx.db.prepare("SELECT COUNT(*) n FROM webhook_inbox").get().n, 1);
  await drainInbox(ctx);
  let m = (await (await app.call(`/api/meetings/${meeting.id}`)).json()).meeting;
  assert.equal(m.status, "fatal");
  assert.match(m.error, /meeting_not_found/);

  // Older, out-of-order status must not overwrite the newer one.
  await app.deliver({ event: "bot.joining_call", data: { data: statusData("joining_call", { updated_at: "2000-01-01T00:00:00Z" }), bot } });
  await app.deliver({ event: "transcript.failed", data: { data: statusData("failed", { sub_code: "provider_error" }), bot, recording: { id: "r" }, transcript: { id: "t" } } });
  await drainInbox(ctx);
  m = (await (await app.call(`/api/meetings/${meeting.id}`)).json()).meeting;
  assert.equal(m.status, "fatal");
  assert.equal(m.transcript_status, "failed");
});

test("launch input and Recall failures are reported to the user", async (t) => {
  const { ctx, fake } = setup();
  const app = await serve(ctx);
  t.after(app.close);

  assert.equal((await app.call("/api/meetings", { method: "POST", body: { meeting_url: "https://example.com/x" } })).status, 400);
  assert.equal((await app.call("/api/meetings", { method: "POST", body: { meeting_url: "https://zoom.us/j/1", join_at: "2001-01-01T00:00:00Z" } })).status, 400);
  assert.equal((await app.call("/api/meetings", { auth: false })).status, 401);
  assert.equal(fake.state.requests.length, 0);

  fake.state.failNext.push({ match: (m, p) => p === "/api/v1/bot/", status: 400, body: { meeting_url: ["Meeting URL not supported."] } });
  const res = await app.call("/api/meetings", { method: "POST", body: { meeting_url: "https://zoom.us/j/1" } });
  assert.equal(res.status, 502);
  const { meeting } = await res.json();
  assert.equal(meeting.status, "failed");
  assert.match(meeting.error, /not supported/);
});

test("an unconfirmed create is reconciled from webhook metadata, never re-created", async (t) => {
  const { ctx, fake } = setup();
  const app = await serve(ctx);
  t.after(app.close);
  fake.state.failNext.push({ match: (m, p) => p === "/api/v1/bot/", networkError: true });
  const { meeting } = await (await app.call("/api/meetings", { method: "POST", body: { meeting_url: "https://teams.microsoft.com/l/meetup-join/abc" } })).json();
  assert.equal(meeting.status, "create_unconfirmed");
  assert.equal(meeting.bot_id, null);
  const botId = crypto.randomUUID();
  await app.deliver({ event: "bot.joining_call", data: { data: statusData("joining_call"), bot: { id: botId, metadata: { profilr_meeting_id: meeting.id } } } });
  await drainInbox(ctx);
  const m = (await (await app.call(`/api/meetings/${meeting.id}`)).json()).meeting;
  assert.equal(m.bot_id, botId);
  assert.equal(m.status, "joining_call");
  assert.equal(m.error, null);
  assert.equal(fake.state.requests.filter((r) => r.path === "/api/v1/bot/").length, 1);
});
