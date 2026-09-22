import crypto from "node:crypto";
import { nowIso } from "../db.js";
import { RecallAmbiguousError, RecallApiError } from "../recall/client.js";

export class UserInputError extends Error {}

const SUPPORTED_HOSTS = [
  /(^|\.)zoom\.us$/,
  /(^|\.)zoomgov\.com$/,
  /^meet\.google\.com$/,
  /^teams\.microsoft\.com$/,
  /^teams\.live\.com$/,
  /(^|\.)webex\.com$/,
  /(^|\.)gotomeeting\.com$/,
  /^meet\.goto\.com$/,
];

export function normalizeMeetingUrl(input) {
  let url;
  try {
    url = new URL(String(input ?? "").trim());
  } catch {
    throw new UserInputError("Enter a full meeting link, e.g. https://meet.google.com/abc-defg-hij");
  }
  if (url.protocol !== "https:") throw new UserInputError("Meeting links must use https");
  if (!SUPPORTED_HOSTS.some((re) => re.test(url.hostname.toLowerCase()))) {
    throw new UserInputError("Supported platforms: Zoom, Google Meet, Microsoft Teams, Webex, GoTo Meeting");
  }
  return url.toString();
}

function normalizeJoinAt(input, now = Date.now()) {
  if (input == null || input === "") return new Date(now).toISOString();
  const t = Date.parse(input);
  if (Number.isNaN(t)) throw new UserInputError("join_at must be an ISO 8601 date-time");
  if (t < now - 60_000) throw new UserInputError("join_at is in the past");
  return new Date(t).toISOString();
}

/** Create Bot request body shared by ad-hoc and calendar scheduling. */
export function buildBotConfig({ botName, meetingUrl, joinAt, metadata }) {
  const cfg = {
    bot_name: botName,
    metadata,
    chat: {
      on_bot_join: {
        send_to: "everyone",
        message: `${botName} is recording this meeting to produce notes and a transcript for Profilr.`,
        pin: true,
      },
    },
  };
  if (meetingUrl) cfg.meeting_url = meetingUrl;
  if (joinAt) cfg.join_at = joinAt;
  return cfg;
}

export function describeRecallError(err) {
  const body = err?.body;
  if (body && typeof body === "object") {
    const flat = Object.entries(body)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : typeof v === "string" ? v : JSON.stringify(v)}`)
      .join("; ");
    return flat.slice(0, 300) || err.message;
  }
  return err?.message ?? "Unknown error";
}

/**
 * User-driven ad-hoc launch. Persists the intent first, then creates the bot.
 * `requestKey` makes double-submits return the same meeting instead of a second bot.
 */
export async function launchAdHocBot({ db, recall, config, log }, { meetingUrl, joinAt, requestKey }) {
  const url = normalizeMeetingUrl(meetingUrl);
  const at = normalizeJoinAt(joinAt);
  const key = String(requestKey || "").trim() || crypto.randomUUID();
  if (key.length > 100) throw new UserInputError("request_key too long");

  const existing = db.prepare("SELECT * FROM meetings WHERE request_key = ?").get(key);
  if (existing) return existing;

  const id = crypto.randomUUID();
  const ts = nowIso();
  db.prepare(
    `INSERT INTO meetings (id, request_key, source, meeting_url, join_at, status, created_at, updated_at)
     VALUES (?, ?, 'adhoc', ?, ?, 'scheduling', ?, ?)`,
  ).run(id, key, url, at, ts, ts);

  const update = (fields) => {
    const cols = Object.keys(fields);
    db.prepare(`UPDATE meetings SET ${cols.map((c) => `${c} = ?`).join(", ")}, updated_at = ? WHERE id = ?`).run(
      ...cols.map((c) => fields[c]),
      nowIso(),
      id,
    );
  };

  try {
    const bot = await recall.createBot(
      buildBotConfig({ botName: config.botName, meetingUrl: url, joinAt: at, metadata: { profilr_meeting_id: id, source: "adhoc" } }),
    );
    update({ bot_id: bot.id, status: "scheduled" });
    log("bot.created", { meeting_id: id, bot_id: bot.id });
  } catch (err) {
    if (err instanceof RecallAmbiguousError) {
      // Do not retry: a bot may exist. Its status webhooks carry profilr_meeting_id and reconcile this row.
      update({ status: "create_unconfirmed", error: "Recall did not confirm bot creation; waiting for its status webhook." });
      log("bot.create_unconfirmed", { meeting_id: id });
    } else if (err instanceof RecallApiError) {
      update({ status: "failed", error: describeRecallError(err) });
      log("bot.create_failed", { meeting_id: id, status: err.status });
    } else {
      update({ status: "failed", error: "Internal error while creating bot" });
      throw err;
    }
  }
  return db.prepare("SELECT * FROM meetings WHERE id = ?").get(id);
}
