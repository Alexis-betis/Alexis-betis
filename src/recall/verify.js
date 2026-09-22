import crypto from "node:crypto";

export class VerificationError extends Error {}

const TOLERANCE_SECONDS = 5 * 60;

/**
 * Verify a webhook/callback from Recall.ai (Svix-style signature) against the
 * raw body exactly as received. Throws VerificationError on failure.
 *
 * @param {{ secret: string, headers: Record<string, string | undefined>, payload: string | null, now?: number }} args
 */
export function verifyRequestFromRecall({ secret, headers, payload, now = Date.now() }) {
  if (!secret?.startsWith("whsec_")) throw new VerificationError("verification secret missing or invalid");

  const msgId = headers["webhook-id"] ?? headers["svix-id"];
  const msgTimestamp = headers["webhook-timestamp"] ?? headers["svix-timestamp"];
  const msgSignature = headers["webhook-signature"] ?? headers["svix-signature"];
  if (!msgId || !msgTimestamp || !msgSignature) throw new VerificationError("missing signature headers");

  const ts = Number(msgTimestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > TOLERANCE_SECONDS) {
    throw new VerificationError("timestamp outside tolerance");
  }

  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const expected = crypto
    .createHmac("sha256", key)
    .update(`${msgId}.${msgTimestamp}.${payload ?? ""}`)
    .digest();

  for (const versioned of msgSignature.split(" ")) {
    const [version, signature] = versioned.split(",");
    if (version !== "v1" || !signature) continue;
    const got = Buffer.from(signature, "base64");
    if (got.length === expected.length && crypto.timingSafeEqual(got, expected)) {
      return { webhookId: msgId };
    }
  }
  throw new VerificationError("no matching signature");
}

/** Test/fixture helper: produce headers Recall would send for `payload`. */
export function signForTest({ secret, payload, msgId = `msg_${crypto.randomUUID()}`, timestamp = Math.floor(Date.now() / 1000) }) {
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const sig = crypto.createHmac("sha256", key).update(`${msgId}.${timestamp}.${payload}`).digest("base64");
  return { "webhook-id": msgId, "webhook-timestamp": String(timestamp), "webhook-signature": `v1,${sig}` };
}
