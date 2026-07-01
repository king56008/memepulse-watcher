import { log, safeErr } from "../lib/logger.js";

const lastSend = new Map();
const MIN_GAP_MS = 1200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendText(bot, chatId, text, options = {}) {
  const key = String(chatId);
  const last = lastSend.get(key) || 0;
  const wait = Math.max(0, MIN_GAP_MS - (Date.now() - last));
  if (wait) await sleep(wait);
  try {
    await bot.api.sendMessage(chatId, String(text || "").slice(0, 3900), { disable_web_page_preview: true, ...options });
    lastSend.set(key, Date.now());
    log.info("telegram send success", { chatId: key });
    return true;
  } catch (err) {
    log.error("telegram send failure", { chatId: key, err: safeErr(err) });
    return false;
  }
}
