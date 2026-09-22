# Recall setup status: Profilr (`014807c0-6c1e-4493-9cda-12711bd49419`), eu-central-1

Checked 2026-09-22 through Recall MCP (`get_info`).

- Workspace: **Profilr** (organization Profilr). The MCP connection is bound to `eu-central-1`.
- Bot schema: v1.11 only, with no legacy compatibility.
- Dashboard webhook secret source: workspace verification secret.

## State before this integration (read-only inspection)

| Resource | State |
|---|---|
| REST API keys | none |
| Webhook endpoints | none |
| Calendar V2 calendars / provider apps | none (`start_new_setup` recommended for Google) |
| Bots | none |

## Product decisions

- **Meeting Bots**, with post-meeting **Recall.ai Transcription** (`recallai_async`). There is no third-party transcription vendor.
- **Calendar provider:** Google Calendar through Recall Calendar V2.
- **Opt-in rule:** nothing is recorded unless a user turns Record on for that event.
- **Hosting:** a public deploy URL, supplied by the owner.

## Remaining steps

- [ ] Deploy backend and provide `PUBLIC_API_BASE_URL`
- [ ] Create REST key `profilr-notetaker-backend-eu` and place it in the host secret store as `RECALL_API_KEY`
- [ ] Place the workspace verification secret in the host as `RECALL_WEBHOOK_VERIFICATION_SECRET`
- [ ] Create webhook endpoint `${PUBLIC_API_BASE_URL}/webhooks/recall`, send a test event, and confirm a verified 200
- [ ] Start Google Calendar V2 setup, create the Google OAuth client, pass the callback probe, and authorize the first mailbox
- [ ] Confirm the calendar is `connected`, `platform_email` is shown, the initial sync is done, and `ready_for_testing`
- [ ] Live test with a real meeting URL (only after explicit confirmation)
