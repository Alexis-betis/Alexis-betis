import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyRequestFromRecall, signForTest, VerificationError } from "../src/recall/verify.js";

const secret = `whsec_${crypto.randomBytes(24).toString("base64")}`;
const payload = JSON.stringify({ event: "bot.done", data: {} });

test("accepts a correctly signed raw body", () => {
  const headers = signForTest({ secret, payload, msgId: "msg_1" });
  assert.deepEqual(verifyRequestFromRecall({ secret, headers, payload }), { webhookId: "msg_1" });
});

test("accepts when one of several rotated signatures matches", () => {
  const headers = signForTest({ secret, payload });
  headers["webhook-signature"] = `v1,AAAA ${headers["webhook-signature"]}`;
  verifyRequestFromRecall({ secret, headers, payload });
});

test("rejects tampered body, wrong secret, missing headers and stale timestamps", () => {
  const headers = signForTest({ secret, payload });
  assert.throws(() => verifyRequestFromRecall({ secret, headers, payload: payload + " " }), VerificationError);
  const other = `whsec_${crypto.randomBytes(24).toString("base64")}`;
  assert.throws(() => verifyRequestFromRecall({ secret: other, headers, payload }), VerificationError);
  assert.throws(() => verifyRequestFromRecall({ secret, headers: {}, payload }), VerificationError);
  const old = signForTest({ secret, payload, timestamp: Math.floor(Date.now() / 1000) - 3600 });
  assert.throws(() => verifyRequestFromRecall({ secret, headers: old, payload }), VerificationError);
});
