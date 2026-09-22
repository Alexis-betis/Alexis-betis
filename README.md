# Profilr Notetaker — Recall.ai Meeting Bots

This service sends a Recall.ai meeting bot ("Profilr Notetaker") to video meetings. Bots start in two ways:

1. **Launch now.** A user pastes a meeting link (Zoom, Google Meet, Teams, Webex, GoTo). The link can also get a join time.
2. **Calendar (Google, via Recall Calendar V2).** Connected calendars sync automatically. A user turns **Record** on for individual upcoming meetings.

After the meeting, the recording is transcribed with **Recall.ai Transcription** (`recallai_async`). The speaker-grouped transcript appears in the app.

Recall target: workspace **Profilr** (`014807c0-6c1e-4493-9cda-12711bd49419`), region **EU / `eu-central-1`**. Bots use the v1.11 schema, the only schema this workspace supports.

## Architecture

```
Browser UI (public/index.html) ──Bearer APP_ACCESS_TOKEN──▶ /api/*            (src/app.js)
                                                     │
                   launchAdHocBot ─ persist intent ──┴─▶ RecallClient.createBot  (POST /api/v1/bot/)
                   setRecordOptIn / calendar sync ────▶ RecallClient.scheduleCalendarEventBot (POST/DELETE /api/v2/calendar-events/{id}/bot/)

Recall ──signed webhook──▶ POST /webhooks/recall ─verify raw body─▶ webhook_inbox (SQLite, dedup by webhook-id) ─▶ 200
                                                                        │ worker (src/services/webhooks.js)
   bot.*            → meeting status / failure sub-code
   recording.done   → Create Async Transcript (recallai_async, once per recording)
   transcript.done  → Retrieve Transcript → download → readable transcript stored → visible in UI
   transcript.failed / recording.failed → visible failure
   calendar.sync_events → List Calendar Events (updated_at__gte, follows `next`) → opt-in reconciliation
   calendar.update  → refresh calendar status / platform_email

Google OAuth ──▶ GET /oauth/google/callback ─ forwards only state|code|error|recall_calendar_setup_probe ─▶ Recall regional callback
```

- **Credentials stay on the server.** The API key and verification secret are only read from the environment (`src/config.js`) and injected into `RecallClient`. They are never sent to the browser or written to logs.
- **Retries** (`src/recall/client.js`): a 429 waits for `Retry-After`, 503 waits about 10s and 507 waits about 30s, each plus jitter. Idempotent calls also retry on network errors. A Create Bot call that dies mid-flight is **not** retried; the meeting is marked `create_unconfirmed`. Every bot carries `metadata.profilr_meeting_id`, so the bot's first status webhook links the bot back to its meeting.
- **Idempotency.** A `request_key` from the UI turns double-submits into one bot. Webhooks are de-duplicated by `webhook-id`. Each recording gets one transcript claim. Calendar scheduling uses Recall's `deduplication_key` (`{start_time}-{meeting_url}`).
- **Logs** hold event names, IDs and outcomes only. They never contain request bodies, signature headers, keys or transcript text.

### Calendar recording opt-in rule (confirmed)

Connecting a calendar only syncs events. A calendar meeting gets a bot only when all of these hold:

- a user has turned **Record** on for that event;
- the event is not deleted;
- it has a meeting link;
- it has not started yet.

When an event moves, the bot is rescheduled. When an event is deleted or Record is turned off, the pending bot is removed. Bots that are already in progress, and past meetings, are left alone. `test/calendar.test.js` covers the rule.

## Configuration

| Variable | Required | Notes |
|---|---|---|
| `RECALL_REGION` | yes | `eu-central-1` |
| `RECALL_API_KEY` | yes | REST key for the Profilr workspace; host secret store only |
| `RECALL_WEBHOOK_VERIFICATION_SECRET` | yes | Workspace verification secret (`whsec_…`). This workspace uses the workspace secret for dashboard webhooks. |
| `PUBLIC_API_BASE_URL` | yes | Stable public https origin of this backend |
| `APP_ACCESS_TOKEN` | yes | ≥16 chars; the UI/API bearer token |
| `RECALL_CALENDAR_REGIONAL_CALLBACK_URI` | for calendar setup | Regional callback returned by the Recall Calendar V2 setup action |
| `DATABASE_PATH` | no | SQLite file; put it on a persistent volume |
| `PORT`, `BOT_NAME` | no | defaults `3000`, `Profilr Notetaker` |

## Run and test

```bash
npm test          # unit + HTTP-boundary tests (fake Recall injected as fetch)
npm run smoke     # boots the production server on loopback with a labelled fake Recall backend
npm start         # real server; requires the variables above
docker build -t profilr-notetaker . && docker run -p 3000:3000 -v profilr-data:/data --env-file .env profilr-notetaker
```

Node ≥ 22.13 is required (`node:sqlite`). There are no npm dependencies.

## Recall-side setup (Profilr / eu-central-1)

1. **Webhook endpoint:** `${PUBLIC_API_BASE_URL}/webhooks/recall`. Subscribed events: `bot.*` lifecycle, `recording.done`, `recording.failed`, `transcript.done`, `transcript.failed`, `calendar.update` and `calendar.sync_events`.
2. **Google Calendar V2:** a dedicated Google Web OAuth client with redirect URI `${PUBLIC_API_BASE_URL}/oauth/google/callback`. The redirect forwards to Recall's regional callback. Scopes: `calendar.events.readonly` and `userinfo.email`. For durable refresh tokens, publish the Google app to **In production**. Refresh tokens from External apps left in **Testing** expire after 7 days.

See `SETUP_STATUS.md` for what has been done in the workspace so far and what remains.
