// Runtime configuration boundary. Everything Recall-related is read from the
// server environment and injected into the Recall client; nothing here is ever
// sent to the browser.

export const RECALL_REGIONS = ["us-east-1", "us-west-2", "eu-central-1", "ap-northeast-1"];

export class ConfigError extends Error {}

function isPrivateHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
    hostname.includes(":") // bare IPv6
  );
}

/**
 * @param {Record<string, string | undefined>} env
 */
export function loadConfig(env) {
  const missing = [];
  const req = (name) => {
    const v = env[name]?.trim();
    if (!v) missing.push(name);
    return v ?? "";
  };

  const region = req("RECALL_REGION");
  const apiKey = req("RECALL_API_KEY");
  const verificationSecret = req("RECALL_WEBHOOK_VERIFICATION_SECRET");
  const publicBaseUrl = req("PUBLIC_API_BASE_URL").replace(/\/+$/, "");
  const accessToken = req("APP_ACCESS_TOKEN");

  if (missing.length) {
    throw new ConfigError(`Missing required environment variables: ${missing.join(", ")}`);
  }
  if (!RECALL_REGIONS.includes(region)) {
    throw new ConfigError(`RECALL_REGION must be one of ${RECALL_REGIONS.join(", ")}`);
  }
  if (!verificationSecret.startsWith("whsec_")) {
    throw new ConfigError("RECALL_WEBHOOK_VERIFICATION_SECRET must be a whsec_ secret");
  }
  let publicUrl;
  try {
    publicUrl = new URL(publicBaseUrl);
  } catch {
    throw new ConfigError("PUBLIC_API_BASE_URL must be an absolute URL");
  }
  if (publicUrl.protocol !== "https:" || isPrivateHost(publicUrl.hostname)) {
    throw new ConfigError("PUBLIC_API_BASE_URL must be a public https origin (no localhost or IPs)");
  }
  if (accessToken.length < 16) {
    throw new ConfigError("APP_ACCESS_TOKEN must be at least 16 characters");
  }

  const calendarCallback = env.RECALL_CALENDAR_REGIONAL_CALLBACK_URI?.trim() || null;
  if (calendarCallback && !new URL(calendarCallback).hostname.startsWith(`${region}.`)) {
    throw new ConfigError("RECALL_CALENDAR_REGIONAL_CALLBACK_URI must belong to RECALL_REGION");
  }

  return Object.freeze({
    recall: Object.freeze({
      region,
      apiKey,
      verificationSecret,
      baseUrl: `https://${region}.recall.ai`,
      calendarRegionalCallbackUri: calendarCallback,
    }),
    publicBaseUrl,
    accessToken,
    port: Number(env.PORT || 3000),
    databasePath: env.DATABASE_PATH || "./data/profilr-meetings.sqlite",
    botName: env.BOT_NAME || "Profilr Notetaker",
  });
}
