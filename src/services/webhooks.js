import { nowIso, tx } from "../db.js";
import { RecallAmbiguousError, RecallApiError } from "../recall/client.js";
import { describeRecallError } from "./bots.js";
import { syncCalendarEvents, upsertCalendar } from "./calendar.js";

/** Durable enqueue; duplicate deliveries (same webhook-id) are ignored. */
export function enqueueWebhook(db, webhookId, eventType, rawBody) {
  const ts = nowIso();
  const res = db
    .prepare(
      `INSERT OR IGNORE INTO webhook_inbox (webhook_id, event_type, payload, next_attempt_at, received_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(webhookId, eventType, rawBody, ts, ts);
  return res.changes === 1;
}

/** Convert Recall's transcript download JSON into speaker-grouped paragraphs. */
export function toReadableTranscript(parts) {
  const out = [];
  for (const part of parts ?? []) {
    const words = part.words ?? [];
    if (!words.length) continue;
    const speaker = part.participant?.name || `Speaker ${part.participant?.id ?? "?"}`;
    const text = words.map((w) => w.text).join(" ").replace(/\s+([,.!?;:])/g, "$1").trim();
    const start = words[0].start_timestamp?.relative ?? null;
    const prev = out.at(-1);
    if (prev && prev.speaker === speaker) prev.text += ` ${text}`;
    else out.push({ speaker, start, text });
  }
  return out;
}

function findMeetings(db, { botId, metadata, recordingId }) {
  let rows = [];
  if (botId) rows = db.prepare("SELECT * FROM meetings WHERE bot_id = ?").all(botId);
  if (!rows.length && metadata?.profilr_meeting_id) {
    rows = db.prepare("SELECT * FROM meetings WHERE id = ?").all(metadata.profilr_meeting_id);
    // Reconcile an unconfirmed create or a calendar bot whose id we have not stored yet.
    if (botId) for (const r of rows) db.prepare("UPDATE meetings SET bot_id = ? WHERE id = ? AND bot_id IS NULL").run(botId, r.id);
  }
  if (!rows.length && recordingId) rows = db.prepare("SELECT * FROM meetings WHERE recording_id = ?").all(recordingId);
  return rows;
}

const setMeeting = (db, id, fields) => {
  const cols = Object.keys(fields);
  db.prepare(`UPDATE meetings SET ${cols.map((c) => `${c} = ?`).join(", ")}, updated_at = ? WHERE id = ?`).run(
    ...cols.map((c) => fields[c]),
    nowIso(),
    id,
  );
};

export async function processWebhook(ctx, payload) {
  const { db, recall, log } = ctx;
  const event = payload?.event ?? "";
  const data = payload?.data ?? {};
  const status = data.data ?? {};

  if (event.startsWith("bot.")) {
    const code = event.slice(4);
    const rows = findMeetings(db, { botId: data.bot?.id, metadata: data.bot?.metadata });
    for (const m of rows) {
      // Ignore out-of-order deliveries older than the status we already hold.
      if (m.status_updated_at && status.updated_at && status.updated_at < m.status_updated_at) continue;
      const fields = { status: code, status_sub_code: status.sub_code ?? null, status_updated_at: status.updated_at ?? nowIso() };
      if (code === "fatal") fields.error = `Bot failed: ${status.sub_code ?? "unknown"}`;
      else if (m.status === "create_unconfirmed") fields.error = null;
      setMeeting(db, m.id, fields);
    }
    log("webhook.bot_status", { code, matched: rows.length });
    return;
  }

  if (event === "recording.done") {
    const recordingId = data.recording?.id;
    const rows = findMeetings(db, { botId: data.bot?.id, metadata: data.bot?.metadata, recordingId });
    if (!rows.length || !recordingId) return log("webhook.unmatched", { event_type: event });
    // Claim once per recording so duplicate deliveries never create a second transcript.
    const claimed = tx(db, () => {
      const already = db.prepare("SELECT 1 FROM meetings WHERE recording_id = ? AND transcript_status IS NOT NULL").get(recordingId);
      for (const m of rows) setMeeting(db, m.id, { recording_id: recordingId, ...(already ? {} : { transcript_status: "requested" }) });
      return !already;
    });
    if (!claimed) return log("webhook.recording_duplicate", {});
    try {
      const t = await recall.createAsyncTranscript(recordingId);
      for (const m of rows) setMeeting(db, m.id, { transcript_id: t.id, transcript_status: "processing" });
      log("transcript.requested", { recording_id: recordingId });
    } catch (err) {
      if (!(err instanceof RecallApiError)) {
        // Unexpected local error before Recall answered: release the claim so the retry can request again.
        for (const m of rows) setMeeting(db, m.id, { transcript_status: null });
        throw err;
      }
      const unconfirmed = err instanceof RecallAmbiguousError;
      for (const m of rows)
        setMeeting(db, m.id, {
          transcript_status: unconfirmed ? "request_unconfirmed" : "failed",
          error: unconfirmed ? "Transcript request not confirmed; waiting for transcript webhook." : `Transcription request failed: ${describeRecallError(err)}`,
        });
    }
    return;
  }

  if (event === "recording.failed") {
    const rows = findMeetings(db, { botId: data.bot?.id, metadata: data.bot?.metadata, recordingId: data.recording?.id });
    for (const m of rows) setMeeting(db, m.id, { transcript_status: "no_recording", error: `Recording failed: ${status.sub_code ?? "unknown"}` });
    return;
  }

  if (event === "transcript.done" || event === "transcript.failed") {
    const transcriptId = data.transcript?.id;
    const rows = findMeetings(db, { botId: data.bot?.id, metadata: data.bot?.metadata, recordingId: data.recording?.id });
    if (!rows.length) return log("webhook.unmatched", { event_type: event });
    if (event === "transcript.failed") {
      for (const m of rows) setMeeting(db, m.id, { transcript_id: transcriptId, transcript_status: "failed", error: `Transcription failed: ${status.sub_code ?? "unknown"}` });
      return;
    }
    const transcript = await recall.getTranscript(transcriptId);
    const url = transcript?.data?.download_url;
    if (!url) throw new Error("transcript has no download_url yet");
    const segments = toReadableTranscript(await recall.download(url));
    tx(db, () => {
      for (const m of rows) {
        db.prepare(
          `INSERT INTO transcripts (meeting_id, transcript_id, segments, created_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(meeting_id) DO UPDATE SET transcript_id = excluded.transcript_id, segments = excluded.segments`,
        ).run(m.id, transcriptId, JSON.stringify(segments), nowIso());
        setMeeting(db, m.id, { transcript_id: transcriptId, transcript_status: "done", recording_id: data.recording?.id ?? m.recording_id, error: null });
      }
    });
    log("transcript.stored", { meetings: rows.length, segments: segments.length });
    return;
  }

  if (event === "calendar.sync_events") {
    await syncCalendarEvents(ctx, data.calendar_id, { updatedAtGte: data.last_updated_ts });
    return;
  }
  if (event === "calendar.update") {
    await upsertCalendar(ctx, data.calendar_id);
    return;
  }
  log("webhook.ignored", { event_type: event });
}

const MAX_ATTEMPTS = 8;

/** Process due inbox rows. Returns the number handled. */
export async function drainInbox(ctx, { limit = 20 } = {}) {
  const { db, log } = ctx;
  const due = db
    .prepare("SELECT * FROM webhook_inbox WHERE status = 'pending' AND next_attempt_at <= ? ORDER BY received_at LIMIT ?")
    .all(nowIso(), limit);
  for (const row of due) {
    try {
      await processWebhook(ctx, JSON.parse(row.payload));
      db.prepare("UPDATE webhook_inbox SET status = 'done', processed_at = ?, attempts = attempts + 1 WHERE webhook_id = ?").run(nowIso(), row.webhook_id);
    } catch (err) {
      const attempts = row.attempts + 1;
      const giveUp = attempts >= MAX_ATTEMPTS;
      const next = new Date(Date.now() + Math.min(3600_000, 5_000 * 2 ** attempts)).toISOString();
      db.prepare("UPDATE webhook_inbox SET status = ?, attempts = ?, next_attempt_at = ?, last_error = ? WHERE webhook_id = ?").run(
        giveUp ? "failed" : "pending", attempts, next, String(err?.message ?? err).slice(0, 300), row.webhook_id,
      );
      log("webhook.process_error", { webhook_id: row.webhook_id, event_type: row.event_type, attempts, give_up: giveUp });
    }
  }
  return due.length;
}

export function startWorker(ctx, { intervalMs = 1000 } = {}) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await drainInbox(ctx);
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
