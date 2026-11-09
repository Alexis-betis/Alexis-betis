// transcript.done -> stored transcript -> Claude analysis (fake injected) ->
// result visible in the API -> signed export to Profilr.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { setup, serve, statusData } from "./helpers.js";
import { drainInbox } from "../src/services/webhooks.js";
import { drainAnalyses, INTERVIEW_NOTES_SCHEMA, JOB_BRIEF_SCHEMA, formatTranscript } from "../src/services/analysis.js";
import { createClaudeAnalyzer, AnalysisRefusedError } from "../src/llm/claude.js";
import { detectPlatform } from "../src/services/bots.js";

const NOTES = {
  summary: "Développeuse backend senior, 7 ans d'expérience, motivée par un produit B2B.",
  candidate_name: "Sam Martin", current_role: "Lead dev chez Acme",
  motivations: ["Impact produit"], strengths: [{ point: "Expérience Kubernetes", quote: "j'ai migré nos 40 services", timestamp: "03:12" }],
  concerns: [], skills: [{ skill: "Go", evidence: "demonstrated" }], salary_current: "65k", salary_expectations: "75k",
  availability: "Préavis 2 mois", location_and_remote: "Lyon, 2 jours sur site", other_processes: null, next_steps: ["Entretien technique"], open_questions: [],
};
const BRIEF = {
  job_title: "Lead Data Engineer", company_name: "Client SA", summary: "Structurer l'équipe data.", seniority: "Senior", location: "Paris",
  remote_policy: "3 jours télétravail", contract_type: "CDI", salary_range: "70-85k", responsibilities: ["Encadrer 3 personnes"],
  must_have_skills: ["Spark"], nice_to_have_skills: ["dbt"], dealbreakers: [], team_context: null, hiring_process: ["2 entretiens"],
  timeline: "Avant mars", open_questions: ["Budget variable ?"], search_keywords: { job_titles: ["Lead Data Engineer", "Data Engineering Manager"], skills: ["Spark"], target_companies: [] },
};

function fakeAnalyzer(outputs) {
  const calls = [];
  return {
    calls,
    async complete(args) {
      calls.push(args);
      const next = outputs.shift();
      if (next instanceof Error) throw next;
      return { output: next, model: "claude-opus-5-5" };
    },
  };
}

async function meetingWithTranscript(app, ctx, fake, body) {
  const { meeting } = await (await app.call("/api/meetings", { method: "POST", body: { meeting_url: "https://meet.google.com/abc-defg-hij", ...body } })).json();
  const bot = { id: meeting.bot_id, metadata: { profilr_meeting_id: meeting.id } };
  const recording = { id: crypto.randomUUID() };
  await app.deliver({ event: "recording.done", data: { data: statusData("done"), bot, recording } });
  await drainInbox(ctx);
  const transcriptId = [...fake.state.transcripts.values()].find((t) => t.recording_id === recording.id).id;
  fake.state.transcripts.get(transcriptId).content = [
    { participant: { name: "Recruteur" }, words: [{ text: "Parlez-moi", start_timestamp: { relative: 2 } }, { text: "de vous." }] },
    { participant: { name: "Sam" }, words: [{ text: "J'ai", start_timestamp: { relative: 192 } }, { text: "migré nos 40 services." }] },
  ];
  await app.deliver({ event: "transcript.done", data: { data: statusData("done"), bot, recording, transcript: { id: transcriptId } } });
  await drainInbox(ctx);
  return meeting;
}

test("candidate interview -> interview notes stored, visible and exported (signed)", async (t) => {
  const analyzer = fakeAnalyzer([NOTES]);
  const { ctx, fake } = setup({ analyzer, env: { PROFILR_EXPORT_WEBHOOK_URL: "https://hooks.profilr.example/notes", PROFILR_EXPORT_SECRET: "s3cret" } });
  const exports = [];
  const baseFetch = ctx.fetch;
  ctx.fetch = async (url, init) => {
    if (String(url).startsWith("https://hooks.profilr.example/")) { exports.push({ url: String(url), init }); return new Response("{}", { status: 200 }); }
    return baseFetch(url, init);
  };
  const app = await serve(ctx);
  t.after(app.close);

  const meeting = await meetingWithTranscript(app, ctx, fake, { meeting_type: "candidate_interview", subject_ref: "profile_123", subject_label: "Sam Martin — Backend Go" });
  let detail = (await (await app.call(`/api/meetings/${meeting.id}`)).json()).meeting;
  assert.equal(detail.analysis.status, "pending");

  await drainAnalyses(ctx);
  assert.equal(analyzer.calls.length, 1);
  const call = analyzer.calls[0];
  assert.equal(call.schema, INTERVIEW_NOTES_SCHEMA);
  assert.match(call.prompt, /\[00:02\] Recruteur: Parlez-moi de vous\./);
  assert.match(call.prompt, /\[03:12\] Sam: J'ai migré nos 40 services\./);
  assert.match(call.prompt, /Sam Martin — Backend Go/);
  assert.match(call.system, /caractéristique protégée/);

  detail = (await (await app.call(`/api/meetings/${meeting.id}`)).json()).meeting;
  assert.equal(detail.analysis.status, "done");
  assert.equal(detail.analysis.kind, "interview_notes");
  assert.deepEqual(detail.analysis.result, NOTES);
  assert.equal(detail.analysis.export_status, "sent");

  assert.equal(exports.length, 1);
  const { init } = exports[0];
  const sent = JSON.parse(init.body);
  assert.equal(sent.type, "interview_notes");
  assert.equal(sent.meeting.subject_ref, "profile_123");
  const expected = crypto.createHmac("sha256", "s3cret").update(`${init.headers["x-profilr-timestamp"]}.${init.body}`).digest("hex");
  assert.equal(init.headers["x-profilr-signature"], `sha256=${expected}`);
  assert.equal(init.headers["idempotency-key"], `${meeting.id}:interview_notes`);

  // Running the worker again does not call Claude again.
  await drainAnalyses(ctx);
  assert.equal(analyzer.calls.length, 1);
});

test("client intake call -> job brief; 'other' meetings are not analysed", async (t) => {
  const analyzer = fakeAnalyzer([BRIEF]);
  const { ctx, fake } = setup({ analyzer });
  const app = await serve(ctx);
  t.after(app.close);

  const intake = await meetingWithTranscript(app, ctx, fake, { meeting_type: "client_intake" });
  const other = await meetingWithTranscript(app, ctx, fake, { meeting_type: "other" });
  await drainAnalyses(ctx);
  assert.equal(analyzer.calls.length, 1);
  assert.equal(analyzer.calls[0].schema, JOB_BRIEF_SCHEMA);

  const brief = (await (await app.call(`/api/meetings/${intake.id}`)).json()).meeting;
  assert.equal(brief.analysis.kind, "job_brief");
  assert.equal(brief.analysis.result.job_title, "Lead Data Engineer");
  assert.equal(brief.analysis.export_status, "not_configured");
  const o = (await (await app.call(`/api/meetings/${other.id}`)).json()).meeting;
  assert.equal(o.analysis, null);
  assert.equal(o.transcript.length, 2, "transcript still stored for 'other'");

  // Correcting the type re-runs the right analysis.
  analyzer.calls.length = 0;
  const outputs = [NOTES];
  analyzer.complete = async (args) => (analyzer.calls.push(args), { output: outputs.shift(), model: "claude-opus-5-5" });
  assert.equal((await app.call(`/api/meetings/${other.id}/analysis`, { method: "POST", body: { meeting_type: "candidate_interview" } })).status, 202);
  await drainAnalyses(ctx);
  const fixed = (await (await app.call(`/api/meetings/${other.id}`)).json()).meeting;
  assert.equal(fixed.meeting_type, "candidate_interview");
  assert.equal(fixed.analysis.kind, "interview_notes");
});

test("analysis failures: transient errors retry, refusals stop, missing key leaves jobs pending", async (t) => {
  const analyzer = fakeAnalyzer([new Error("overloaded"), new AnalysisRefusedError("declined")]);
  const { ctx, fake } = setup({ analyzer });
  const app = await serve(ctx);
  t.after(app.close);
  const m = await meetingWithTranscript(app, ctx, fake, {});
  await drainAnalyses(ctx);
  let row = ctx.db.prepare("SELECT * FROM analyses WHERE meeting_id = ?").get(m.id);
  assert.equal(row.status, "pending");
  assert.equal(row.attempts, 1);
  ctx.db.prepare("UPDATE analyses SET next_attempt_at = ? WHERE meeting_id = ?").run(new Date(0).toISOString(), m.id);
  await drainAnalyses(ctx);
  row = ctx.db.prepare("SELECT * FROM analyses WHERE meeting_id = ?").get(m.id);
  assert.equal(row.status, "failed");
  assert.match(row.error, /declined/);

  const noKey = setup({ analyzer: null });
  const app2 = await serve(noKey.ctx);
  t.after(app2.close);
  const m2 = await meetingWithTranscript(app2, noKey.ctx, noKey.fake, {});
  assert.equal(await drainAnalyses(noKey.ctx), 0);
  assert.equal(noKey.ctx.db.prepare("SELECT status FROM analyses WHERE meeting_id = ?").get(m2.id).status, "pending");
});

test("calendar opt-in carries the meeting type to the scheduled meeting", async (t) => {
  const { ctx, fake } = setup();
  const app = await serve(ctx);
  t.after(app.close);
  const calId = crypto.randomUUID();
  fake.state.calendars.set(calId, { id: calId, platform: "google_calendar", platform_email: "r@profilr.example", status: "connected" });
  const evt = { id: crypto.randomUUID(), calendar_id: calId, start_time: new Date(Date.now() + 86400000).toISOString(), end_time: null,
    meeting_url: "https://teams.microsoft.com/l/meetup-join/19%3ameeting/0?context=%7b%7d", is_deleted: false, raw: { summary: "Cadrage client" }, bots: [], updated_at: new Date().toISOString() };
  fake.state.events.set(evt.id, evt);
  await app.call("/api/calendars/sync", { method: "POST" });
  const res = await app.call(`/api/calendar-events/${evt.id}/record`, { method: "POST", body: { enabled: true, meeting_type: "client_intake", subject_label: "Poste Lead Data" } });
  assert.equal(res.status, 200);
  const m = ctx.db.prepare("SELECT * FROM meetings WHERE calendar_event_id = ?").get(evt.id);
  assert.equal(m.meeting_type, "client_intake");
  assert.equal(m.subject_label, "Poste Lead Data");
  assert.equal((await app.call(`/api/calendar-events/${evt.id}/record`, { method: "POST", body: { enabled: true, meeting_type: "x" } })).status, 400);
});

test("meeting links: Recall's documented formats are recognised, unknown https links go to Recall", () => {
  assert.equal(detectPlatform("https://meet.google.com/abc-defg-hij"), "google_meet");
  assert.equal(detectPlatform("https://teams.microsoft.com/l/meetup-join/abc"), "microsoft_teams");
  assert.equal(detectPlatform("https://teams.cloud.microsoft/meet/123?p=x"), "microsoft_teams");
  assert.equal(detectPlatform("https://teams.live.com/meet/9876"), "microsoft_teams");
  assert.equal(detectPlatform("https://gov.teams.microsoft.us/meet/1"), "microsoft_teams");
  assert.equal(detectPlatform("https://us02web.zoom.us/j/123?pwd=x"), "zoom");
  assert.equal(detectPlatform("https://zoom.com/j/1"), "zoom");
  assert.equal(detectPlatform("https://acme.webex.com/meet/jdoe"), "webex");
  assert.equal(detectPlatform("https://meet.goto.com/123"), "goto_meeting");
  assert.equal(detectPlatform("https://app.goto.com/meeting/123"), "goto_meeting");
  assert.equal(detectPlatform("https://calendly.com/x/redirect"), null);
});

test("Claude wrapper: structured output request shape, refusal and truncation handling", async () => {
  const requests = [];
  const reply = (msg) => ({ beta: { messages: { stream: (body) => (requests.push(body), { finalMessage: async () => msg }) } } });
  const ok = createClaudeAnalyzer({ client: reply({ model: "claude-opus-5-5", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(NOTES) }] }) });
  const out = await ok.complete({ system: "s", prompt: "p", schema: INTERVIEW_NOTES_SCHEMA });
  assert.deepEqual(out.output, NOTES);
  const body = requests[0];
  assert.equal(body.model, "claude-opus-5-5");
  assert.deepEqual(body.output_config, { effort: "high", format: { type: "json_schema", schema: INTERVIEW_NOTES_SCHEMA } });
  assert.deepEqual(body.thinking, { type: "adaptive" });
  assert.equal(body.fallbacks, "default");
  assert.deepEqual(body.betas, ["server-side-fallback-2026-07-01"]);

  const refused = createClaudeAnalyzer({ client: reply({ stop_reason: "refusal", stop_details: { category: null }, content: [] }) });
  await assert.rejects(refused.complete({ system: "s", prompt: "p", schema: {} }), AnalysisRefusedError);
  const cut = createClaudeAnalyzer({ client: reply({ stop_reason: "max_tokens", content: [{ type: "text", text: "{" }] }) });
  await assert.rejects(cut.complete({ system: "s", prompt: "p", schema: {} }), /truncated/);
});

test("schemas are strict (every property required, no extras) as structured outputs require", () => {
  const walk = (s) => {
    if (s.type === "object") {
      assert.equal(s.additionalProperties, false);
      assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort());
      Object.values(s.properties).forEach(walk);
    }
    if (s.type === "array") walk(s.items);
    (s.anyOf ?? []).forEach(walk);
  };
  walk(INTERVIEW_NOTES_SCHEMA);
  walk(JOB_BRIEF_SCHEMA);
  assert.equal(formatTranscript([{ speaker: "A", start: 65.4, text: "Bonjour" }, { speaker: "B", start: null, text: "Salut" }]), "[01:05] A: Bonjour\nB: Salut");
});
