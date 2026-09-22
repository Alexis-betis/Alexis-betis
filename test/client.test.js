import test from "node:test";
import assert from "node:assert/strict";
import { RecallClient, RecallAmbiguousError, RecallApiError } from "../src/recall/client.js";
import { createFakeRecall } from "../src/testing/fake-recall.js";

function client(fake, sleeps = []) {
  return new RecallClient({ baseUrl: fake.baseUrl, apiKey: fake.apiKey, fetch: fake.fetch, sleep: async (ms) => sleeps.push(ms) });
}

test("sends the API key and targets the configured region", async () => {
  const fake = createFakeRecall();
  const bot = await client(fake).createBot({ meeting_url: "https://meet.google.com/abc-defg-hij" });
  assert.ok(bot.id);
  assert.equal(fake.state.requests[0].auth, fake.apiKey);
  assert.equal(fake.state.requests[0].path, "/api/v1/bot/");
});

test("honours Retry-After on 429 and retries 503/507", async () => {
  const fake = createFakeRecall();
  const sleeps = [];
  fake.state.failNext.push({ match: (m, p) => p === "/api/v1/bot/", status: 429, headers: { "retry-after": "7" } });
  fake.state.failNext.push({ match: (m, p) => p === "/api/v1/bot/", status: 507 });
  await client(fake, sleeps).createBot({ meeting_url: "https://zoom.us/j/1" });
  assert.equal(fake.state.requests.length, 3);
  assert.ok(sleeps[0] >= 7000 && sleeps[0] < 8000, `waited ${sleeps[0]}ms`);
  assert.ok(sleeps[1] >= 30000);
});

test("does not blindly retry a create after a network failure", async () => {
  const fake = createFakeRecall();
  fake.state.failNext.push({ match: (m, p) => p === "/api/v1/bot/", networkError: true });
  await assert.rejects(client(fake).createBot({ meeting_url: "https://zoom.us/j/1" }), RecallAmbiguousError);
  assert.equal(fake.state.requests.length, 1);
});

test("surfaces 4xx validation errors without retrying", async () => {
  const fake = createFakeRecall();
  await assert.rejects(client(fake).createBot({}), (e) => e instanceof RecallApiError && e.status === 400 && Boolean(e.body.meeting_url));
  assert.equal(fake.state.requests.length, 1);
});

test("refuses to follow a URL outside the configured region", async () => {
  const fake = createFakeRecall();
  await assert.rejects(client(fake).request("GET", "https://us-east-1.recall.ai/api/v1/bot/"), /region/);
});
