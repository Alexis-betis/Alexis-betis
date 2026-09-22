import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig, ConfigError } from "../src/config.js";

const good = {
  RECALL_REGION: "eu-central-1",
  RECALL_API_KEY: "k",
  RECALL_WEBHOOK_VERIFICATION_SECRET: "whsec_abc",
  PUBLIC_API_BASE_URL: "https://api.profilr.example/",
  APP_ACCESS_TOKEN: "0123456789abcdef",
};

test("loads and binds the EU region", () => {
  const c = loadConfig(good);
  assert.equal(c.recall.baseUrl, "https://eu-central-1.recall.ai");
  assert.equal(c.publicBaseUrl, "https://api.profilr.example");
});

test("names every missing required variable", () => {
  assert.throws(() => loadConfig({}), (e) => e instanceof ConfigError && /RECALL_REGION, RECALL_API_KEY, RECALL_WEBHOOK_VERIFICATION_SECRET, PUBLIC_API_BASE_URL, APP_ACCESS_TOKEN/.test(e.message));
});

test("rejects unknown region, localhost/IP public URL, bad secret, cross-region calendar callback", () => {
  assert.throws(() => loadConfig({ ...good, RECALL_REGION: "eu-west-1" }), ConfigError);
  assert.throws(() => loadConfig({ ...good, PUBLIC_API_BASE_URL: "https://localhost:3000" }), ConfigError);
  assert.throws(() => loadConfig({ ...good, PUBLIC_API_BASE_URL: "https://10.0.0.5" }), ConfigError);
  assert.throws(() => loadConfig({ ...good, PUBLIC_API_BASE_URL: "http://api.profilr.example" }), ConfigError);
  assert.throws(() => loadConfig({ ...good, RECALL_WEBHOOK_VERIFICATION_SECRET: "abc" }), ConfigError);
  assert.throws(() => loadConfig({ ...good, RECALL_CALENDAR_REGIONAL_CALLBACK_URI: "https://us-east-1.recall.ai/cb" }), ConfigError);
});
