import crypto from "node:crypto";
import fs from "node:fs";
import { verifyRequestFromRecall, VerificationError } from "./recall/verify.js";
import { RecallApiError } from "./recall/client.js";
import { describeRecallError, launchAdHocBot, UserInputError } from "./services/bots.js";
import { setRecordOptIn, syncCalendarEvents } from "./services/calendar.js";
import { enqueueWebhook } from "./services/webhooks.js";
import { requeueAnalysis } from "./services/analysis.js";
import { detectPlatform, normalizeMeetingType } from "./services/bots.js";

const INDEX_HTML = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const MAX_BODY = 1024 * 1024;
const FORWARDED_CALLBACK_PARAMS = ["state", "code", "error", "recall_calendar_setup_probe"];

async function readRawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error("body too large"), { statusCode: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== "string";
  res.writeHead(status, {
    "content-type": isJson ? "application/json; charset=utf-8" : "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

function lowerHeaders(req) {
  return Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(",") : v]));
}

function authorized(req, token) {
  const got = Buffer.from(String(req.headers.authorization ?? ""));
  const want = Buffer.from(`Bearer ${token}`);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

function meetingView(db, m, { withTranscript = false } = {}) {
  const a = db.prepare("SELECT kind, status, result, model, error, export_status, updated_at FROM analyses WHERE meeting_id = ?").get(m.id);
  const view = {
    id: m.id,
    source: m.source,
    title: m.title,
    meeting_type: m.meeting_type,
    subject_ref: m.subject_ref,
    subject_label: m.subject_label,
    platform: detectPlatform(m.meeting_url),
    meeting_url: m.meeting_url,
    join_at: m.join_at,
    status: m.status,
    status_sub_code: m.status_sub_code,
    bot_id: m.bot_id,
    transcript_status: m.transcript_status,
    error: m.error,
    created_at: m.created_at,
    updated_at: m.updated_at,
  };
  view.analysis = a ? { kind: a.kind, status: a.status, error: a.error, export_status: a.export_status, model: a.model, updated_at: a.updated_at } : null;
  if (withTranscript) {
    const t = db.prepare("SELECT segments FROM transcripts WHERE meeting_id = ?").get(m.id);
    view.transcript = t ? JSON.parse(t.segments) : null;
    if (view.analysis) view.analysis.result = a.result ? JSON.parse(a.result) : null;
  }
  return view;
}

/**
 * Build the HTTP request handler. `ctx` = { db, recall, config, log }.
 */
export function createApp(ctx) {
  const { db, config, log } = ctx;

  return async function handler(req, res) {
    const url = new URL(req.url, "http://internal");
    const route = `${req.method} ${url.pathname}`;
    try {
      // ---- Recall-facing routes (signature / forwarding, no app token) ----
      if (route === "POST /webhooks/recall") {
        const raw = await readRawBody(req);
        let webhookId;
        try {
          ({ webhookId } = verifyRequestFromRecall({ secret: config.recall.verificationSecret, headers: lowerHeaders(req), payload: raw }));
        } catch (err) {
          if (!(err instanceof VerificationError)) throw err;
          log("webhook.rejected", { reason: err.message });
          return send(res, 401, { error: "invalid signature" });
        }
        let eventType;
        try {
          eventType = JSON.parse(raw)?.event;
        } catch {
          return send(res, 400, { error: "invalid json" });
        }
        const fresh = enqueueWebhook(db, webhookId, String(eventType ?? "unknown"), raw);
        log("webhook.accepted", { webhook_id: webhookId, event_type: eventType, duplicate: !fresh });
        return send(res, 200, { ok: true });
      }

      if (route === "GET /oauth/google/callback") {
        const target = config.recall.calendarRegionalCallbackUri;
        if (!target) return send(res, 503, { error: "calendar callback not configured" });
        const forward = new URL(target);
        for (const name of FORWARDED_CALLBACK_PARAMS) {
          const v = url.searchParams.get(name);
          if (v != null) forward.searchParams.set(name, v);
        }
        const hasState = forward.searchParams.has("state");
        const outcomes = ["code", "error", "recall_calendar_setup_probe"].filter((n) => forward.searchParams.has(n));
        if (!hasState || outcomes.length !== 1) return send(res, 400, { error: "invalid calendar callback" });
        log("calendar.callback_forwarded", { kind: outcomes[0] });
        return send(res, 302, "", { location: forward.toString() });
      }

      if (route === "GET /healthz") return send(res, 200, { ok: true });
      if (route === "GET /" || route === "GET /index.html") return send(res, 200, INDEX_HTML);

      // ---- Profilr app API (bearer token) ----
      if (url.pathname.startsWith("/api/")) {
        if (!authorized(req, config.accessToken)) return send(res, 401, { error: "unauthorized" });

        if (route === "GET /api/meetings") {
          const rows = db.prepare("SELECT * FROM meetings ORDER BY join_at DESC LIMIT 100").all();
          return send(res, 200, { meetings: rows.map((m) => meetingView(db, m)) });
        }
        if (route === "POST /api/meetings") {
          const body = JSON.parse((await readRawBody(req)) || "{}");
          const m = await launchAdHocBot(ctx, {
            meetingUrl: body.meeting_url,
            joinAt: body.join_at,
            requestKey: body.request_key,
            meetingType: body.meeting_type,
            subjectRef: body.subject_ref,
            subjectLabel: body.subject_label,
          });
          return send(res, m.status === "failed" ? 502 : 201, { meeting: meetingView(db, m) });
        }
        const mm = url.pathname.match(/^\/api\/meetings\/([0-9a-f-]{36})$/);
        if (req.method === "GET" && mm) {
          const m = db.prepare("SELECT * FROM meetings WHERE id = ?").get(mm[1]);
          return m ? send(res, 200, { meeting: meetingView(db, m, { withTranscript: true }) }) : send(res, 404, { error: "not found" });
        }

        const am = url.pathname.match(/^\/api\/meetings\/([0-9a-f-]{36})\/analysis$/);
        if (req.method === "POST" && am) {
          // Re-run the analysis, optionally after correcting the meeting type.
          const body = JSON.parse((await readRawBody(req)) || "{}");
          const m = db.prepare("SELECT * FROM meetings WHERE id = ?").get(am[1]);
          if (!m) return send(res, 404, { error: "not found" });
          if (body.meeting_type) db.prepare("UPDATE meetings SET meeting_type = ? WHERE id = ?").run(normalizeMeetingType(body.meeting_type), m.id);
          if (!db.prepare("SELECT 1 FROM transcripts WHERE meeting_id = ?").get(m.id)) return send(res, 409, { error: "no transcript yet" });
          const queued = requeueAnalysis(db, m.id);
          const fresh = db.prepare("SELECT * FROM meetings WHERE id = ?").get(m.id);
          return send(res, 202, { queued, meeting: meetingView(db, fresh) });
        }

        if (route === "GET /api/calendars") {
          return send(res, 200, { calendars: db.prepare("SELECT id, platform, platform_email, status, last_synced_at FROM calendars").all() });
        }
        if (route === "POST /api/calendars/sync") {
          const cals = await ctx.recall.listCalendars();
          const results = [];
          for (const c of cals) if (c.status === "connected") results.push({ id: c.id, ...(await syncCalendarEvents(ctx, c.id)) });
          return send(res, 200, { synced: results });
        }
        if (route === "GET /api/calendar-events") {
          const rows = db
            .prepare(
              `SELECT e.*, c.platform_email, m.id AS meeting_id, m.status AS bot_status
               FROM calendar_events e LEFT JOIN calendars c ON c.id = e.calendar_id
               LEFT JOIN meetings m ON m.calendar_event_id = e.id
               WHERE e.is_deleted = 0 AND e.start_time >= ? ORDER BY e.start_time LIMIT 200`,
            )
            .all(new Date(Date.now() - 12 * 3600_000).toISOString());
          return send(res, 200, { events: rows.map((r) => ({ ...r, record: Boolean(r.record), is_deleted: Boolean(r.is_deleted) })) });
        }
        const em = url.pathname.match(/^\/api\/calendar-events\/([0-9a-f-]{36})\/record$/);
        if (req.method === "POST" && em) {
          const body = JSON.parse((await readRawBody(req)) || "{}");
          const evt = await setRecordOptIn(ctx, em[1], Boolean(body.enabled), { meetingType: body.meeting_type, subjectLabel: body.subject_label });
          return evt ? send(res, 200, { event: { ...evt, record: Boolean(evt.record) } }) : send(res, 404, { error: "not found" });
        }
      }

      return send(res, 404, { error: "not found" });
    } catch (err) {
      if (err instanceof UserInputError) return send(res, 400, { error: err.message });
      if (err instanceof SyntaxError) return send(res, 400, { error: "invalid json" });
      if (err?.statusCode === 413) return send(res, 413, { error: "body too large" });
      if (err instanceof RecallApiError) return send(res, 502, { error: `Recall: ${describeRecallError(err)}` });
      log("http.error", { route, error: err?.message?.slice(0, 200) });
      return send(res, 500, { error: "internal error" });
    }
  };
}
