// Small Recall.ai REST client (v1.11 bot schema + Calendar V2). All requests go
// to the single configured region.

export class RecallApiError extends Error {
  constructor(message, { status, body, retriable = false } = {}) {
    super(message);
    this.status = status;
    this.body = body;
    this.retriable = retriable;
  }
}

/** Raised when we cannot know whether a non-idempotent request took effect. */
export class RecallAmbiguousError extends RecallApiError {}

const sleepDefault = (ms) => new Promise((r) => setTimeout(r, ms));

export class RecallClient {
  /**
   * @param {{ baseUrl: string, apiKey: string, fetch?: typeof fetch, sleep?: (ms:number)=>Promise<void>, maxAttempts?: number, log?: (msg:string, fields?:object)=>void }} opts
   */
  constructor({ baseUrl, apiKey, fetch: fetchImpl = globalThis.fetch, sleep = sleepDefault, maxAttempts = 6, log = () => {} }) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
    this.sleep = sleep;
    this.maxAttempts = maxAttempts;
    this.log = log;
  }

  /**
   * Retries 429 (honouring Retry-After), 503 and 507 with jitter. A 507/503 on
   * create means the request was rejected, so retrying is safe. Network errors
   * on non-idempotent requests are surfaced as RecallAmbiguousError instead of
   * blindly retried.
   */
  async request(method, path, { body, query, idempotent = method === "GET" || method === "DELETE" } = {}) {
    const url = new URL(path, this.baseUrl);
    if (url.origin !== new URL(this.baseUrl).origin) throw new Error("request left the configured Recall region");
    if (query) for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, String(v));

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      let res;
      try {
        res = await this.fetch(url, {
          method,
          headers: {
            Authorization: this.apiKey,
            accept: "application/json",
            ...(body ? { "content-type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (err) {
        if (!idempotent) {
          throw new RecallAmbiguousError(`network error on ${method} ${url.pathname}; outcome unknown`, { retriable: false });
        }
        if (attempt === this.maxAttempts) throw new RecallApiError(`network error on ${method} ${url.pathname}`, { retriable: true });
        await this.sleep(this.#backoff(attempt));
        continue;
      }

      let waitSeconds = null;
      if (res.status === 429) waitSeconds = Number.parseInt(res.headers.get("retry-after") || "", 10) || 2 ** attempt;
      else if (res.status === 503) waitSeconds = 10;
      else if (res.status === 507) waitSeconds = 30;
      else if (res.status >= 500 && idempotent) waitSeconds = 2 ** attempt;

      if (waitSeconds != null && attempt < this.maxAttempts) {
        this.log("recall.retry", { method, path: url.pathname, status: res.status, attempt, waitSeconds });
        await this.sleep(waitSeconds * 1000 + Math.floor(Math.random() * 1000));
        continue;
      }

      const text = await res.text();
      const data = text ? safeJson(text) : null;
      if (!res.ok) {
        const Err = res.status >= 500 && !idempotent ? RecallAmbiguousError : RecallApiError;
        throw new Err(`Recall ${method} ${url.pathname} failed with ${res.status}`, {
          status: res.status,
          body: data,
          retriable: waitSeconds != null,
        });
      }
      return data;
    }
    throw new RecallApiError(`Recall ${method} ${path}: max attempts reached`, { retriable: true });
  }

  #backoff(attempt) {
    return Math.min(30_000, 500 * 2 ** attempt) + Math.floor(Math.random() * 500);
  }

  // ---- Bots (v1.11) ----
  createBot(config) {
    return this.request("POST", "/api/v1/bot/", { body: config, idempotent: false });
  }
  getBot(botId) {
    return this.request("GET", `/api/v1/bot/${encodeURIComponent(botId)}/`);
  }

  // ---- Post-meeting transcription ----
  createAsyncTranscript(recordingId) {
    return this.request("POST", `/api/v1/recording/${encodeURIComponent(recordingId)}/create_transcript/`, {
      body: {
        provider: { recallai_async: { language_code: "auto" } },
        diarization: { use_separate_streams_when_available: true },
      },
      idempotent: false,
    });
  }
  getTranscript(transcriptId) {
    return this.request("GET", `/api/v1/transcript/${encodeURIComponent(transcriptId)}/`);
  }
  /** Download URLs are pre-signed; no Authorization header is sent. */
  async download(url) {
    for (let attempt = 1; ; attempt++) {
      const res = await this.fetch(url, { method: "GET" });
      if (res.ok) return res.json();
      if (attempt >= 3 || res.status < 500) throw new RecallApiError(`download failed with ${res.status}`, { status: res.status });
      await this.sleep(this.#backoff(attempt));
    }
  }

  // ---- Calendar V2 ----
  getCalendar(calendarId) {
    return this.request("GET", `/api/v2/calendars/${encodeURIComponent(calendarId)}/`);
  }
  async listCalendars() {
    return this.#paginate("/api/v2/calendars/", {});
  }
  async listCalendarEvents(calendarId, { updatedAtGte } = {}) {
    return this.#paginate("/api/v2/calendar-events/", { calendar_id: calendarId, updated_at__gte: updatedAtGte });
  }
  scheduleCalendarEventBot(eventId, { deduplicationKey, botConfig }) {
    // Recall upserts the event's bot for a given deduplication key, so this is safe to repeat.
    return this.request("POST", `/api/v2/calendar-events/${encodeURIComponent(eventId)}/bot/`, {
      body: { deduplication_key: deduplicationKey, bot_config: botConfig },
      idempotent: true,
    });
  }
  unscheduleCalendarEventBot(eventId) {
    return this.request("DELETE", `/api/v2/calendar-events/${encodeURIComponent(eventId)}/bot/`);
  }

  async #paginate(path, query) {
    const results = [];
    // Follow `next` verbatim, as the docs require.
    let page = await this.request("GET", path, { query });
    for (;;) {
      results.push(...(page?.results ?? []));
      if (!page?.next) return results;
      page = await this.request("GET", page.next);
    }
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}
