// In-memory stand-in for the Recall REST API, used ONLY by tests and the
// --smoke run. It is injected as `fetch` into the real RecallClient, so every
// request still goes through the production client, retry logic and handlers.
import crypto from "node:crypto";

export function createFakeRecall({ baseUrl = "https://eu-central-1.recall.ai", apiKey = "fake-test-key" } = {}) {
  const state = {
    requests: [],
    bots: new Map(),
    transcripts: new Map(),
    calendars: new Map(),
    events: new Map(),
    failNext: [], // queue of { match: (method, path) => bool, status, headers?, body?, networkError? }
  };

  const json = (status, body, headers = {}) =>
    new Response(body == null ? "" : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

  async function fetch(input, init = {}) {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    state.requests.push({ method, path: url.pathname, search: url.search, body, auth: init.headers?.Authorization });

    const idx = state.failNext.findIndex((f) => f.match(method, url.pathname));
    if (idx >= 0) {
      const f = state.failNext.splice(idx, 1)[0];
      if (f.networkError) throw new TypeError("fetch failed");
      return json(f.status, f.body ?? { detail: "fake failure" }, f.headers);
    }

    if (url.origin === "https://fake-download.recall.test") {
      return json(200, state.transcripts.get(url.pathname.split("/").pop())?.content ?? []);
    }
    if (url.origin !== baseUrl) return json(404, { detail: "wrong region" });
    if (init.headers?.Authorization !== apiKey) return json(401, { detail: "Invalid API key" });

    let m;
    if (method === "POST" && url.pathname === "/api/v1/bot/") {
      if (!body?.meeting_url) return json(400, { meeting_url: ["This field is required."] });
      const bot = { id: crypto.randomUUID(), meeting_url: body.meeting_url, join_at: body.join_at, metadata: body.metadata, bot_name: body.bot_name };
      state.bots.set(bot.id, bot);
      return json(201, bot);
    }
    if (method === "GET" && (m = url.pathname.match(/^\/api\/v1\/bot\/([^/]+)\/$/))) {
      return state.bots.has(m[1]) ? json(200, state.bots.get(m[1])) : json(404, {});
    }
    if (method === "POST" && (m = url.pathname.match(/^\/api\/v1\/recording\/([^/]+)\/create_transcript\/$/))) {
      const t = { id: crypto.randomUUID(), recording_id: m[1], provider: body.provider, content: null };
      state.transcripts.set(t.id, t);
      return json(200, { id: t.id, status: { code: "processing" } });
    }
    if (method === "GET" && (m = url.pathname.match(/^\/api\/v1\/transcript\/([^/]+)\/$/))) {
      const t = state.transcripts.get(m[1]);
      return t ? json(200, { id: t.id, data: { download_url: `https://fake-download.recall.test/t/${t.id}` } }) : json(404, {});
    }
    if (method === "GET" && url.pathname === "/api/v2/calendars/") {
      return json(200, { next: null, results: [...state.calendars.values()] });
    }
    if (method === "GET" && (m = url.pathname.match(/^\/api\/v2\/calendars\/([^/]+)\/$/))) {
      return state.calendars.has(m[1]) ? json(200, state.calendars.get(m[1])) : json(404, {});
    }
    if (method === "GET" && url.pathname === "/api/v2/calendar-events/") {
      const cal = url.searchParams.get("calendar_id");
      const since = url.searchParams.get("updated_at__gte");
      const all = [...state.events.values()].filter((e) => e.calendar_id === cal && (!since || e.updated_at >= since));
      // Two pages to exercise `next` handling.
      const page = url.searchParams.get("cursor") === "2" ? all.slice(1) : all.slice(0, 1);
      const next = !url.searchParams.get("cursor") && all.length > 1 ? `${baseUrl}/api/v2/calendar-events/?calendar_id=${cal}${since ? `&updated_at__gte=${encodeURIComponent(since)}` : ""}&cursor=2` : null;
      return json(200, { next, previous: null, results: page });
    }
    if ((m = url.pathname.match(/^\/api\/v2\/calendar-events\/([^/]+)\/bot\/$/))) {
      const e = state.events.get(m[1]);
      if (!e) return json(404, {});
      if (method === "POST") {
        const botId = crypto.randomUUID();
        state.bots.set(botId, { id: botId, meeting_url: e.meeting_url, join_at: e.start_time, metadata: body.bot_config.metadata, bot_name: body.bot_config.bot_name });
        e.bots = [{ bot_id: botId, start_time: e.start_time, deduplication_key: body.deduplication_key, meeting_url: e.meeting_url }];
      } else if (method === "DELETE") {
        e.bots = [];
      }
      return json(200, e);
    }
    return json(404, { detail: `fake: no route ${method} ${url.pathname}` });
  }

  return { fetch, state, baseUrl, apiKey };
}
