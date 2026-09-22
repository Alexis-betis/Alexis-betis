import crypto from "node:crypto";
import { nowIso } from "../db.js";
import { buildBotConfig, describeRecallError } from "./bots.js";

// Opt-in rule (confirmed with the product owner): nothing on a connected calendar
// is recorded unless a user explicitly turns "Record" on for that event. An event
// gets a bot only while it is opted in, not deleted, has a meeting link, and has
// not started yet.
export function isEligible(evt, now = Date.now()) {
  return Boolean(evt.record) && !evt.is_deleted && Boolean(evt.meeting_url) && Date.parse(evt.start_time) > now;
}

export function scheduleKey(evt) {
  // Recall-recommended dedup: one bot per (start time, meeting link) across calendars.
  return `${evt.start_time}-${evt.meeting_url}`;
}

function eventTitle(raw) {
  return raw?.summary ?? raw?.subject ?? null;
}

export async function upsertCalendar({ db, recall }, calendarId) {
  const cal = await recall.getCalendar(calendarId);
  db.prepare(
    `INSERT INTO calendars (id, platform, platform_email, status, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET platform = excluded.platform, platform_email = excluded.platform_email,
       status = excluded.status, updated_at = excluded.updated_at`,
  ).run(cal.id, cal.platform ?? null, cal.platform_email ?? null, cal.status ?? null, nowIso());
  return cal;
}

/** Handle calendar.sync_events (or a manual full sync when updatedAtGte is omitted). */
export async function syncCalendarEvents(ctx, calendarId, { updatedAtGte } = {}) {
  const { db, recall, log } = ctx;
  await upsertCalendar(ctx, calendarId);
  const events = await recall.listCalendarEvents(calendarId, { updatedAtGte });
  const upsert = db.prepare(
    `INSERT INTO calendar_events (id, calendar_id, title, start_time, end_time, meeting_url, is_deleted, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, start_time = excluded.start_time, end_time = excluded.end_time,
       meeting_url = excluded.meeting_url, is_deleted = excluded.is_deleted, updated_at = excluded.updated_at`,
  );
  for (const e of events) {
    upsert.run(e.id, calendarId, eventTitle(e.raw), e.start_time, e.end_time ?? null, e.meeting_url ?? null, e.is_deleted ? 1 : 0, nowIso());
  }
  db.prepare("UPDATE calendars SET last_synced_at = ? WHERE id = ?").run(nowIso(), calendarId);
  let changed = 0;
  for (const e of events) changed += (await reconcileEvent(ctx, e.id)) ? 1 : 0;
  log("calendar.synced", { calendar_id: calendarId, events: events.length, bot_changes: changed });
  return { events: events.length, botChanges: changed };
}

export async function setRecordOptIn(ctx, eventId, enabled) {
  const res = ctx.db.prepare("UPDATE calendar_events SET record = ?, updated_at = ? WHERE id = ?").run(enabled ? 1 : 0, nowIso(), eventId);
  if (res.changes === 0) return null;
  await reconcileEvent(ctx, eventId);
  return ctx.db.prepare("SELECT * FROM calendar_events WHERE id = ?").get(eventId);
}

/**
 * Converge Recall's scheduled bot for one event with the opt-in rule.
 * Returns true when a Recall schedule/unschedule call was made.
 */
export async function reconcileEvent({ db, recall, config, log }, eventId, now = Date.now()) {
  const evt = db.prepare("SELECT * FROM calendar_events WHERE id = ?").get(eventId);
  if (!evt) return false;
  const meeting = db.prepare("SELECT * FROM meetings WHERE calendar_event_id = ?").get(eventId);
  const ts = nowIso();

  if (isEligible(evt, now)) {
    const key = scheduleKey(evt);
    if (meeting?.status === "scheduled" && meeting.schedule_key === key && meeting.bot_id) return false;

    const meetingId = meeting?.id ?? crypto.randomUUID();
    if (!meeting) {
      db.prepare(
        `INSERT INTO meetings (id, source, calendar_event_id, title, meeting_url, join_at, status, created_at, updated_at)
         VALUES (?, 'calendar', ?, ?, ?, ?, 'scheduling', ?, ?)`,
      ).run(meetingId, eventId, evt.title, evt.meeting_url, evt.start_time, ts, ts);
    } else {
      db.prepare("UPDATE meetings SET title = ?, meeting_url = ?, join_at = ?, status = 'scheduling', error = NULL, updated_at = ? WHERE id = ?").run(
        evt.title, evt.meeting_url, evt.start_time, ts, meetingId,
      );
    }
    try {
      const updated = await recall.scheduleCalendarEventBot(eventId, {
        deduplicationKey: key,
        botConfig: buildBotConfig({
          botName: config.botName,
          metadata: { profilr_meeting_id: meetingId, source: "calendar", calendar_event_id: eventId },
        }),
      });
      const bot = (updated?.bots ?? []).find((b) => b.deduplication_key === key) ?? updated?.bots?.at(-1);
      db.prepare("UPDATE meetings SET status = 'scheduled', bot_id = ?, schedule_key = ?, updated_at = ? WHERE id = ?").run(
        bot?.bot_id ?? bot?.id ?? null, key, nowIso(), meetingId,
      );
      log("calendar.bot_scheduled", { calendar_event_id: eventId, meeting_id: meetingId });
    } catch (err) {
      db.prepare("UPDATE meetings SET status = 'failed', error = ?, updated_at = ? WHERE id = ?").run(describeRecallError(err), nowIso(), meetingId);
      log("calendar.bot_schedule_failed", { calendar_event_id: eventId, status: err.status ?? null });
      throw err;
    }
    return true;
  }

  // Not eligible: remove a still-pending bot for a future event; leave past/in-progress meetings alone.
  if (meeting && ["scheduled", "scheduling", "failed"].includes(meeting.status) && Date.parse(evt.start_time) > now) {
    if (meeting.status !== "failed") await recall.unscheduleCalendarEventBot(eventId);
    db.prepare("UPDATE meetings SET status = 'cancelled', schedule_key = NULL, updated_at = ? WHERE id = ?").run(nowIso(), meeting.id);
    log("calendar.bot_unscheduled", { calendar_event_id: eventId, meeting_id: meeting.id });
    return true;
  }
  return false;
}
