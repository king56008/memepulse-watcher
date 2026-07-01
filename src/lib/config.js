export const cfg = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  MONGODB_URI: process.env.MONGODB_URI || "",

  COOKMYBOTS_AI_ENDPOINT: (process.env.COOKMYBOTS_AI_ENDPOINT || "https://api.cookmybots.com/api/ai").replace(/\/+$/, ""),
  COOKMYBOTS_AI_KEY: process.env.COOKMYBOTS_AI_KEY || "",
  WEB3_CHAT_MODE: process.env.WEB3_CHAT_MODE || "on",
  AI_TIMEOUT_MS: Number(process.env.AI_TIMEOUT_MS || 600000),
  AI_MAX_RETRIES: Number(process.env.AI_MAX_RETRIES || 2),
  CONCURRENCY: Number(process.env.CONCURRENCY || 20),

  COOKMYBOTS_X_ENDPOINT: (process.env.COOKMYBOTS_X_ENDPOINT || "").replace(/\/+$/, ""),
  COOKMYBOTS_X_KEY: process.env.COOKMYBOTS_X_KEY || "",

  COINGECKO_API_BASE: (process.env.COINGECKO_API_BASE || "https://api.coingecko.com/api/v3").replace(/\/+$/, ""),
  SCHEDULER_POLL_MS: Number(process.env.SCHEDULER_POLL_MS || 60000),
  ANNOUNCEMENT_POLL_MS: Number(process.env.ANNOUNCEMENT_POLL_MS || 300000),
  DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE || "UTC",
  DEFAULT_DIGEST_TIME: process.env.DEFAULT_DIGEST_TIME || "09:00",
  NODE_ENV: process.env.NODE_ENV || "development",
};

export function envHealth() {
  return {
    telegramTokenSet: Boolean(cfg.TELEGRAM_BOT_TOKEN),
    mongoSet: Boolean(cfg.MONGODB_URI),
    aiEndpointSet: Boolean(cfg.COOKMYBOTS_AI_ENDPOINT),
    aiKeySet: Boolean(cfg.COOKMYBOTS_AI_KEY),
    xEndpointSet: Boolean(cfg.COOKMYBOTS_X_ENDPOINT),
    xKeySet: Boolean(cfg.COOKMYBOTS_X_KEY),
  };
}
