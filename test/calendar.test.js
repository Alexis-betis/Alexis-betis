import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { setup, serve } from "./helpers.js";
import { drainInbox } from "../src/services/webhooks.js";

const inHours = (h) => new Date(Date.now() + h * 3600_000).toISOString();

function seed(fake) {
  const calId = crypto.randomUUID();
  fake.state.calendars.set(calId, { id: calId, platform: "google_calendar", platform_email: "recruiter@profilr.example", status: "connected" });
  const mk = (title, over = {}) => {
    const e = {
      id: crypto.randomUUID(), calendar_id: calId, start_time: inHours(24), end_time: inHours(25), meeting_url: "https://meet.google.com/aaa-bbbb-ccc",
      is_deleted: false, raw: { summary: title }, bots: [], updated_at: new Date().toISOString(), ...over,
    };
    fake.state.events.set(e.id, e);
    return e;
  };
  return {
    calId,
    future: mk("Interview: Sam"),
    past: mk("Past sync", { start_time: inHours(-3), end_time: inHours(-2) }),
    deleted: mk("Cancelled interview", { is_deleted: true }),
    noLink: mk("In-person coffee", { meeting_url: null }),
    notOpted: mk("Internal standup", { meeting_url: "https://zoom.us/j/99" }),
  };
}

test("calendar.sync_events syncs (with pagination) and schedules nothing without opt-in", async (t) => {
  const { ctx, fake } = setup();
  const app = await serve(ctx);
  t.after(app.close);
  const s = seed(fake);
  await app.deliver({ event: "calendar.sync_events", data: { calendar_id: s.calId, last_updated_ts: "2000-01-01T00:00:00Z" } });
  await drainInbox(ctx);
  const list = fake.state.requests.filter((r) => r.path === "/api/v2/calendar-events/");
  assert.equal(list.length, 2, "followed `next`");
  assert.match(list[0].search, /updated_at__gte=2000-01-01/);
  assert.equal(ctx.db.prepare("SELECT COUNT(*) n FROM calendar_events").get().n, 5);
  assert.equal(fake.state.requests.filter((r) => r.path.endsWith("/bot/") && r.path.includes("calendar-events")).length, 0);

  const { events } = await (await app.call("/api/calendar-events")).json();
  assert.ok(events.every((e) => e.record === false));
  assert.ok(!events.some((e) => e.id === s.deleted.id), "deleted events hidden");
  const { calendars } = await (await app.call("/api/calendars")).json();
  assert.equal(calendars[0].platform_email, "recruiter@profilr.example");
});

test("opt-in rule: only future, linked, non-deleted, opted-in events get a bot", async (t) => {
  const { ctx, fake } = setup();
  const app = await serve(ctx);
  t.after(app.close);
  const s = seed(fake);
  await (await app.call("/api/calendars/sync", { method: "POST" })).json();

  for (const e of [s.future, s.past, s.deleted, s.noLink]) {
    assert.equal((await app.call(`/api/calendar-events/${e.id}/record`, { method: "POST", body: { enabled: true } })).status, 200);
  }
  const schedules = fake.state.requests.filter((r) => r.method === "POST" && r.path.startsWith("/api/v2/calendar-events/"));
  assert.deepEqual(schedules.map((r) => r.path), [`/api/v2/calendar-events/${s.future.id}/bot/`]);
  const body = schedules[0].body;
  assert.equal(body.deduplication_key, `${s.future.start_time}-${s.future.meeting_url}`);
  assert.equal(body.bot_config.bot_name, "Profilr Notetaker");
  assert.equal(body.bot_config.metadata.calendar_event_id, s.future.id);

  const m = ctx.db.prepare("SELECT * FROM meetings WHERE calendar_event_id = ?").get(s.future.id);
  assert.equal(m.status, "scheduled");
  assert.ok(m.bot_id);
  assert.equal(m.title, "Interview: Sam");
  assert.equal(ctx.db.prepare("SELECT COUNT(*) n FROM meetings WHERE calendar_event_id = ?").get(s.notOpted.id).n, 0);

  // Re-sync without changes: no duplicate scheduling.
  await app.call("/api/calendars/sync", { method: "POST" });
  assert.equal(fake.state.requests.filter((r) => r.method === "POST" && r.path.startsWith("/api/v2/calendar-events/")).length, 1);

  // Event moved -> rescheduled with the new key.
  const moved = fake.state.events.get(s.future.id);
  moved.start_time = inHours(48);
  moved.updated_at = new Date().toISOString();
  await app.deliver({ event: "calendar.sync_events", data: { calendar_id: s.calId, last_updated_ts: new Date(Date.now() - 1000).toISOString() } });
  await drainInbox(ctx);
  const posts = fake.state.requests.filter((r) => r.method === "POST" && r.path.startsWith("/api/v2/calendar-events/"));
  assert.equal(posts.length, 2);
  assert.equal(posts[1].body.deduplication_key, `${moved.start_time}-${moved.meeting_url}`);

  // Event deleted in the calendar -> bot removed.
  moved.is_deleted = true;
  moved.updated_at = new Date().toISOString();
  await app.deliver({ event: "calendar.sync_events", data: { calendar_id: s.calId, last_updated_ts: new Date(Date.now() - 1000).toISOString() } });
  await drainInbox(ctx);
  assert.ok(fake.state.requests.some((r) => r.method === "DELETE" && r.path === `/api/v2/calendar-events/${s.future.id}/bot/`));
  assert.equal(ctx.db.prepare("SELECT status FROM meetings WHERE calendar_event_id = ?").get(s.future.id).status, "cancelled");
});

test("turning Record off unschedules the bot; calendar bot webhooks drive the same meeting row", async (t) => {
  const { ctx, fake } = setup();
  const app = await serve(ctx);
  t.after(app.close);
  const s = seed(fake);
  await app.call("/api/calendars/sync", { method: "POST" });
  await app.call(`/api/calendar-events/${s.future.id}/record`, { method: "POST", body: { enabled: true } });
  const m = ctx.db.prepare("SELECT * FROM meetings WHERE calendar_event_id = ?").get(s.future.id);

  await app.deliver({ event: "bot.joining_call", data: { data: { code: "joining_call", sub_code: null, updated_at: new Date().toISOString() }, bot: { id: m.bot_id, metadata: { profilr_meeting_id: m.id } } } });
  await drainInbox(ctx);
  assert.equal(ctx.db.prepare("SELECT status FROM meetings WHERE id = ?").get(m.id).status, "joining_call");

  // Once the bot is active we do not pull it, but for a scheduled one we do:
  ctx.db.prepare("UPDATE meetings SET status = 'scheduled' WHERE id = ?").run(m.id);
  await app.call(`/api/calendar-events/${s.future.id}/record`, { method: "POST", body: { enabled: false } });
  assert.ok(fake.state.requests.some((r) => r.method === "DELETE" && r.path === `/api/v2/calendar-events/${s.future.id}/bot/`));
  assert.equal(ctx.db.prepare("SELECT status FROM meetings WHERE id = ?").get(m.id).status, "cancelled");
  assert.equal((await app.call(`/api/calendar-events/${crypto.randomUUID()}/record`, { method: "POST", body: { enabled: true } })).status, 404);
});

test("Google OAuth callback forwards only allowed params to the Recall regional callback", async (t) => {
  const { ctx } = setup();
  ctx.config = { ...ctx.config, recall: { ...ctx.config.recall, calendarRegionalCallbackUri: "https://eu-central-1.recall.ai/api/v2/calendar-setup/callback/" } };
  const app = await serve(ctx);
  t.after(app.close);
  const res = await fetch(`${app.base}/oauth/google/callback?state=s1&code=c1&scope=x&evil=1`, { redirect: "manual" });
  assert.equal(res.status, 302);
  const loc = new URL(res.headers.get("location"));
  assert.equal(loc.origin, "https://eu-central-1.recall.ai");
  assert.deepEqual([...loc.searchParams.keys()].sort(), ["code", "state"]);
  const probe = await fetch(`${app.base}/oauth/google/callback?state=s1&recall_calendar_setup_probe=1`, { redirect: "manual" });
  assert.equal(probe.status, 302);
  assert.equal((await fetch(`${app.base}/oauth/google/callback?code=c1`, { redirect: "manual" })).status, 400);
  assert.equal((await fetch(`${app.base}/oauth/google/callback?state=s&code=c&error=e`, { redirect: "manual" })).status, 400);
});
